CREATE TABLE IF NOT EXISTS trip_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(2048) NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  caption VARCHAR(500) NULL,
  location_text VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_trip_photos_cloudinary_id (cloudinary_public_id),
  INDEX idx_trip_photos_trip_created (trip_id, created_at),
  CONSTRAINT fk_trip_photos_trip FOREIGN KEY (trip_id)
    REFERENCES trips (id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_photos_owner FOREIGN KEY (owner_user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
