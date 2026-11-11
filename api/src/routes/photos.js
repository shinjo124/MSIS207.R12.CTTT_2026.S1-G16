import { fileTypeFromBuffer } from 'file-type';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { deleteCloudinaryImage, isCloudinaryConfigured, uploadCloudinaryImage } from '../services/cloudinary.js';
import { findLocalUserId } from '../services/profiles.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'UPLOAD_LIMITED', message: 'Too many photo uploads. Try again later.' } },
});
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

router.post('/', requireAuth, uploadLimiter, upload.single('image'), async (req, res, next) => {
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

  try {
    const userId = await findLocalUserId(req.clerkUserId);
    if (!userId) {
      return res.status(409).json({ error: { code: 'PROFILE_NOT_READY', message: 'Load your profile before uploading photos.' } });
    }
    const [trips] = await pool.execute(
      `SELECT t.id FROM trips t JOIN users u ON u.id = t.owner_user_id
       WHERE t.id = ? AND u.clerk_user_id = ?`,
      [tripId, req.clerkUserId],
    );
    if (!trips.length) {
      return res.status(404).json({ error: { code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' } });
    }

    const [counts] = await pool.execute('SELECT COUNT(*) AS total FROM trip_photos WHERE trip_id = ?', [tripId]);
    if (Number(counts[0].total) >= 25) {
      return res.status(409).json({ error: { code: 'TRIP_PHOTO_LIMIT', message: 'This trip has reached its 25-photo limit.' } });
    }

    const uploaded = await uploadCloudinaryImage(req.file.buffer, 'tripo/trip-photos');
    try {
      const [result] = await pool.execute(
        `INSERT INTO trip_photos
           (trip_id, owner_user_id, image_url, cloudinary_public_id, caption, location_text)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tripId, userId, uploaded.secure_url, uploaded.public_id, caption || null, locationText || null],
      );
      res.status(201).json({
        data: {
          id: result.insertId,
          imageUrl: uploaded.secure_url,
          caption: caption || null,
          locationText: locationText || null,
        },
      });
    } catch (error) {
      await deleteCloudinaryImage(uploaded.public_id).catch(() => {});
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
