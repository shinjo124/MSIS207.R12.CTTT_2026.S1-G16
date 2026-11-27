-- Split bill: people on a trip (with or without a Tripo account), who paid each activity,
-- and who shares it. No rows in activity_split_people means the whole group shares it.
CREATE TABLE trip_people (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_trip_people_name (trip_id, name),
  CONSTRAINT fk_trip_people_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_people_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE activities ADD COLUMN paid_by_person_id BIGINT UNSIGNED NULL AFTER actual_spend;
ALTER TABLE activities
  ADD CONSTRAINT fk_activities_paid_by FOREIGN KEY (paid_by_person_id) REFERENCES trip_people(id) ON DELETE SET NULL;

CREATE TABLE activity_split_people (
  activity_id BIGINT UNSIGNED NOT NULL,
  person_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (activity_id, person_id),
  CONSTRAINT fk_split_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  CONSTRAINT fk_split_person FOREIGN KEY (person_id) REFERENCES trip_people(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
