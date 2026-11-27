-- Map pins for catalogue places. Filled by `npm run places:geocode` (Geoapify geocoding).
ALTER TABLE places ADD COLUMN latitude DECIMAL(9,6) NULL AFTER map_query;
ALTER TABLE places ADD COLUMN longitude DECIMAL(9,6) NULL AFTER latitude;
