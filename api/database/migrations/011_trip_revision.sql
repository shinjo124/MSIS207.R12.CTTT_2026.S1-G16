-- Every committed trip-detail change advances this revision.
ALTER TABLE trips ADD COLUMN revision INT UNSIGNED NOT NULL DEFAULT 1;
