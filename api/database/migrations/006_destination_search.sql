-- Destination search: Vietnamese display names, search aliases, and a "featured" flag.
-- Run once (MySQL 8 has no ADD COLUMN IF NOT EXISTS).
-- Existing rows default to featured = 1, so the home page keeps showing the original
-- curated cards; seed 003 adds every province and popular spot with featured = 0.
ALTER TABLE destinations
  ADD COLUMN local_name VARCHAR(120) NULL AFTER name,
  ADD COLUMN aliases VARCHAR(255) NULL AFTER local_name,
  ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 1 AFTER aliases;
