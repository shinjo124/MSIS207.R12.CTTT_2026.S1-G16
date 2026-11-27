-- Credit for destination photos taken from Wikimedia Commons (via a place in the province).
-- Filled by `npm run provinces:images`.
ALTER TABLE destinations ADD COLUMN image_credit VARCHAR(255) NULL AFTER image_url;
ALTER TABLE destinations ADD COLUMN image_license VARCHAR(100) NULL AFTER image_credit;
ALTER TABLE destinations ADD COLUMN image_page_url VARCHAR(1024) NULL AFTER image_license;
