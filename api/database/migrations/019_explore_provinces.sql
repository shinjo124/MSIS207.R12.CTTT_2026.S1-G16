-- Explore page: mark the 34 provincial-level units (2025 map), add Vietnamese summaries
-- and the former provinces each unit now includes.
ALTER TABLE destinations ADD COLUMN admin_level VARCHAR(20) NULL AFTER category;
ALTER TABLE destinations ADD COLUMN merged_from VARCHAR(255) NULL AFTER admin_level;
ALTER TABLE destinations ADD COLUMN summary_vi VARCHAR(500) NULL AFTER summary;
ALTER TABLE destinations ADD INDEX idx_destinations_admin_level (admin_level);
ALTER TABLE places ADD COLUMN summary_vi VARCHAR(500) NULL AFTER summary;
