INSERT INTO users (clerk_user_id, email, display_name)
VALUES ('seed-demo-traveler', 'traveler@example.invalid', 'Linh Nguyen')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

INSERT INTO trips (owner_user_id, title, start_date, end_date, group_size, budget, currency_code)
SELECT u.id, 'A long weekend in Da Lat', DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY),
       DATE_ADD(CURRENT_DATE, INTERVAL 4 DAY), 3, 5000000.00, 'VND'
FROM users u
WHERE u.clerk_user_id = 'seed-demo-traveler'
  AND NOT EXISTS (
    SELECT 1 FROM trips t WHERE t.owner_user_id = u.id AND t.title = 'A long weekend in Da Lat'
  );

INSERT INTO trip_destinations (trip_id, destination_id, destination_order)
SELECT t.id, d.id, 1
FROM trips t
JOIN users u ON u.id = t.owner_user_id
JOIN destinations d ON d.name = 'Da Lat' AND d.country = 'Vietnam'
WHERE u.clerk_user_id = 'seed-demo-traveler' AND t.title = 'A long weekend in Da Lat'
ON DUPLICATE KEY UPDATE destination_order = VALUES(destination_order);

UPDATE posts SET body = CONCAT('[Sample story] ', body)
WHERE author_user_id = (SELECT id FROM users WHERE clerk_user_id = 'seed-demo-traveler')
  AND body = 'We left the afternoons open for coffee, lake walks, and whatever looked interesting on the way.';

-- Sample feed stories
INSERT INTO posts (author_user_id, trip_id, place_id, body, visibility)
SELECT u.id, NULL, NULL, CONCAT('[Sample story] ', sample.body), 'public'
FROM users u
CROSS JOIN (
  SELECT 'We left the afternoons open for coffee, lake walks, and whatever looked interesting on the way.' AS body
  UNION ALL SELECT 'Da Lat: We imagined a quiet morning walk followed by a warm drink and time to explore.'
  UNION ALL SELECT 'Hue: Our fictional itinerary leaves space for a relaxed afternoon beside the river.'
  UNION ALL SELECT 'Ha Noi: A sample weekend plan pairs a neighborhood walk with a leisurely lunch.'
  UNION ALL SELECT 'Hoi An: This sample trip saves the evening for a stroll and a shared meal.'
  UNION ALL SELECT 'Da Nang: We planned an early start and a flexible afternoon near the coast.'
  UNION ALL SELECT 'Ninh Binh: A fictional day outdoors works best with plenty of time between stops.'
  UNION ALL SELECT 'Sa Pa: This sample schedule includes a slow morning and a break for the weather.'
  UNION ALL SELECT 'Phu Quoc: Our imaginary group left a full afternoon free by the sea.'
  UNION ALL SELECT 'Can Tho: A sample visit begins early and finishes with an unhurried lunch.'
  UNION ALL SELECT 'Ho Chi Minh City: We built a fictional day around a walk, lunch, and coffee.'
  UNION ALL SELECT 'Nha Trang: This sample itinerary mixes time outdoors with a long rest.'
  UNION ALL SELECT 'Ha Giang: A fictional trip plan gives the group extra time between destinations.'
  UNION ALL SELECT 'Quy Nhon: Our sample group chose a flexible day with a meal together.'
  UNION ALL SELECT 'Vung Tau: A fictional weekend starts with a walk and ends with a sunset break.'
  UNION ALL SELECT 'Mekong Delta: This sample journey leaves room to adjust plans along the way.'
) sample
WHERE u.clerk_user_id = 'seed-demo-traveler'
  AND NOT EXISTS (
    SELECT 1 FROM posts p
    WHERE p.author_user_id = u.id AND p.body = CONCAT('[Sample story] ', sample.body)
  );
