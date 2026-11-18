ALTER TABLE destinations
  ADD COLUMN latitude DECIMAL(9,6) NULL AFTER image_url,
  ADD COLUMN longitude DECIMAL(9,6) NULL AFTER latitude,
  ADD COLUMN time_zone VARCHAR(64) NULL AFTER longitude;

UPDATE destinations SET latitude = 21.02851, longitude = 105.85420, time_zone = 'Asia/Ho_Chi_Minh' WHERE name IN ('Hanoi', 'Ha Noi');
UPDATE destinations SET latitude = 16.05441, longitude = 108.20217, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Da Nang';
UPDATE destinations SET latitude = 15.88006, longitude = 108.33805, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Hoi An';
UPDATE destinations SET latitude = 20.91005, longitude = 107.18390, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Ha Long Bay';
UPDATE destinations SET latitude = 11.94646, longitude = 108.44193, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Da Lat';
UPDATE destinations SET latitude = 10.82302, longitude = 106.62965, time_zone = 'Asia/Ho_Chi_Minh' WHERE name IN ('Ho Chi Minh City', 'Ho Chi Minh');
UPDATE destinations SET latitude = 16.46371, longitude = 107.59086, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Hue';
UPDATE destinations SET latitude = 20.84491, longitude = 106.68808, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Hai Phong';
UPDATE destinations SET latitude = 10.04516, longitude = 105.74685, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Can Tho';
UPDATE destinations SET latitude = 22.33636, longitude = 103.84379, time_zone = 'Asia/Ho_Chi_Minh' WHERE name IN ('Sa Pa', 'Sapa');
UPDATE destinations SET latitude = 23.10790, longitude = 105.10990, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Ha Giang';
UPDATE destinations SET latitude = 20.25061, longitude = 105.97445, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Ninh Binh';
UPDATE destinations SET latitude = 12.23879, longitude = 109.19675, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Nha Trang';
UPDATE destinations SET latitude = 10.28988, longitude = 103.98402, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Phu Quoc';
UPDATE destinations SET latitude = 13.78200, longitude = 109.21960, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Quy Nhon';
UPDATE destinations SET latitude = 10.93300, longitude = 108.28300, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Mui Ne';
UPDATE destinations SET latitude = 20.72779, longitude = 105.20113, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Mai Chau';
UPDATE destinations SET latitude = 17.59000, longitude = 106.28300, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Phong Nha';
UPDATE destinations SET latitude = 20.72600, longitude = 107.04800, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Cat Ba';
UPDATE destinations SET latitude = 8.68333, longitude = 106.60000, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Con Dao';
UPDATE destinations SET latitude = 10.34599, longitude = 107.08426, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Vung Tau';
-- Representative points for the current province records; coordinates are from OpenStreetMap/Nominatim.
UPDATE destinations SET latitude = 22.338206, longitude = 105.071585, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Tuyen Quang';
UPDATE destinations SET latitude = 22.292167, longitude = 103.179866, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Lai Chau';
UPDATE destinations SET latitude = 22.306930, longitude = 104.182959, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Lao Cai';
UPDATE destinations SET latitude = 21.961097, longitude = 105.844079, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Thai Nguyen';
UPDATE destinations SET latitude = 21.654657, longitude = 103.216863, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Dien Bien';
UPDATE destinations SET latitude = 21.848758, longitude = 106.614070, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Lang Son';
UPDATE destinations SET latitude = 21.227677, longitude = 104.157594, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Son La';
UPDATE destinations SET latitude = 21.300754, longitude = 105.134960, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Phu Tho';
UPDATE destinations SET latitude = 21.116854, longitude = 106.108956, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Bac Ninh';
UPDATE destinations SET latitude = 20.606585, longitude = 106.284347, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Hung Yen';
UPDATE destinations SET latitude = 20.286726, longitude = 106.100036, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Ninh Binh';
UPDATE destinations SET latitude = 19.978157, longitude = 105.481611, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Thanh Hoa';
UPDATE destinations SET latitude = 19.197600, longitude = 105.060676, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Nghe An';
UPDATE destinations SET latitude = 18.350483, longitude = 105.762305, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Ha Tinh';
UPDATE destinations SET latitude = 17.216696, longitude = 106.954825, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Quang Tri';
UPDATE destinations SET latitude = 14.995374, longitude = 108.691729, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Quang Ngai';
UPDATE destinations SET latitude = 14.020137, longitude = 108.635452, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Gia Lai';
UPDATE destinations SET latitude = 12.298075, longitude = 108.995039, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Khanh Hoa';
UPDATE destinations SET latitude = 11.661496, longitude = 108.133528, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Lam Dong';
UPDATE destinations SET latitude = 12.874186, longitude = 108.797930, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Dak Lak';
UPDATE destinations SET latitude = 11.080624, longitude = 107.187392, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Dong Nai';
UPDATE destinations SET latitude = 11.080053, longitude = 106.261053, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Tay Ninh';
UPDATE destinations SET latitude = 10.046765, longitude = 106.294744, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Vinh Long';
UPDATE destinations SET latitude = 10.425183, longitude = 105.927136, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Dong Thap';
UPDATE destinations SET latitude = 9.018018, longitude = 105.086972, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Ca Mau';
UPDATE destinations SET latitude = 10.318867, longitude = 105.043249, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'An Giang';
UPDATE destinations SET latitude = 20.910050, longitude = 107.183900, time_zone = 'Asia/Ho_Chi_Minh' WHERE name = 'Quang Ninh';
UPDATE destinations SET time_zone = 'Asia/Ho_Chi_Minh' WHERE country = 'Vietnam' AND time_zone IS NULL;

CREATE TABLE trip_day_destinations (
  trip_id BIGINT UNSIGNED NOT NULL,
  activity_date DATE NOT NULL,
  destination_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (trip_id, activity_date),
  CONSTRAINT fk_trip_day_destination_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_trip_day_destination_link FOREIGN KEY (trip_id, destination_id)
    REFERENCES trip_destinations(trip_id, destination_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
