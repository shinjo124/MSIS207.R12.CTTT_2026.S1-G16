-- Preserve existing activities with unknown duration.
ALTER TABLE activities ADD COLUMN duration_minutes SMALLINT UNSIGNED NULL;
