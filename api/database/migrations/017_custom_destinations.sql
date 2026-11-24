ALTER TABLE destinations ADD COLUMN custom_trip_id BIGINT UNSIGNED NULL;
ALTER TABLE destinations ADD COLUMN destination_scope BIGINT UNSIGNED GENERATED ALWAYS AS (COALESCE(custom_trip_id, 0)) VIRTUAL;
ALTER TABLE destinations
  ADD UNIQUE KEY uq_destinations_scoped_name (destination_scope, name, country),
  ADD INDEX idx_destinations_custom_trip (custom_trip_id);
ALTER TABLE destinations DROP INDEX uq_destinations_name_country;

-- A trip can cascade through both its custom destinations and its itinerary and weather links.
ALTER TABLE trip_destinations DROP FOREIGN KEY fk_trip_destinations_destination;
ALTER TABLE trip_destinations
  ADD CONSTRAINT fk_trip_destinations_destination FOREIGN KEY (destination_id)
  REFERENCES destinations(id) ON DELETE CASCADE;
ALTER TABLE trip_weather_location DROP FOREIGN KEY fk_trip_weather_destination;
ALTER TABLE trip_weather_location
  ADD CONSTRAINT fk_trip_weather_destination FOREIGN KEY (destination_id)
  REFERENCES destinations(id) ON DELETE CASCADE;
ALTER TABLE destinations
  ADD CONSTRAINT fk_destinations_custom_trip FOREIGN KEY (custom_trip_id) REFERENCES trips(id) ON DELETE CASCADE;
