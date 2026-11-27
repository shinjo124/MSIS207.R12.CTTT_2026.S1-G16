-- Photos for catalogue places from Wikimedia Commons, with the credit their licence requires.
-- Filled by `npm run places:images`.
ALTER TABLE places ADD COLUMN image_url VARCHAR(1024) NULL AFTER longitude;
ALTER TABLE places ADD COLUMN image_credit VARCHAR(255) NULL AFTER image_url;
ALTER TABLE places ADD COLUMN image_license VARCHAR(100) NULL AFTER image_credit;
ALTER TABLE places ADD COLUMN image_page_url VARCHAR(1024) NULL AFTER image_license;
