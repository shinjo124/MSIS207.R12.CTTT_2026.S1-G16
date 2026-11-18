-- Existing activities start at version 1; every update advances it.
ALTER TABLE activities ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1;
