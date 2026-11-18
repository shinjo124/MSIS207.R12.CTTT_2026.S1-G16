-- Existing trips retain an unknown time zone until explicitly confirmed.
ALTER TABLE trips ADD COLUMN time_zone VARCHAR(64) NULL;
