-- Queue existing Cloudinary assets for the normal photo cleanup worker before dropping their records.
INSERT IGNORE INTO pending_photo_deletes (cloudinary_public_id)
SELECT cloudinary_public_id FROM trip_photos;

DROP TABLE trip_photos;
