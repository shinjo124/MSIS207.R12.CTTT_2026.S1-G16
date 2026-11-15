import { fileTypeFromBuffer } from 'file-type';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { uploadImage } from '../middleware/image-upload.js';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { deleteCloudinaryImage, isCloudinaryConfigured, uploadCloudinaryImage } from '../services/cloudinary.js';
import { findLocalUserId } from '../services/profiles.js';

const router = Router();
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'UPLOAD_LIMITED', message: 'Too many photo uploads. Try again later.' } },
});
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

router.post('/', requireAuth, uploadLimiter, uploadImage, async (req, res, next) => {
  const tripId = Number(req.body.tripId);
  if (!Number.isSafeInteger(tripId) || tripId < 1 || !req.file) {
    return res.status(400).json({ error: { code: 'INVALID_PHOTO', message: 'Choose an image and a valid trip.' } });
  }
  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim() : '';
  const locationText = typeof req.body.locationText === 'string' ? req.body.locationText.trim() : '';
  if (caption.length > 500 || locationText.length > 255) {
    return res.status(400).json({ error: { code: 'INVALID_PHOTO_DETAILS', message: 'Caption or location is too long.' } });
  }

  const fileType = await fileTypeFromBuffer(req.file.buffer);
  if (!fileType || !ALLOWED_TYPES.has(fileType.mime)) {
    return res.status(415).json({ error: { code: 'UNSUPPORTED_IMAGE', message: 'Use a JPEG, PNG, or WebP image.' } });
  }
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({ error: { code: 'PHOTO_STORAGE_NOT_CONFIGURED', message: 'Photo storage is not configured.' } });
  }

  let connection;
  let uploaded;
  let committing = false;
  try {
    const userId = await findLocalUserId(req.clerkUserId);
    if (!userId) return res.status(409).json({ error: { code: 'PROFILE_NOT_READY', message: 'Load your profile before uploading photos.' } });
    const [owned] = await pool.execute(
      'SELECT (SELECT COUNT(*) FROM trip_photos WHERE trip_id = t.id) AS total FROM trips t WHERE t.id = ? AND owner_user_id = ?',
      [tripId, userId],
    );
    if (!owned.length) return res.status(404).json({ error: { code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' } });
    if (owned[0].total >= 25) return res.status(409).json({ error: { code: 'TRIP_PHOTO_LIMIT', message: 'This trip has reached its 25-photo limit.' } });
    uploaded = await uploadCloudinaryImage(req.file.buffer, 'tripo/trip-photos');
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [trips] = await connection.execute('SELECT id FROM trips WHERE id = ? AND owner_user_id = ? FOR UPDATE', [tripId, userId]);
    if (!trips.length) {
      throw Object.assign(new Error('Trip was not found.'), { status: 404, code: 'TRIP_NOT_FOUND' });
    }
    // TiDB snapshot reads can predate the wait for the parent lock. Use a current read.
    const [photos] = await connection.execute('SELECT id FROM trip_photos WHERE trip_id = ? FOR UPDATE', [tripId]);
    if (photos.length >= 25) {
      throw Object.assign(new Error('This trip has reached its 25-photo limit.'), { status: 409, code: 'TRIP_PHOTO_LIMIT' });
    }
    const [result] = await connection.execute(
      `INSERT INTO trip_photos
         (trip_id, owner_user_id, image_url, cloudinary_public_id, caption, location_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tripId, userId, uploaded.secure_url, uploaded.public_id, caption || null, locationText || null],
    );
    committing = true;
    await connection.commit();
    res.status(201).json({
      data: {
        id: result.insertId,
        imageUrl: uploaded.secure_url,
        caption: caption || null,
        locationText: locationText || null,
      },
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    connection?.release();
    connection = null;
    if (uploaded && !committing) await deleteCloudinaryImage(uploaded.public_id).catch(() => console.error('Trip photo cleanup failed', uploaded.public_id));
    if (error.code === 'TRIP_PHOTO_LIMIT' || error.code === 'TRIP_NOT_FOUND') {
      return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    }
    next(error);
  } finally {
    connection?.release();
  }
});

export default router;
