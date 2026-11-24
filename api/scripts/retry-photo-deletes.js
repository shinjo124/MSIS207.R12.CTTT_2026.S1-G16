import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { clearQueuedPhoto } from '../src/services/cloudinary.js';

try {
  // Retry remote cleanup separately from trip and story deletion. Failed rows stay queued.
  const [photos] = await pool.query('SELECT cloudinary_public_id FROM pending_photo_deletes ORDER BY queued_at');
  for (const photo of photos) {
    try {
      await clearQueuedPhoto(photo.cloudinary_public_id);
    } catch {
      console.error('Photo cleanup still pending:', photo.cloudinary_public_id);
      process.exitCode = 1;
    }
  }
} finally {
  await pool.end();
}
