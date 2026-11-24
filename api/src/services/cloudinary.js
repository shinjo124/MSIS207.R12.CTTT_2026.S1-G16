import { v2 as cloudinary } from 'cloudinary';
import { pool } from '../db/pool.js';
import { Readable } from 'node:stream';

export function isCloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET);
}

function configure() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Stream the in-memory image to Cloudinary and cap its dimensions for display.
export function uploadCloudinaryImage(buffer, folder) {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: 'image',
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 2400, height: 2400, crop: 'limit' }],
    }, (error, result) => {
      if (error) reject(error);
      else if (!result?.secure_url || !result.public_id) reject(new Error('Cloudinary returned an invalid upload result.'));
      else resolve(result);
    });
    Readable.from([buffer]).pipe(stream);
  });
}

export async function deleteCloudinaryImage(publicId) {
  configure();
  const { result } = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  if (result !== 'ok' && result !== 'not found') throw new Error('Photo deletion failed');
}

// Remove the queue row only after Cloudinary confirms the image is gone.
export async function clearQueuedPhoto(publicId) {
  await deleteCloudinaryImage(publicId);
  await pool.execute('DELETE FROM pending_photo_deletes WHERE cloudinary_public_id = ?', [publicId]);
}
