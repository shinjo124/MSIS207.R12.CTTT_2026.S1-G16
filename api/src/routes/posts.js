import { fileTypeFromBuffer } from 'file-type';
import { getAuth } from '@clerk/express';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { uploadImage } from '../middleware/image-upload.js';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { sharedWriteLimit } from '../middleware/shared-write-limit.js';
import { deleteCloudinaryImage, isCloudinaryConfigured, uploadCloudinaryImage } from '../services/cloudinary.js';
import { parseId } from '../services/trip-rules.js';

const router = Router();
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'UPLOAD_LIMITED', message: 'Too many photo uploads. Try again later.' } },
});
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const postWriteLimit = sharedWriteLimit('post', 15, 100);
const sharedUploadLimit = sharedWriteLimit('upload', 10, 40);

function validatePostId(req, res, next) {
  if (!parseId(req.params.id)) {
    return res.status(400).json({ error: { code: 'INVALID_POST_ID', message: 'Post ID must be a positive integer.' } });
  }
  next();
}

function validateComment(req, res, next) {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!parseId(req.params.id) || !body || body.length > 1000) {
    return res.status(400).json({ error: { code: 'INVALID_COMMENT', message: 'Post ID or comment text is invalid.' } });
  }
  req.commentBody = body;
  next();
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

function postPhotoPublicId(imageUrl) {
  try {
    const url = new URL(imageUrl);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const marker = `/${cloudName}/image/upload/`;
    if (!cloudName || url.hostname !== 'res.cloudinary.com' || !url.pathname.includes(marker)) return null;
    const folder = '/tripo/post-photos/';
    const folderIndex = url.pathname.lastIndexOf(folder);
    if (folderIndex < 0) return null;
    const asset = decodeURIComponent(url.pathname.slice(folderIndex + folder.length)).replace(/\.[a-z0-9]+$/i, '');
    return /^[\w.-]+$/.test(asset) ? `tripo/post-photos/${asset}` : null;
  } catch {
    return null;
  }
}

// Columns for the place a story links to (and that place's destination); all NULL when no place is linked.
const PLACE_COLUMNS = `pl.name AS placeName, pl.category AS placeCategory, pl.address AS placeAddress,
              pl.map_query AS placeMapQuery, d.id AS destinationId, COALESCE(d.local_name, d.name) AS destinationName, d.region AS destinationRegion`;
const PLACE_JOINS = 'LEFT JOIN places pl ON pl.id = p.place_id LEFT JOIN destinations d ON d.id = pl.destination_id';

function shapePlace({ placeName, placeCategory, placeAddress, placeMapQuery, destinationId, destinationName, destinationRegion, ...post }) {
  return {
    ...post,
    place: post.placeId && placeName ? {
      id: post.placeId,
      name: placeName,
      category: placeCategory,
      address: placeAddress,
      mapQuery: placeMapQuery,
      destination: destinationId ? { id: destinationId, name: destinationName, region: destinationRegion } : null,
    } : null,
  };
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

router.get('/mine', requireAuth, requireProfile, async (req, res, next) => {
  try {
    const [posts] = await pool.execute(
      `SELECT p.id, p.body, p.visibility, p.created_at AS createdAt,
              p.trip_id AS tripId, p.place_id AS placeId,
              (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likesCount,
              (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS commentsCount,
              ${PLACE_COLUMNS}
       FROM posts p ${PLACE_JOINS} WHERE p.author_user_id = ?
       ORDER BY p.created_at DESC, p.id DESC LIMIT 50`,
      [req.userId],
    );
    res.json({ data: await addPhotos(posts.map(shapePlace)) });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 20);
  const page = Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), 1000);
  const offset = (page - 1) * limit;
  const viewer = process.env.CLERK_SECRET_KEY ? getAuth(req).userId : null;

  try {
    const [posts] = await pool.execute(
      `SELECT p.id, p.body, p.created_at AS createdAt, p.trip_id AS tripId,
              p.place_id AS placeId, u.display_name AS author, u.avatar_url AS authorAvatar,
              (u.clerk_user_id = ?) AS isAuthor,
              EXISTS(SELECT 1 FROM post_likes l JOIN users v ON v.id = l.user_id
                     WHERE l.post_id = p.id AND v.clerk_user_id = ?) AS liked,
              (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likesCount,
              (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS commentsCount,
              ${PLACE_COLUMNS}
       FROM posts p JOIN users u ON u.id = p.author_user_id ${PLACE_JOINS}
       WHERE p.visibility = 'public'
       ORDER BY p.created_at DESC, p.id DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      [viewer ?? null, viewer ?? null],
    );

    const data = posts.slice(0, limit).map((post) => shapePlace({ ...post, isAuthor: Boolean(post.isAuthor), liked: Boolean(post.liked) }));
    res.set('Cache-Control', 'private, no-store').json({ data: await addPhotos(data), page, limit, hasMore: posts.length > limit && page < 1000 });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireProfile, postWriteLimit, (req, res, next) => (
  req.is('multipart/form-data') ? uploadLimiter(req, res, next) : next()
), (req, res, next) => (
  req.is('multipart/form-data') ? sharedUploadLimit(req, res, next) : next()
), uploadImage, async (req, res, next) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  const visibility = req.body.visibility || 'public';
  const tripId = req.body.tripId == null ? null : Number(req.body.tripId);
  const placeId = req.body.placeId == null ? null : Number(req.body.placeId);
  const photos = Array.isArray(req.body.photos) ? [...req.body.photos] : req.body.photos ?? [];
  const altText = typeof req.body.altText === 'string' ? req.body.altText.trim() : '';

  if (!body || body.length > 2000 || !['public', 'private'].includes(visibility)
      || !Array.isArray(photos) || photos.length > 5 || !photos.every(validatePhoto)
      || (req.file && (!altText || altText.length > 255 || photos.length >= 5))
      || (tripId !== null && !parseId(tripId))
      || (placeId !== null && !parseId(placeId))) {
    return res.status(400).json({
      error: { code: 'INVALID_POST', message: 'Check the post text, visibility, optional links, and photos.' },
    });
  }

  if (/([^\p{L}\p{N}\s])\1{2,}/u.test(body)) {
    return res.status(400).json({ error: { code: 'INVALID_POST_TEXT', message: 'Please remove repeated punctuation from the story text.' } });
  }

  if (req.file) {
    const fileType = await fileTypeFromBuffer(req.file.buffer);
    if (!fileType || !ALLOWED_TYPES.has(fileType.mime)) {
      return res.status(415).json({ error: { code: 'UNSUPPORTED_IMAGE', message: 'Use a JPEG, PNG, or WebP image.' } });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ error: { code: 'PHOTO_STORAGE_NOT_CONFIGURED', message: 'Photo storage is not configured.' } });
    }
  }

  let uploadedImage;
  let photoCommitted = false;
  try {
    const userId = req.userId;

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

    if (req.file) {
      uploadedImage = await uploadCloudinaryImage(req.file.buffer, 'tripo/post-photos');
      photos.push({ url: uploadedImage.secure_url, altText });
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
      photoCommitted = true;
      res.status(201).json({ data: { id: result.insertId, body, visibility, photos } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (uploadedImage && !photoCommitted) {
      await deleteCloudinaryImage(uploadedImage.public_id).catch(() => {});
    }
    next(error);
  }
});

router.delete('/:id', requireAuth, validatePostId, requireProfile, async (req, res, next) => {
  const connection = await pool.getConnection();
  let photoIds = [];
  try {
    await connection.beginTransaction();
    const [posts] = await connection.execute(
      'SELECT id FROM posts WHERE id = ? AND author_user_id = ? FOR UPDATE',
      [req.params.id, req.userId],
    );
    if (!posts.length) {
      await connection.rollback();
      return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post was not found.' } });
    }
    const [photos] = await connection.execute('SELECT image_url AS imageUrl FROM post_photos WHERE post_id = ? FOR UPDATE', [req.params.id]);
    photoIds = [...new Set(photos.map(({ imageUrl }) => postPhotoPublicId(imageUrl)).filter(Boolean))];
    if (photoIds.length) {
      const placeholders = photoIds.map(() => '(?)').join(', ');
      await connection.execute(`INSERT INTO pending_photo_deletes (cloudinary_public_id) VALUES ${placeholders}`, photoIds);
    }
    await connection.execute('DELETE FROM posts WHERE id = ? AND author_user_id = ?', [req.params.id, req.userId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    return next(error);
  } finally {
    connection.release();
  }
  await Promise.all(photoIds.map((id) => clearQueuedPhoto(id)
    .catch(() => console.error('Post deleted; photo cleanup pending:', id))));
  res.status(204).end();
});

router.patch('/:id', requireAuth, validatePostId, requireProfile, async (req, res, next) => {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 2000) {
    return res.status(400).json({ error: { code: 'INVALID_POST', message: 'Story text is required and must be 2000 characters or fewer.' } });
  }
  if (/([^\p{L}\p{N}\s])\1{2,}/u.test(body)) {
    return res.status(400).json({ error: { code: 'INVALID_POST_TEXT', message: 'Please remove repeated punctuation from the story text.' } });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [posts] = await connection.execute(
      'SELECT id FROM posts WHERE id = ? AND author_user_id = ? FOR UPDATE',
      [req.params.id, req.userId],
    );
    if (!posts.length) {
      await connection.rollback();
      return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post was not found.' } });
    }
    await connection.execute('UPDATE posts SET body = ? WHERE id = ? AND author_user_id = ?', [body, req.params.id, req.userId]);
    await connection.commit();
    res.set('Cache-Control', 'private, no-store').json({ data: { body } });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

async function sendLikeResult(req, res, userId) {
  if (req.query.summary !== '1') return res.status(204).end();
  const [[row]] = await pool.execute(
    `SELECT COUNT(l.user_id) AS likesCount, COUNT(CASE WHEN l.user_id = ? THEN 1 END) AS liked
     FROM posts p LEFT JOIN post_likes l ON l.post_id = p.id
     WHERE p.id = ? AND p.visibility = 'public' GROUP BY p.id`,
    [userId, req.params.id],
  );
  if (!row) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post was not found.' } });
  res.set('Cache-Control', 'private, no-store').json({ data: { likesCount: Number(row.likesCount), liked: Boolean(Number(row.liked)) } });
}

router.post('/:id/likes', requireAuth, validatePostId, requireProfile, async (req, res, next) => {
  try {
    const [posts] = await pool.execute("SELECT id FROM posts WHERE id = ? AND visibility = 'public'", [req.params.id]);
    if (!posts.length) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post was not found.' } });
    await pool.execute('INSERT IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)', [req.params.id, req.userId]);
    await sendLikeResult(req, res, req.userId);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/likes', requireAuth, validatePostId, requireProfile, async (req, res, next) => {
  try {
    await pool.execute('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.id, req.userId]);
    await sendLikeResult(req, res, req.userId);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/comments', async (req, res, next) => {
  if (!parseId(req.params.id)) {
    return res.status(400).json({ error: { code: 'INVALID_POST_ID', message: 'Post ID must be a positive integer.' } });
  }
  try {
    const [posts] = await pool.execute("SELECT id FROM posts WHERE id = ? AND visibility = 'public'", [req.params.id]);
    if (!posts.length) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post was not found.' } });
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 100);
    const offset = Number(req.query.offset ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10_000) return res.status(400).json({ error: { code: 'INVALID_OFFSET', message: 'Invalid comment offset.' } });
    const [comments] = await pool.execute(
      `SELECT c.id, c.body, c.created_at AS createdAt, u.display_name AS author
       FROM post_comments c JOIN users u ON u.id = c.author_user_id
       WHERE c.post_id = ? ORDER BY c.created_at, c.id LIMIT ${limit + 1} OFFSET ${offset}`,
      [req.params.id],
    );
    res.json({ data: comments.slice(0, limit), nextOffset: comments.length > limit ? offset + limit : null });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comments', requireAuth, validateComment, requireProfile, async (req, res, next) => {
  try {
    const [posts] = await pool.execute("SELECT id FROM posts WHERE id = ? AND visibility = 'public'", [req.params.id]);
    if (!posts.length) return res.status(404).json({ error: { code: 'POST_NOT_FOUND', message: 'Post was not found.' } });
    const [[author]] = await pool.execute('SELECT display_name AS author FROM users WHERE id = ?', [req.userId]);
    const [result] = await pool.execute(
      'INSERT INTO post_comments (post_id, author_user_id, body) VALUES (?, ?, ?)',
      [req.params.id, req.userId, req.commentBody],
    );
    res.status(201).json({ data: { id: result.insertId, body: req.commentBody, author: author.author } });
  } catch (error) {
    next(error);
  }
});

export default router;
