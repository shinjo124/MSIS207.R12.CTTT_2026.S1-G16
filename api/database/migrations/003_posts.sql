CREATE TABLE IF NOT EXISTS posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  author_user_id BIGINT UNSIGNED NOT NULL,
  trip_id BIGINT UNSIGNED NULL,
  place_id BIGINT UNSIGNED NULL,
  body VARCHAR(2000) NOT NULL,
  visibility ENUM('public', 'private') NOT NULL DEFAULT 'public',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_posts_feed (visibility, created_at, id),
  INDEX idx_posts_author (author_user_id, created_at),
  CONSTRAINT fk_posts_author FOREIGN KEY (author_user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_trip FOREIGN KEY (trip_id)
    REFERENCES trips (id) ON DELETE SET NULL,
  CONSTRAINT fk_posts_place FOREIGN KEY (place_id)
    REFERENCES places (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(2048) NOT NULL,
  alt_text VARCHAR(255) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_post_photo_order (post_id, sort_order),
  CONSTRAINT fk_post_photos_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_likes (
  post_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  INDEX idx_post_likes_user (user_id),
  CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_post_comments_order (post_id, created_at, id),
  CONSTRAINT fk_post_comments_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_comments_author FOREIGN KEY (author_user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
