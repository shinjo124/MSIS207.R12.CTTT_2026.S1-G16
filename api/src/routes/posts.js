import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { findLocalUserId } from '../services/profiles.js';

const router = Router();
const isPositiveId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

async function requireProfile(req, res) {
  const userId = await findLocalUserId(req.clerkUserId);
  if (!userId) {
    res.status(409).json({
      error: { code: 'PROFILE_NOT_READY', message: 'Load your profile before continuing.' },
    });
    return null;
  }
  return userId;
}

function validatePhoto(photo) {
  if (!photo || typeof photo.url !== 'string' || typeof photo.altText !== 'string') return false;
  if (!photo.altText.trim() || photo.altText.trim().length > 255) return false;
  try {
    const url = new URL(photo.url);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
}

async function addPhotos(posts) {
  if (!posts.length) return posts;
  const ids = posts.map((post) => post.id);
  const placeholders = ids.map(() => '?').join(', ');
  const [photos] = await pool.execute(
    `SELECT id, post_id AS postId, image_url AS imageUrl, alt_text AS altText, sort_order AS sortOrder
     FROM post_photos WHERE post_id IN (${placeholders}) ORDER BY sort_order`,
    ids,
  );
  const photosByPost = new Map();
  for (const photo of photos) {
    const items = photosByPost.get(photo.postId) || [];
    items.push(photo);
    photosByPost.set(photo.postId, items);
  }
  return posts.map((post) => ({ ...post, photos: photosByPost.get(post.id) || [] }));
}

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const userId = await requireProfile(req, res);
    if (!userId) return;
    const [posts] = await pool.execute(
      `SELECT p.id, p.body, p.visibility, p.created_at AS createdAt,
              p.trip_id AS tripId, p.place_id AS placeId,
              (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likesCount,
              (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS commentsCount
       FROM posts p WHERE p.author_user_id = ?
       ORDER BY p.created_at DESC, p.id DESC LIMIT 50`,
      [userId],
    );
    res.json({ data: await addPhotos(posts) });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 20);
  const page = Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), 10000);
  const offset = (page - 1) * limit;

  try {
    const [posts] = await pool.execute(
      `SELECT p.id, p.body, p.created_at AS createdAt, p.trip_id AS tripId,
              p.place_id AS placeId, u.display_name AS author,
              (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likesCount,
              (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS commentsCount
       FROM posts p JOIN users u ON u.id = p.author_user_id
       WHERE p.visibility = 'public'
       ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    res.json({ data: await addPhotos(posts), page, limit });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  const visibility = req.body.visibility || 'public';
  const tripId = req.body.tripId == null ? null : Number(req.body.tripId);
  const placeId = req.body.placeId == null ? null : Number(req.body.placeId);
  const photos = req.body.photos ?? [];

  if (!body || body.length > 2000 || !['public', 'private'].includes(visibility)
      || !Array.isArray(photos) || photos.length > 5 || !photos.every(validatePhoto)
      || (tripId !== null && !isPositiveId(tripId))
      || (placeId !== null && !isPositiveId(placeId))) {
    return res.status(400).json({
      error: { code: 'INVALID_POST', message: 'Check the post text, visibility, optional links, and photos.' },
    });
  }

  try {
    const userId = await requireProfile(req, res);
    if (!userId) return;

    if (tripId !== null) {
      const [ownedTrips] = await pool.execute(
        `SELECT t.id FROM trips t JOIN users u ON u.id = t.owner_user_id
         WHERE t.id = ? AND u.clerk_user_id = ?`,
        [tripId, req.clerkUserId],
      );
      if (!ownedTrips.length) {
        return res.status(404).json({ error: { code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' } });
      }
    }
    if (placeId !== null) {
      const [places] = await pool.execute('SELECT id FROM places WHERE id = ?', [placeId]);
      if (!places.length) {
        return res.status(404).json({ error: { code: 'PLACE_NOT_FOUND', message: 'Place was not found.' } });
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        'INSERT INTO posts (author_user_id, trip_id, place_id, body, visibility) VALUES (?, ?, ?, ?, ?)',
        [userId, tripId, placeId, body, visibility],
      );
      for (const [sortOrder, photo] of photos.entries()) {
        await connection.execute(
          'INSERT INTO post_photos (post_id, image_url, alt_text, sort_order) VALUES (?, ?, ?, ?)',
          [result.insertId, photo.url, photo.altText.trim(), sortOrder],
        );
      }
      await connection.commit();
      res.status(201).json({ data: { id: result.insertId, body, visibility, photos } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/:id/likes', requireAuth, async (req, res, next) => {
  if (!isPositiveId(req.params.id)) {
    return res.status(400).json({ error: { code: 'INVALID_POST_ID', message: 'Post ID must be a positive integer.' } });
  }
  try {
    const userId = await requireProfile(req, res);
    if (!userId) return;
    const [posts] = await pool.execute("SELECT id FROM posts WHERE id = ? AND visibility = 'public'", [req.params.id]);
    if (!posts.length) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post was not found.' } });
    await pool.execute('INSERT IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)', [req.params.id, userId]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/likes', requireAuth, async (req, res, next) => {
  if (!isPositiveId(req.params.id)) {
    return res.status(400).json({ error: { code: 'INVALID_POST_ID', message: 'Post ID must be a positive integer.' } });
  }
  try {
    const userId = await requireProfile(req, res);
    if (!userId) return;
    await pool.execute('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.id, userId]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/:id/comments', async (req, res, next) => {
  if (!isPositiveId(req.params.id)) {
    return res.status(400).json({ error: { code: 'INVALID_POST_ID', message: 'Post ID must be a positive integer.' } });
  }
  try {
    const [posts] = await pool.execute("SELECT id FROM posts WHERE id = ? AND visibility = 'public'", [req.params.id]);
    if (!posts.length) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post was not found.' } });
    const [comments] = await pool.execute(
      `SELECT c.id, c.body, c.created_at AS createdAt, u.display_name AS author
       FROM post_comments c JOIN users u ON u.id = c.author_user_id
       WHERE c.post_id = ? ORDER BY c.created_at, c.id LIMIT 100`,
      [req.params.id],
    );
    res.json({ data: comments });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comments', requireAuth, async (req, res, next) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!isPositiveId(req.params.id) || !body || body.length > 1000) {
    return res.status(400).json({ error: { code: 'INVALID_COMMENT', message: 'Post ID or comment text is invalid.' } });
  }
  try {
    const userId = await requireProfile(req, res);
    if (!userId) return;
    const [posts] = await pool.execute("SELECT id FROM posts WHERE id = ? AND visibility = 'public'", [req.params.id]);
    if (!posts.length) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post was not found.' } });
    const [result] = await pool.execute(
      'INSERT INTO post_comments (post_id, author_user_id, body) VALUES (?, ?, ?)',
      [req.params.id, userId, body],
    );
    res.status(201).json({ data: { id: result.insertId, body } });
  } catch (error) {
    next(error);
  }
});

export default router;
