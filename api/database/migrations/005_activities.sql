-- T6: itinerary activities. Days are not stored: a trip has one day per calendar date
-- from start_date to end_date (inclusive), and each activity belongs to one of those dates.
-- See D-007 in docs/decisions.md.
CREATE TABLE IF NOT EXISTS activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  activity_date DATE NOT NULL,
  start_time TIME NULL,
  category VARCHAR(20) NOT NULL,
  title VARCHAR(160) NOT NULL,
  city VARCHAR(120) NULL,
  address VARCHAR(255) NULL,
  planned_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  actual_spend DECIMAL(12,2) NULL,
  note VARCHAR(1000) NULL,
  visited TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_activities_trip_date (trip_id, activity_date, start_time),
  CONSTRAINT fk_activities_trip FOREIGN KEY (trip_id)
    REFERENCES trips (id) ON DELETE CASCADE,
  CONSTRAINT chk_activities_category CHECK (
    category IN ('sightseeing', 'food_drink', 'accommodation', 'transport', 'shopping', 'other')
  ),
  CONSTRAINT chk_activities_planned_cost CHECK (planned_cost >= 0),
  -- NULL actual_spend means "not recorded yet"; it is not treated as 0 when stored.
  CONSTRAINT chk_activities_actual_spend CHECK (actual_spend IS NULL OR actual_spend >= 0),
  CONSTRAINT chk_activities_visited CHECK (visited IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
