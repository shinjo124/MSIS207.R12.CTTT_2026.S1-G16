CREATE TABLE trip_weather_location (
  trip_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  destination_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  time_zone VARCHAR(64) NOT NULL,
  CONSTRAINT fk_trip_weather_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_weather_destination FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
