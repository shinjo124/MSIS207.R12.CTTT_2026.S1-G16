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

INSERT INTO posts (author_user_id, trip_id, place_id, body, visibility)
SELECT u.id, t.id, NULL,
       'We left the afternoons open for coffee, lake walks, and whatever looked interesting on the way.',
       'public'
FROM users u
JOIN trips t ON t.owner_user_id = u.id AND t.title = 'A long weekend in Da Lat'
WHERE u.clerk_user_id = 'seed-demo-traveler'
  AND NOT EXISTS (
    SELECT 1 FROM posts p
    WHERE p.author_user_id = u.id
      AND p.body = 'We left the afternoons open for coffee, lake walks, and whatever looked interesting on the way.'
  );
