import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { findEditableTrip } from '../services/trip-data.js';
import { badRequest, parseId, sendError } from '../services/trip-rules.js';
import { ably } from '../services/ably.js';
import { directKey, messagePreview, tokenCapability, userChannel, validateMessageBody } from '../services/chat-rules.js';

// User-to-user chat: one-to-one conversations and one group per trip.
// Messages are stored in the database; Ably (optional) only tells browsers that something changed.
const router = Router();
const signedIn = [requireAuth, requireProfile];
const NOT_FOUND = { status: 404, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation was not found.' };
const PAGE_SIZE = 40;

const sendLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: (req) => `chat:${req.userId}`,
  message: { error: { code: 'CHAT_RATE_LIMITED', message: 'You are sending messages too fast. Wait a moment.' } },
});

// Keep a trip conversation's members equal to the trip owner plus invited members.
async function syncTripMembers(db, conversationId, tripId) {
  const [rows] = await db.execute(
    'SELECT owner_user_id AS userId FROM trips WHERE id = ? UNION SELECT user_id AS userId FROM trip_members WHERE trip_id = ?',
    [tripId, tripId],
  );
  const ids = rows.map((row) => Number(row.userId));
  for (const id of ids) await db.execute('INSERT IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', [conversationId, id]);
  if (ids.length) {
    await db.execute(`DELETE FROM conversation_members WHERE conversation_id = ? AND user_id NOT IN (${ids.map(() => '?').join(', ')})`, [conversationId, ...ids]);
  }
  return ids;
}

// The conversation if the user may read it (direct: a member; trip: still on the trip).
async function findConversation(db, conversationId, userId) {
  const [rows] = await db.execute('SELECT id, kind, trip_id AS tripId FROM conversations WHERE id = ?', [conversationId]);
  const conversation = rows[0];
  if (!conversation) return null;
  if (conversation.kind === 'trip') {
    const trip = await findEditableTrip(db, conversation.tripId, userId);
    if (!trip) return null;
    await syncTripMembers(db, conversation.id, conversation.tripId);
    return { ...conversation, title: trip.title };
  }
  const [members] = await db.execute('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [conversationId, userId]);
  return members.length ? conversation : null;
}

async function memberIds(db, conversationId) {
  const [rows] = await db.execute('SELECT user_id AS userId FROM conversation_members WHERE conversation_id = ?', [conversationId]);
  return rows.map((row) => Number(row.userId));
}

async function isBlockedBetween(db, a, b) {
  const [rows] = await db.execute(
    'SELECT 1 FROM user_blocks WHERE (blocker_user_id = ? AND blocked_user_id = ?) OR (blocker_user_id = ? AND blocked_user_id = ?)',
    [a, b, b, a],
  );
  return rows.length > 0;
}

async function notify(userIds, data) {
  const key = process.env.ABLY_API_KEY;
  if (!key) return;
  await Promise.all(userIds.map((id) => ably.publish(key, userChannel(id), 'conversation', data)
    .catch((error) => console.error(`[chat] Ably publish failed: ${error.message}`))));
}

// Conversations for the signed-in user, newest activity first, with title, last message and unread count.
router.get('/chat/conversations', signedIn, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.kind, c.trip_id AS tripId, c.last_message_at AS lastMessageAt, t.title AS tripTitle,
              (SELECT u.id FROM conversation_members o JOIN users u ON u.id = o.user_id
                 WHERE o.conversation_id = c.id AND o.user_id <> ? LIMIT 1) AS otherId,
              (SELECT u.display_name FROM conversation_members o JOIN users u ON u.id = o.user_id
                 WHERE o.conversation_id = c.id AND o.user_id <> ? LIMIT 1) AS otherName,
              (SELECT u.avatar_url FROM conversation_members o JOIN users u ON u.id = o.user_id
                 WHERE o.conversation_id = c.id AND o.user_id <> ? LIMIT 1) AS otherAvatar,
              (SELECT m.body FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS lastBody,
              (SELECT m.sender_user_id FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS lastSenderId,
              (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.id > COALESCE(cm.last_read_message_id, 0) AND m.sender_user_id <> ?) AS unread
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       LEFT JOIN trips t ON t.id = c.trip_id
       WHERE cm.user_id = ?
         AND (c.kind <> 'trip' OR t.owner_user_id = ? OR EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = c.trip_id AND tm.user_id = ?))
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC LIMIT 100`,
      [req.userId, req.userId, req.userId, req.userId, req.userId, req.userId, req.userId],
    );
    const data = rows.map((row) => ({
      id: Number(row.id), kind: row.kind, tripId: row.tripId == null ? null : Number(row.tripId),
      title: row.kind === 'trip' ? row.tripTitle : row.otherName,
      avatarUrl: row.kind === 'trip' ? null : row.otherAvatar || null,
      otherUserId: row.kind === 'trip' ? null : Number(row.otherId) || null,
      lastMessage: row.lastBody ? { preview: messagePreview(row.lastBody), mine: Number(row.lastSenderId) === req.userId } : null,
      lastMessageAt: row.lastMessageAt, unread: Number(row.unread) || 0,
    }));
    res.set('Cache-Control', 'private, no-store').json({ data, unreadTotal: data.reduce((sum, item) => sum + item.unread, 0) });
  } catch (error) { next(error); }
});

router.get('/chat/unread', signedIn, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS n FROM conversation_members cm JOIN chat_messages m ON m.conversation_id = cm.conversation_id
       WHERE cm.user_id = ? AND m.sender_user_id <> ? AND m.id > COALESCE(cm.last_read_message_id, 0)`,
      [req.userId, req.userId],
    );
    res.set('Cache-Control', 'private, no-store').json({ data: { unread: Number(rows[0]?.n) || 0 } });
  } catch (error) { next(error); }
});

// People to start a chat with, by display name. Emails are never returned.
router.get('/chat/users', signedIn, async (req, res, next) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2 || q.length > 60) return res.json({ data: [] });
  try {
    const [rows] = await pool.execute(
      `SELECT id, display_name AS name, avatar_url AS avatarUrl FROM users
       WHERE id <> ? AND display_name LIKE ? ORDER BY display_name LIMIT 10`,
      [req.userId, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`],
    );
    res.json({ data: rows.map((row) => ({ id: Number(row.id), name: row.name, avatarUrl: row.avatarUrl || null })) });
  } catch (error) { next(error); }
});

// Open (or create) the one-to-one conversation with another user.
router.post('/chat/direct', signedIn, async (req, res, next) => {
  const otherId = parseId(req.body?.userId);
  if (!otherId || otherId === req.userId) return sendError(res, badRequest('INVALID_USER', 'Choose another user to chat with.'));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute('SELECT id FROM users WHERE id = ?', [otherId]);
    if (!users.length) { await connection.rollback(); return sendError(res, { status: 404, code: 'USER_NOT_FOUND', message: 'This user was not found.' }); }
    const key = directKey(req.userId, otherId);
    await connection.execute("INSERT IGNORE INTO conversations (kind, direct_key) VALUES ('direct', ?)", [key]);
    const [rows] = await connection.execute('SELECT id FROM conversations WHERE direct_key = ?', [key]);
    const id = Number(rows[0].id);
    await connection.execute('INSERT IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', [id, req.userId, id, otherId]);
    await connection.commit();
    return res.json({ data: { id } });
  } catch (error) {
    await connection.rollback().catch(() => {});
    return next(error);
  } finally { connection.release(); }
});

// Open (or create) the group conversation of a trip. Owner and members only.
router.post('/chat/trips/:tripId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, badRequest('INVALID_TRIP_ID', 'Trip ID must be a positive integer.'));
  try {
    const trip = await findEditableTrip(pool, tripId, req.userId);
    if (!trip) return sendError(res, { status: 404, code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' });
    await pool.execute("INSERT IGNORE INTO conversations (kind, trip_id) VALUES ('trip', ?)", [tripId]);
    const [rows] = await pool.execute('SELECT id FROM conversations WHERE trip_id = ?', [tripId]);
    const id = Number(rows[0].id);
    await syncTripMembers(pool, id, tripId);
    return res.json({ data: { id } });
  } catch (error) { return next(error); }
});

// Messages of one conversation, oldest first. `before` loads older pages.
router.get('/chat/conversations/:id/messages', signedIn, async (req, res, next) => {
  const conversationId = parseId(req.params.id);
  if (!conversationId) return sendError(res, NOT_FOUND);
  const before = req.query.before ? parseId(req.query.before) : null;
  try {
    const conversation = await findConversation(pool, conversationId, req.userId);
    if (!conversation) return sendError(res, NOT_FOUND);
    const [rows] = await pool.execute(
      `SELECT m.id, m.body, m.created_at AS createdAt, m.sender_user_id AS senderId, u.display_name AS senderName, u.avatar_url AS senderAvatar
       FROM chat_messages m JOIN users u ON u.id = m.sender_user_id
       WHERE m.conversation_id = ?${before ? ' AND m.id < ?' : ''} ORDER BY m.id DESC LIMIT ${PAGE_SIZE + 1}`,
      before ? [conversationId, before] : [conversationId],
    );
    const [people] = await pool.execute(
      `SELECT u.id, u.display_name AS name, u.avatar_url AS avatarUrl FROM conversation_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = ? ORDER BY u.display_name`,
      [conversationId],
    );
    const others = people.filter((person) => Number(person.id) !== req.userId);
    const blocked = conversation.kind === 'direct' && others[0] ? await isBlockedBetween(pool, req.userId, Number(others[0].id)) : false;
    const [mine] = await pool.execute('SELECT blocked_user_id AS id FROM user_blocks WHERE blocker_user_id = ?', [req.userId]);
    const messages = rows.slice(0, PAGE_SIZE).reverse().map((row) => ({
      id: Number(row.id), body: row.body, createdAt: row.createdAt, senderId: Number(row.senderId),
      senderName: row.senderName, senderAvatar: row.senderAvatar || null, mine: Number(row.senderId) === req.userId,
    }));
    res.set('Cache-Control', 'private, no-store').json({ data: {
      id: conversationId, viewerId: req.userId, kind: conversation.kind, tripId: conversation.tripId == null ? null : Number(conversation.tripId),
      title: conversation.kind === 'trip' ? conversation.title : others[0]?.name || '',
      members: people.map((person) => ({ id: Number(person.id), name: person.name, avatarUrl: person.avatarUrl || null })),
      blocked, blockedByMe: mine.some((row) => others.some((other) => Number(other.id) === Number(row.id))),
      messages, hasMore: rows.length > PAGE_SIZE,
    } });
  } catch (error) { next(error); }
});

router.post('/chat/conversations/:id/messages', signedIn, sendLimiter, async (req, res, next) => {
  const conversationId = parseId(req.params.id);
  if (!conversationId) return sendError(res, NOT_FOUND);
  const body = validateMessageBody(req.body?.body);
  if (!body) return sendError(res, badRequest('INVALID_MESSAGE', 'Write a message of up to 2000 characters.'));
  try {
    const conversation = await findConversation(pool, conversationId, req.userId);
    if (!conversation) return sendError(res, NOT_FOUND);
    const members = await memberIds(pool, conversationId);
    if (conversation.kind === 'direct') {
      const other = members.find((id) => id !== req.userId);
      if (other && await isBlockedBetween(pool, req.userId, other)) {
        return sendError(res, { status: 403, code: 'CHAT_BLOCKED', message: 'You cannot message this person.' });
      }
    }
    const [result] = await pool.execute('INSERT INTO chat_messages (conversation_id, sender_user_id, body) VALUES (?, ?, ?)', [conversationId, req.userId, body]);
    const messageId = Number(result.insertId);
    await pool.execute('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);
    await pool.execute('UPDATE conversation_members SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?', [messageId, conversationId, req.userId]);
    await notify(members, { conversationId, messageId });
    res.status(201).json({ data: { id: messageId } });
  } catch (error) { next(error); }
});

router.post('/chat/conversations/:id/read', signedIn, async (req, res, next) => {
  const conversationId = parseId(req.params.id);
  const messageId = parseId(req.body?.messageId);
  if (!conversationId || !messageId) return sendError(res, badRequest('INVALID_READ', 'Send the last message ID you read.'));
  try {
    const conversation = await findConversation(pool, conversationId, req.userId);
    if (!conversation) return sendError(res, NOT_FOUND);
    await pool.execute(
      `UPDATE conversation_members SET last_read_message_id = ?
       WHERE conversation_id = ? AND user_id = ? AND COALESCE(last_read_message_id, 0) < ?`,
      [messageId, conversationId, req.userId, messageId],
    );
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post('/chat/blocks', signedIn, async (req, res, next) => {
  const userId = parseId(req.body?.userId);
  if (!userId || userId === req.userId) return sendError(res, badRequest('INVALID_USER', 'Choose another user.'));
  try {
    await pool.execute('INSERT IGNORE INTO user_blocks (blocker_user_id, blocked_user_id) VALUES (?, ?)', [req.userId, userId]);
    res.status(204).end();
  } catch (error) { next(error); }
});

router.delete('/chat/blocks/:userId', signedIn, async (req, res, next) => {
  const userId = parseId(req.params.userId);
  if (!userId) return sendError(res, badRequest('INVALID_USER', 'Choose another user.'));
  try {
    await pool.execute('DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?', [req.userId, userId]);
    res.status(204).end();
  } catch (error) { next(error); }
});

// A short-lived Ably token that can only listen on this user's own channel.
router.get('/chat/realtime-token', signedIn, async (req, res, next) => {
  const key = process.env.ABLY_API_KEY;
  if (!key) return res.json({ data: { enabled: false } });
  try {
    const details = await ably.requestToken(key, { clientId: `user-${req.userId}`, capability: tokenCapability(req.userId) });
    res.set('Cache-Control', 'private, no-store').json({ data: { enabled: true, token: details.token, expires: details.expires, channel: userChannel(req.userId) } });
  } catch (error) {
    console.error(`[chat] ${error.message}`);
    res.json({ data: { enabled: false } });
  }
});

export default router;
