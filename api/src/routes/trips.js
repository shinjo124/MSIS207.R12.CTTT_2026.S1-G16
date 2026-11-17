import { randomBytes, createHash } from 'node:crypto';
import { Router } from 'express';
import { setTimeout as delay } from 'node:timers/promises';
import { clearQueuedPhoto } from '../services/cloudinary.js';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { summarizeBudget } from '../services/budget-summary.js';
import { countDays, listDates, parseId, sendError, validateTripInput } from '../services/trip-rules.js';

const router = Router();
const signedIn = [requireAuth, requireProfile];
const TRIP_NOT_FOUND = { status: 404, code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' };

const TRIP_COLUMNS = `t.id, t.title,
  DATE_FORMAT(t.start_date, '%Y-%m-%d') AS startDate,
  DATE_FORMAT(t.end_date, '%Y-%m-%d') AS endDate,
  t.group_size AS groupSize, t.budget, t.currency_code AS currencyCode,
  t.share_enabled AS shareEnabled, t.time_zone AS timeZone, t.revision, t.created_at AS createdAt, t.updated_at AS updatedAt`;

export const ACTIVITY_COLUMNS = `a.id, a.trip_id AS tripId,
  DATE_FORMAT(a.activity_date, '%Y-%m-%d') AS date,
  TIME_FORMAT(a.start_time, '%H:%i') AS time, a.duration_minutes AS durationMinutes, a.version,
  a.category, a.title, a.city, a.address,
  a.planned_cost AS plannedCost, a.actual_spend AS actualSpend,
  a.note, a.visited`;

function shapeTrip(row) {
  return { ...row, shareEnabled: Boolean(row.shareEnabled), dayCount: countDays(row.startDate, row.endDate) };
}

export function shapeActivity(row) {
  return { ...row, visited: Boolean(row.visited) };
}

// Ownership is checked in SQL: another user's trip looks exactly like a missing trip.
async function findOwnedTrip(db, tripId, userId, lock = false) {
  const [rows] = await db.execute(
    `SELECT ${TRIP_COLUMNS} FROM trips t WHERE t.id = ? AND t.owner_user_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [tripId, userId],
  );
  return rows[0] ? shapeTrip(rows[0]) : null;
}

export async function findEditableTrip(db, tripId, userId, lock = false) {
  const [rows] = await db.execute(`SELECT ${TRIP_COLUMNS}, t.owner_user_id AS ownerUserId FROM trips t WHERE t.id = ?${lock ? ' FOR UPDATE' : ''}`, [tripId]);
  if (!rows.length) return null;
  const { ownerUserId, ...trip } = rows[0];
  if (Number(ownerUserId) !== Number(userId)) {
    const [members] = await db.execute(`SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id = ?${lock ? ' FOR UPDATE' : ''}`, [tripId, userId]);
    if (!members.length) return null;
  }
  return { ...shapeTrip(trip), role: Number(ownerUserId) === Number(userId) ? 'owner' : 'member' };
}

async function findMissingDestinations(db, destinationIds) {
  const placeholders = destinationIds.map(() => '?').join(', ');
  const [rows] = await db.execute(`SELECT id FROM destinations WHERE id IN (${placeholders})`, destinationIds);
  const found = new Set(rows.map((row) => Number(row.id)));
  return destinationIds.filter((id) => !found.has(id));
}

async function replaceDestinations(db, tripId, destinationIds) {
  await db.execute('DELETE FROM trip_destinations WHERE trip_id = ?', [tripId]);
  for (const [index, destinationId] of destinationIds.entries()) {
    await db.execute(
      'INSERT INTO trip_destinations (trip_id, destination_id, destination_order) VALUES (?, ?, ?)',
      [tripId, destinationId, index + 1],
    );
  }
  await db.execute(
    `DELETE FROM trip_weather_location WHERE trip_id = ? AND NOT EXISTS
       (SELECT 1 FROM trip_destinations td WHERE td.trip_id = ? AND td.destination_id = trip_weather_location.destination_id)`,
    [tripId, tripId],
  );
}

async function loadDestinations(db, tripIds) {
  if (!tripIds.length) return new Map();
  const placeholders = tripIds.map(() => '?').join(', ');
  const [rows] = await db.execute(
    `SELECT td.trip_id AS tripId, d.id, COALESCE(d.local_name, d.name) AS name, d.country, d.region,
            d.map_query AS mapQuery
     FROM trip_destinations td JOIN destinations d ON d.id = td.destination_id
     WHERE td.trip_id IN (${placeholders}) ORDER BY td.trip_id, td.destination_order`,
    tripIds,
  );
  const byTrip = new Map();
  for (const { tripId, ...destination } of rows) {
    byTrip.set(tripId, [...(byTrip.get(tripId) || []), destination]);
  }
  return byTrip;
}

async function loadTripDetail(tripId, userId, db = pool) {
  const trip = await findEditableTrip(db, tripId, userId);
  if (!trip) return null;

  const destinations = (await loadDestinations(db, [trip.id])).get(trip.id) || [];
  const [activityRows] = await db.execute(
    `SELECT ${ACTIVITY_COLUMNS} FROM activities a
     WHERE a.trip_id = ? ORDER BY a.activity_date, a.start_time IS NULL, a.start_time, a.id`,
    [trip.id],
  );
  const activitiesByDate = new Map();
  for (const row of activityRows) {
    activitiesByDate.set(row.date, [...(activitiesByDate.get(row.date) || []), shapeActivity(row)]);
  }

  // One itinerary day per calendar date, start and end included (spec §4).
  const days = listDates(trip.startDate, trip.endDate).map((date, index) => ({
    dayNumber: index + 1,
    date,
    activities: activitiesByDate.get(date) || [],
  }));
  return { ...trip, destinations, days, budgetSummary: summarizeBudget(trip.budget, activityRows) };
}

router.get('/', signedIn, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${TRIP_COLUMNS} FROM trips t WHERE t.owner_user_id = ? OR EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = ?) ORDER BY t.start_date DESC, t.id DESC`,
      [req.userId, req.userId],
    );
    const trips = rows.map(shapeTrip);
    const destinations = await loadDestinations(pool, trips.map((trip) => trip.id));
    res.set('Cache-Control', 'private, no-store')
      .json({ data: trips.map((trip) => ({ ...trip, destinations: destinations.get(trip.id) || [] })) });
  } catch (error) {
    next(error);
  }
});

router.post('/', signedIn, async (req, res, next) => {
  const { value, error } = validateTripInput(req.body);
  if (error) return sendError(res, error);

  const connection = await pool.getConnection();
  try {
    const missing = await findMissingDestinations(connection, value.destinationIds);
    if (missing.length) {
      return sendError(res, { status: 400, code: 'DESTINATION_NOT_FOUND', message: 'One or more destinations do not exist.' });
    }

    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO trips (owner_user_id, title, start_date, end_date, group_size, budget, currency_code, time_zone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, value.title, value.startDate, value.endDate, value.groupSize, value.budget, value.currencyCode, value.timeZone ?? null],
    );
    await replaceDestinations(connection, result.insertId, value.destinationIds);
    const data = await loadTripDetail(result.insertId, req.userId, connection);
    await connection.commit();
    res.status(201).json({ data });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/:tripId/invitations', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Invalid trip ID.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findOwnedTrip(connection, tripId, req.userId, true)) { await connection.rollback(); return sendError(res, TRIP_NOT_FOUND); }
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await connection.execute('DELETE FROM trip_invites WHERE trip_id = ?', [tripId]);
    await connection.execute('INSERT INTO trip_invites (trip_id, token_hash, expires_at) VALUES (?, ?, ?)', [tripId, hash, expiresAt]);
    await connection.commit();
    res.set('Cache-Control', 'no-store').status(201).json({ data: { token, expiresAt: new Date(expiresAt).toISOString() } });
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

router.delete('/:tripId/invitations', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Invalid trip ID.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findOwnedTrip(connection, tripId, req.userId, true)) { await connection.rollback(); return sendError(res, TRIP_NOT_FOUND); }
    await connection.execute('DELETE FROM trip_invites WHERE trip_id = ?', [tripId]);
    await connection.commit();
    res.status(204).end();
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

router.post('/invitations/accept', signedIn, async (req, res, next) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation is unavailable.' } });
  const hash = createHash('sha256').update(token).digest('hex');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [found] = await connection.execute('SELECT trip_id AS tripId FROM trip_invites WHERE token_hash = ?', [hash]);
    if (!found.length) { await connection.rollback(); return res.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation is unavailable.' } }); }
    const tripId = found[0].tripId;
    const [trips] = await connection.execute('SELECT id, owner_user_id AS ownerUserId FROM trips WHERE id = ? FOR UPDATE', [tripId]);
    const [invites] = await connection.execute('SELECT expires_at AS expiresAt FROM trip_invites WHERE trip_id = ? AND token_hash = ? FOR UPDATE', [tripId, hash]);
    if (!trips.length || !invites.length || Number(invites[0].expiresAt) <= Date.now() || Number(trips[0].ownerUserId) === Number(req.userId)) {
      await connection.rollback(); return res.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation is unavailable.' } });
    }
    const [members] = await connection.execute('SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id = ? FOR UPDATE', [tripId, req.userId]);
    if (!members.length) await connection.execute('INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)', [tripId, req.userId]);
    await connection.execute('DELETE FROM trip_invites WHERE trip_id = ?', [tripId]);
    await connection.commit();
    res.json({ data: { tripId } });
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

router.get('/:tripId/members', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Invalid trip ID.' });
  try {
    if (!await findOwnedTrip(pool, tripId, req.userId)) return sendError(res, TRIP_NOT_FOUND);
    const [rows] = await pool.execute('SELECT u.id AS userId, u.display_name AS displayName FROM trip_members m JOIN users u ON u.id = m.user_id WHERE m.trip_id = ? ORDER BY u.id', [tripId]);
    res.set('Cache-Control', 'private, no-store').json({ data: rows });
  } catch (error) { next(error); }
});

router.delete('/:tripId/members/:userId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId), userId = parseId(req.params.userId);
  if (!tripId || !userId) return sendError(res, { status: 400, code: 'INVALID_MEMBER', message: 'Invalid trip or user ID.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findOwnedTrip(connection, tripId, req.userId, true)) { await connection.rollback(); return sendError(res, TRIP_NOT_FOUND); }
    const [members] = await connection.execute('SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id = ? FOR UPDATE', [tripId, userId]);
    if (!members.length) { await connection.rollback(); return res.status(404).json({ error: { code: 'MEMBER_NOT_FOUND', message: 'Member was not found.' } }); }
    await connection.execute('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?', [tripId, userId]);
    await connection.commit();
    res.status(204).end();
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

router.get('/:tripId/version', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  const wait = req.query.wait === '1';
  const since = Number(req.query.since);
  if ((req.query.wait !== undefined && !wait) || (wait && (typeof req.query.since !== 'string' || !/^\d+$/.test(req.query.since) || !Number.isSafeInteger(since)))) {
    return sendError(res, { status: 400, code: 'INVALID_REVISION', message: 'Send a valid trip revision when waiting for changes.' });
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  res.on('close', cancel);
  try {
    const deadline = Date.now() + 8000;
    while (!controller.signal.aborted) {
      const [rows] = await pool.execute(`SELECT t.revision FROM trips t WHERE t.id = ? AND (t.owner_user_id = ? OR EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = ?))`, [tripId, req.userId, req.userId]);
      if (controller.signal.aborted) return;
      if (!rows.length) return sendError(res, TRIP_NOT_FOUND);
      if (!wait || Number(rows[0].revision) !== since || Date.now() >= deadline) {
        return res.set('Cache-Control', 'private, no-store').json({ data: { revision: rows[0].revision }, ...(wait ? { pollAfterMs: 0 } : {}) });
      }
      // shortcut: shared DB checks every second; use managed pub/sub when measured load needs it.
      await delay(Math.min(1000, deadline - Date.now()), undefined, { signal: controller.signal });
    }
  } catch (error) { if (!controller.signal.aborted) next(error); }
  finally { res.off('close', cancel); }
});

router.get('/:tripId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  try {
    const trip = await loadTripDetail(tripId, req.userId);
    if (!trip) return sendError(res, TRIP_NOT_FOUND);
    res.set('Cache-Control', 'private, no-store').json({ data: trip });
  } catch (error) {
    next(error);
  }
});

// Full update: the client sends every editable field, same shape as POST.
router.put('/:tripId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  const { value, error } = validateTripInput(req.body);
  if (error) return sendError(res, error);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const trip = await findEditableTrip(connection, tripId, req.userId, true);
    if (!trip) {
      await connection.rollback();
      return sendError(res, TRIP_NOT_FOUND);
    }

    if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 1) {
      await connection.rollback();
      return sendError(res, { status: 400, code: 'INVALID_REVISION', message: 'Send the trip revision you last read.' });
    }
    if (Number(trip.revision) !== req.body.revision) {
      await connection.rollback();
      return sendError(res, { status: 409, code: 'TRIP_CONFLICT', message: 'This trip changed elsewhere. Reload it and review your changes.' });
    }

    const missing = await findMissingDestinations(connection, value.destinationIds);
    if (missing.length) {
      await connection.rollback();
      return sendError(res, { status: 400, code: 'DESTINATION_NOT_FOUND', message: 'One or more destinations do not exist.' });
    }

    // Shortening a trip must not silently drop planned activities.
    const [outside] = await connection.execute(
      'SELECT COUNT(*) AS total FROM activities WHERE trip_id = ? AND (activity_date < ? OR activity_date > ?)',
      [tripId, value.startDate, value.endDate],
    );
    if (Number(outside[0].total) > 0) {
      await connection.rollback();
      return sendError(res, {
        status: 409,
        code: 'ACTIVITIES_OUTSIDE_DATES',
        message: `${outside[0].total} activity(ies) fall outside the new dates. Move or delete them first.`,
      });
    }

    let timeZone = value.timeZone;
    if (timeZone === undefined && trip.timeZone) {
      const [oldDestinations] = await connection.execute('SELECT destination_id AS id FROM trip_destinations WHERE trip_id = ? ORDER BY destination_order', [tripId]);
      const unchanged = oldDestinations.length === value.destinationIds.length && oldDestinations.every((destination, index) => Number(destination.id) === value.destinationIds[index]);
      timeZone = unchanged ? trip.timeZone : null;
    }
    await connection.execute(
      `UPDATE trips SET title = ?, start_date = ?, end_date = ?, group_size = ?, budget = ?, currency_code = ?, time_zone = ?, revision = revision + 1
       WHERE id = ?`,
      [value.title, value.startDate, value.endDate, value.groupSize, value.budget, value.currencyCode, timeZone ?? null, tripId],
    );
    await replaceDestinations(connection, tripId, value.destinationIds);
    const data = await loadTripDetail(tripId, req.userId, connection);
    await connection.commit();
    res.json({ data });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

router.delete('/:tripId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  const connection = await pool.getConnection();
  let photos;
  try {
    await connection.beginTransaction();
    if (!await findOwnedTrip(connection, tripId, req.userId, true)) {
      await connection.rollback();
      return sendError(res, TRIP_NOT_FOUND);
    }
    [photos] = await connection.execute('SELECT cloudinary_public_id FROM trip_photos WHERE trip_id = ? FOR UPDATE', [tripId]);
    if (photos.length) {
      const placeholders = photos.map(() => '(?)').join(', ');
      await connection.execute(`INSERT INTO pending_photo_deletes (cloudinary_public_id) VALUES ${placeholders}`,
        photos.map((photo) => photo.cloudinary_public_id));
    }
    await connection.execute('DELETE FROM trips WHERE id = ? AND owner_user_id = ?', [tripId, req.userId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    return next(error);
  } finally {
    connection.release();
  }
  await Promise.all(photos.map(({ cloudinary_public_id: id }) => clearQueuedPhoto(id)
    .catch(() => console.error('Trip deleted; photo cleanup pending:', id))));
  res.status(204).end();
});

export default router;
