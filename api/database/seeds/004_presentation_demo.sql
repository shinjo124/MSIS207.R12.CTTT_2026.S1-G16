-- Presentation dataset. Stories and photos are synthetic demo content.
-- Photos are hosted by Unsplash and used under its free-use license.
-- Da Lat photo: THUY PHAM, https://unsplash.com/photos/a-city-in-the-mountains-9mSFninqIcw
-- Vung Tau photo: Long (lTiga) Nguyen, https://unsplash.com/photos/three-young-men-by-the-sea-at-sunset-PEpn0cD1_80
-- Hoi An photo: Minh Pham, https://unsplash.com/photos/people-at-the-streets-near-buildings-during-day-umMIQW4heTY
-- Ha Long Bay photo: Pierre Bonvalot, https://unsplash.com/photos/limestone-karsts-rise-from-the-water-in-a-scenic-bay-wPquuVxGqBc
-- Ho Chi Minh City photo: Huy Tran, https://unsplash.com/photos/skyline-of-ho-chi-minh-city-v8zqtbs4N7A
-- Da Nang photo: allPhoto Bangkok, https://unsplash.com/photos/a-bridge-that-has-a-lit-up-dragon-on-it-z7pni0pE00M
-- Hue photo: Mathilde Hugdal, https://unsplash.com/photos/an-old-building-with-a-red-door-and-a-red-door-LBAoKfYK8Mw
-- Phu Quoc photo: Anton Shuvalov, https://unsplash.com/photos/areal-photography-of-beach-z47CAQ0C6KE
-- Ninh Binh photo: Daniele Franchi, https://unsplash.com/photos/a-pagoda-sits-atop-a-misty-mountain-QzKU37Hq_5E
-- Sa Pa photo: I P, https://unsplash.com/photos/rice-terraces-in-green-mountain-valley-4Ljd8WOo0a8
-- Hanoi photo: Nguyen Phan Nam Anh, https://unsplash.com/photos/a-view-of-a-city-from-a-high-viewpoint-SmmbWQurbZ0
INSERT INTO destinations (name, country, region, category, summary, best_season, map_query, image_url, is_featured)
VALUES
  ('Da Lat', 'Vietnam', 'Central Highlands', 'Nature', 'A highland escape for pine forests, lakes, coffee, and cool evenings.', 'November–March', 'Da Lat, Vietnam', 'https://images.unsplash.com/photo-1669413487832-a8733f063ca8?auto=format&fit=crop&w=1200&q=85', 1),
  ('Vung Tau', 'Vietnam', 'TP. Hồ Chí Minh', 'Beach', 'A nearby seaside weekend with beach walks, seafood, and local bánh khọt.', 'November–April', 'Vung Tau, Vietnam', 'https://images.unsplash.com/photo-1777113580309-555dd9b35a0c?auto=format&fit=crop&w=1200&q=85', 1),
  ('Hoi An', 'Vietnam', 'Quang Nam', 'Culture', 'A walkable old town of yellow houses, lanterns, and riverside cafés.', 'February–April', 'Hoi An, Vietnam', 'https://images.unsplash.com/photo-1576565334281-aa7d97ad8e70?auto=format&fit=crop&w=1200&q=85', 1),
  ('Ha Long Bay', 'Vietnam', 'Quang Ninh', 'Nature', 'Limestone islands, sheltered water, and boat trips in northern Vietnam.', 'October–April', 'Ha Long Bay, Vietnam', 'https://images.unsplash.com/photo-1772717083265-2d93b89f0b7f?auto=format&fit=crop&w=1200&q=85', 1),
  ('Ho Chi Minh City', 'Vietnam', 'Southeast', 'City', 'A lively city for markets, museums, street food, and coffee stops.', 'December–April', 'Ho Chi Minh City, Vietnam', 'https://images.unsplash.com/photo-1788372255843-13910e4aebe0?auto=format&fit=crop&w=1200&q=85', 1),
  ('Da Nang', 'Vietnam', 'Central Vietnam', 'City', 'A coastal city for the Dragon Bridge, beaches, and central Vietnamese food.', 'February–May', 'Da Nang, Vietnam', 'https://images.unsplash.com/photo-1701396173275-835886dd72ce?auto=format&fit=crop&w=1200&q=85', 1),
  ('Hue', 'Vietnam', 'Central Vietnam', 'Culture', 'The former imperial capital, known for its citadel, tombs, and royal cuisine.', 'February–April', 'Hue, Vietnam', 'https://images.unsplash.com/photo-1725357599001-00709d50d32e?auto=format&fit=crop&w=1200&q=85', 1),
  ('Phu Quoc', 'Vietnam', 'Southern Vietnam', 'Beach', 'An island destination for beaches, sunsets, and seafood markets.', 'November–April', 'Phu Quoc, Vietnam', 'https://images.unsplash.com/photo-1551031742-f3099d6c687e?auto=format&fit=crop&w=1200&q=85', 1),
  ('Ninh Binh', 'Vietnam', 'Northern Vietnam', 'Nature', 'Karst peaks, river routes, and temples around Trang An and Tam Coc.', 'October–April', 'Ninh Binh, Vietnam', 'https://images.unsplash.com/photo-1741320130583-d179370be79f?auto=format&fit=crop&w=1200&q=85', 1),
  ('Sa Pa', 'Vietnam', 'Lao Cai', 'Nature', 'Mountain scenery and rice terraces around the Sa Pa valley.', 'September–November; April–May', 'Sa Pa, Vietnam', 'https://images.unsplash.com/photo-1788950874071-e1924c8da30a?auto=format&fit=crop&w=1200&q=85', 1),
  ('Hanoi', 'Vietnam', 'Northern Vietnam', 'City', 'The capital, with the Old Quarter, lakes, museums, and street food.', 'October–April', 'Hanoi, Vietnam', 'https://images.unsplash.com/photo-1722863014225-67f1c7567b79?auto=format&fit=crop&w=1200&q=85', 1)
ON DUPLICATE KEY UPDATE
  region = VALUES(region), category = VALUES(category), summary = VALUES(summary),
  best_season = VALUES(best_season), map_query = VALUES(map_query),
  image_url = VALUES(image_url), is_featured = VALUES(is_featured);

INSERT INTO places (destination_id, name, category, address, summary, map_query)
SELECT d.id, p.name, p.category, p.address, p.summary, p.map_query
FROM destinations d
JOIN (
  SELECT 'Da Lat' AS destination_name, 'Hồ Xuân Hương' AS name, 'Nature' AS category,
    'Trung tâm Đà Lạt' AS address, 'Dạo bộ ven hồ vào sáng sớm hoặc cuối chiều.' AS summary,
    'Xuan Huong Lake, Da Lat' AS map_query
  UNION ALL SELECT 'Da Lat', 'Thác Datanla', 'Nature', 'QL20, đèo Prenn, Đà Lạt',
    'Thác nước và đường đi bộ trong rừng thông phía nam thành phố.', 'Datanla Waterfall, Da Lat'
  UNION ALL SELECT 'Da Lat', 'Bánh tráng nướng 112 Nguyễn Văn Trỗi', 'Food', '112 Nguyễn Văn Trỗi, Đà Lạt',
    'Bánh tráng nướng với trứng, pate và topping mặn; địa chỉ được Vietnam Tourism giới thiệu.', '112 Nguyen Van Troi, Da Lat'
  UNION ALL SELECT 'Da Lat', 'Chợ Đà Lạt', 'Food', 'Khu Hòa Bình, Đà Lạt',
    'Chợ trung tâm và khu ăn vặt buổi tối.', 'Da Lat Night Market'
  UNION ALL SELECT 'Vung Tau', 'Bãi Sau', 'Beach', 'Đường Thùy Vân, Vũng Tàu',
    'Bãi biển dài cho buổi tắm biển và đi dạo.', 'Bai Sau Beach, Vung Tau'
  UNION ALL SELECT 'Vung Tau', 'Hải đăng Vũng Tàu', 'Sightseeing', 'Núi Nhỏ, Vũng Tàu',
    'Điểm ngắm toàn cảnh thành phố và bờ biển.', 'Vung Tau Lighthouse'
  UNION ALL SELECT 'Vung Tau', 'Bánh khọt Gốc Vú Sữa', 'Food', '14 Nguyễn Trường Tộ, Vũng Tàu',
    'Bánh khọt tôm ăn kèm rau sống và nước mắm chua ngọt.', 'Banh Khot Goc Vu Sua, 14 Nguyen Truong To, Vung Tau'
  UNION ALL SELECT 'Vung Tau', 'Ốc Thiên Nhiên', 'Food', '245 Trương Công Định, Vũng Tàu',
    'Quán ốc và hải sản cho bữa tối nhóm.', 'Oc Thien Nhien, 245 Truong Cong Dinh, Vung Tau'
) p ON p.destination_name = d.name
ON DUPLICATE KEY UPDATE
  category = VALUES(category), address = VALUES(address), summary = VALUES(summary), map_query = VALUES(map_query);

INSERT INTO trips (owner_user_id, title, start_date, end_date, group_size, budget, currency_code, time_zone)
SELECT u.id, demo.title, DATE_ADD(CURRENT_DATE, INTERVAL demo.start_offset DAY),
       DATE_ADD(CURRENT_DATE, INTERVAL demo.end_offset DAY), 3, demo.budget, 'VND', 'Asia/Ho_Chi_Minh'
FROM users u
CROSS JOIN (
  SELECT 'Đà Lạt 3 ngày: hồ, thác và món nóng' AS title, 1 AS start_offset, 3 AS end_offset, 7500000 AS budget
  UNION ALL SELECT 'Vũng Tàu cuối tuần: biển và hải sản', 4, 5, 5000000
) demo
WHERE u.clerk_user_id NOT LIKE 'seed-%'
  AND NOT EXISTS (SELECT 1 FROM trips t WHERE t.owner_user_id = u.id AND t.title = demo.title);

INSERT IGNORE INTO trip_destinations (trip_id, destination_id, destination_order)
SELECT t.id, d.id, 1
FROM trips t
JOIN users u ON u.id = t.owner_user_id
JOIN destinations d ON d.name = CASE WHEN t.title LIKE 'Đà Lạt%' THEN 'Da Lat' ELSE 'Vung Tau' END
WHERE u.clerk_user_id NOT LIKE 'seed-%'
  AND t.title IN ('Đà Lạt 3 ngày: hồ, thác và món nóng', 'Vũng Tàu cuối tuần: biển và hải sản');

INSERT INTO trip_weather_location (trip_id, destination_id, latitude, longitude, time_zone)
SELECT t.id, d.id,
       CASE d.name WHEN 'Da Lat' THEN 11.94646 ELSE 10.34599 END,
       CASE d.name WHEN 'Da Lat' THEN 108.44193 ELSE 107.08426 END,
       'Asia/Ho_Chi_Minh'
FROM trips t
JOIN users u ON u.id = t.owner_user_id
JOIN destinations d ON d.name = CASE WHEN t.title LIKE 'Đà Lạt%' THEN 'Da Lat' ELSE 'Vung Tau' END
WHERE u.clerk_user_id NOT LIKE 'seed-%'
  AND t.title IN ('Đà Lạt 3 ngày: hồ, thác và món nóng', 'Vũng Tàu cuối tuần: biển và hải sản')
ON DUPLICATE KEY UPDATE destination_id = VALUES(destination_id), latitude = VALUES(latitude),
  longitude = VALUES(longitude), time_zone = VALUES(time_zone);

INSERT INTO activities (trip_id, activity_date, start_time, duration_minutes, category, title, city, address, planned_cost, note)
SELECT t.id, DATE_ADD(t.start_date, INTERVAL a.day_offset DAY), a.start_time, a.duration_minutes,
       a.category, a.title, a.city, a.address, a.planned_cost, a.note
FROM trips t
JOIN users u ON u.id = t.owner_user_id
JOIN (
  SELECT 'Đà Lạt 3 ngày: hồ, thác và món nóng' AS trip_title, 0 AS day_offset, '08:00:00' AS start_time, 60 AS duration_minutes, 'sightseeing' AS category,
    'Dạo hồ Xuân Hương' AS title, 'Đà Lạt' AS city, 'Trung tâm Đà Lạt' AS address, 0 AS planned_cost, 'Đi bộ nhẹ sau khi nhận phòng.' AS note
  UNION ALL SELECT 'Đà Lạt 3 ngày: hồ, thác và món nóng', 0, '18:30:00', 75, 'food_drink', 'Bánh tráng nướng 112 Nguyễn Văn Trỗi', 'Đà Lạt', '112 Nguyễn Văn Trỗi', 90000, 'Gọi bánh tráng nướng và sữa đậu nành nóng.'
  UNION ALL SELECT 'Đà Lạt 3 ngày: hồ, thác và món nóng', 1, '09:00:00', 180, 'sightseeing', 'Thác Datanla', 'Đà Lạt', 'QL20, đèo Prenn', 300000, 'Dành buổi sáng cho thác và đường đi bộ.'
  UNION ALL SELECT 'Đà Lạt 3 ngày: hồ, thác và món nóng', 1, '19:00:00', 90, 'food_drink', 'Lẩu gà lá é Tao Ngộ', 'Đà Lạt', '155 Bùi Thị Xuân', 700000, 'Bữa tối nhóm; gọi lẩu gà lá é và rau ăn kèm.'
  UNION ALL SELECT 'Đà Lạt 3 ngày: hồ, thác và món nóng', 2, '08:30:00', 90, 'food_drink', 'Cà phê phin và chợ Đà Lạt', 'Đà Lạt', 'Khu Hòa Bình', 250000, 'Mua ít nông sản theo mùa trước khi rời thành phố.'
  UNION ALL SELECT 'Vũng Tàu cuối tuần: biển và hải sản', 0, '08:00:00', 90, 'food_drink', 'Bánh khọt Gốc Vú Sữa', 'Vũng Tàu', '14 Nguyễn Trường Tộ', 250000, 'Gọi bánh khọt tôm, rau sống và nước mắm.'
  UNION ALL SELECT 'Vũng Tàu cuối tuần: biển và hải sản', 0, '10:00:00', 120, 'sightseeing', 'Tắm biển Bãi Sau', 'Vũng Tàu', 'Đường Thùy Vân', 200000, 'Thuê ghế và nghỉ trưa gần biển.'
  UNION ALL SELECT 'Vũng Tàu cuối tuần: biển và hải sản', 0, '18:30:00', 90, 'food_drink', 'Ốc và hải sản Ốc Thiên Nhiên', 'Vũng Tàu', '245 Trương Công Định', 900000, 'Chọn vài món ốc và hỏi giá theo thời điểm.'
  UNION ALL SELECT 'Vũng Tàu cuối tuần: biển và hải sản', 1, '07:30:00', 90, 'sightseeing', 'Ngắm biển từ Hải đăng Vũng Tàu', 'Vũng Tàu', 'Núi Nhỏ', 0, 'Đi sớm để tránh nắng và đông xe.'
) a ON t.title = a.trip_title
WHERE u.clerk_user_id NOT LIKE 'seed-%'
  AND NOT EXISTS (SELECT 1 FROM activities x WHERE x.trip_id = t.id AND x.activity_date = DATE_ADD(t.start_date, INTERVAL a.day_offset DAY) AND x.title = a.title);

INSERT INTO posts (author_user_id, trip_id, place_id, body, visibility)
SELECT u.id, t.id, p.id, demo.body, 'public'
FROM users u
JOIN trips t ON t.owner_user_id = u.id
JOIN (
  SELECT 'Đà Lạt 3 ngày: hồ, thác và món nóng' AS trip_title,
    'Mở đầu chuyến Đà Lạt bằng một vòng hồ Xuân Hương, tối ghé 112 Nguyễn Văn Trỗi ăn bánh tráng nướng rồi uống sữa đậu nành nóng ở chợ đêm.' AS body,
    'Bánh tráng nướng 112 Nguyễn Văn Trỗi' AS place_name
  UNION ALL SELECT 'Đà Lạt 3 ngày: hồ, thác và món nóng',
    'Ngày thứ hai dành cho thác Datanla; tối ăn lẩu gà lá é Tao Ngộ ở 155 Bùi Thị Xuân. Lịch trình mẫu có chừa thời gian nghỉ giữa các điểm.', 'Thác Datanla'
  UNION ALL SELECT 'Vũng Tàu cuối tuần: biển và hải sản',
    'Buổi sáng ăn bánh khọt Gốc Vú Sữa (14 Nguyễn Trường Tộ), sau đó ra Bãi Sau nghỉ ngơi và đi dạo ven biển lúc chiều mát.', 'Bánh khọt Gốc Vú Sữa'
  UNION ALL SELECT 'Vũng Tàu cuối tuần: biển và hải sản',
    'Kết thúc ngày ở Vũng Tàu bằng bữa ốc và hải sản tại Ốc Thiên Nhiên, 245 Trương Công Định; nhớ xem giá theo thời điểm trước khi gọi món.', 'Ốc Thiên Nhiên'
) demo ON t.title = demo.trip_title
JOIN trip_destinations td ON td.trip_id = t.id AND td.destination_order = 1
JOIN places p ON p.destination_id = td.destination_id AND p.name = demo.place_name
WHERE u.clerk_user_id NOT LIKE 'seed-%'
  AND NOT EXISTS (SELECT 1 FROM posts x WHERE x.author_user_id = u.id AND x.trip_id = t.id AND x.body = demo.body);

INSERT INTO post_photos (post_id, image_url, alt_text, sort_order)
SELECT p.id, demo.image_url, demo.alt_text, 0
FROM posts p
JOIN (
  SELECT 'Mở đầu chuyến Đà Lạt bằng một vòng hồ Xuân Hương, tối ghé 112 Nguyễn Văn Trỗi ăn bánh tráng nướng rồi uống sữa đậu nành nóng ở chợ đêm.' AS body,
    'https://images.unsplash.com/photo-1669413487832-a8733f063ca8?auto=format&fit=crop&w=1400&q=85' AS image_url,
    'Toàn cảnh Đà Lạt giữa vùng đồi núi.' AS alt_text
  UNION ALL SELECT 'Ngày thứ hai dành cho thác Datanla; tối ăn lẩu gà lá é Tao Ngộ ở 155 Bùi Thị Xuân. Lịch trình mẫu có chừa thời gian nghỉ giữa các điểm.',
    'https://images.unsplash.com/photo-1789993603890-da860709dc9d?auto=format&fit=crop&w=1400&q=85', 'Cà phê phin nhỏ giọt trong buổi sáng mát.'
  UNION ALL SELECT 'Buổi sáng ăn bánh khọt Gốc Vú Sữa (14 Nguyễn Trường Tộ), sau đó ra Bãi Sau nghỉ ngơi và đi dạo ven biển lúc chiều mát.',
    'https://images.unsplash.com/photo-1777113580309-555dd9b35a0c?auto=format&fit=crop&w=1400&q=85', 'Nhóm bạn ngắm biển Vũng Tàu lúc hoàng hôn.'
  UNION ALL SELECT 'Kết thúc ngày ở Vũng Tàu bằng bữa ốc và hải sản tại Ốc Thiên Nhiên, 245 Trương Công Định; nhớ xem giá theo thời điểm trước khi gọi món.',
    'https://images.unsplash.com/photo-1777113580309-555dd9b35a0c?auto=format&fit=crop&w=1400&q=85', 'Bờ biển Vũng Tàu vào cuối ngày.'
) demo ON p.body = demo.body
WHERE NOT EXISTS (SELECT 1 FROM post_photos x WHERE x.post_id = p.id AND x.sort_order = 0);
