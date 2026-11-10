CREATE TABLE IF NOT EXISTS trips (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  group_size SMALLINT UNSIGNED NOT NULL,
  budget DECIMAL(12,2) UNSIGNED NOT NULL DEFAULT 0,
  currency_code CHAR(3) NOT NULL,
  share_token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  share_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_trips_share_token (share_token),
  INDEX idx_trips_owner_start (owner_user_id, start_date),
  CONSTRAINT fk_trips_owner FOREIGN KEY (owner_user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_trips_date_order CHECK (end_date >= start_date),
  CONSTRAINT chk_trips_group_size CHECK (group_size > 0),
  CONSTRAINT chk_trips_share_state CHECK (
    (share_enabled = 0 AND share_token IS NULL) OR
    (share_enabled = 1 AND share_token IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trip_destinations (
  trip_id BIGINT UNSIGNED NOT NULL,
  destination_id BIGINT UNSIGNED NOT NULL,
  destination_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (trip_id, destination_id),
  UNIQUE KEY uq_trip_destination_order (trip_id, destination_order),
  INDEX idx_trip_destinations_destination (destination_id),
  CONSTRAINT fk_trip_destinations_trip FOREIGN KEY (trip_id)
    REFERENCES trips (id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_destinations_destination FOREIGN KEY (destination_id)
    REFERENCES destinations (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
