INSERT INTO destinations (name, country, region, category, summary, best_season, map_query)
VALUES
  ('Da Lat', 'Vietnam', 'Central Highlands', 'Nature', 'Cool highland city known for pine forests, lakes, and gardens.', 'November–March', 'Da Lat, Vietnam'),
  ('Hoi An', 'Vietnam', 'Quang Nam', 'Culture', 'Historic riverside town with preserved architecture and a walkable old quarter.', 'February–April', 'Hoi An Ancient Town, Vietnam'),
  ('Ha Long Bay', 'Vietnam', 'Quang Ninh', 'Nature', 'Limestone islands and sheltered waters in northern Vietnam.', 'October–April', 'Ha Long Bay, Vietnam'),
  ('Ho Chi Minh City', 'Vietnam', 'Southeast', 'City', 'Large southern city with markets, museums, food, and historic sites.', 'December–April', 'Ho Chi Minh City, Vietnam')
ON DUPLICATE KEY UPDATE
  region = VALUES(region),
  category = VALUES(category),
  summary = VALUES(summary),
  best_season = VALUES(best_season),
  map_query = VALUES(map_query);

INSERT INTO places (destination_id, name, category, address, summary, map_query)
SELECT d.id, p.name, p.category, p.address, p.summary, p.map_query
FROM destinations d
JOIN (
  SELECT 'Da Lat' AS destination_name, 'Xuan Huong Lake' AS name, 'Nature' AS category,
    'Da Lat, Lam Dong' AS address, 'A central lakeside walk and café area.' AS summary,
    'Xuan Huong Lake, Da Lat' AS map_query
  UNION ALL SELECT 'Da Lat', 'Datanla Waterfall', 'Nature', 'Prenn Pass, Da Lat',
    'A forest waterfall south of the city center.', 'Datanla Waterfall, Da Lat'
  UNION ALL SELECT 'Hoi An', 'Japanese Covered Bridge', 'Culture', 'Old Town, Hoi An',
    'A landmark bridge in the historic quarter.', 'Japanese Covered Bridge, Hoi An'
  UNION ALL SELECT 'Hoi An', 'An Bang Beach', 'Beach', 'Cam An, Hoi An',
    'A sandy beach north of the old town.', 'An Bang Beach, Hoi An'
  UNION ALL SELECT 'Ha Long Bay', 'Bai Chay Beach', 'Beach', 'Bai Chay, Ha Long',
    'A city beach near the waterfront district.', 'Bai Chay Beach, Ha Long'
  UNION ALL SELECT 'Ho Chi Minh City', 'Ben Thanh Market', 'Food', 'District 1, Ho Chi Minh City',
    'A central market for local food and everyday goods.', 'Ben Thanh Market, Ho Chi Minh City'
) p ON p.destination_name = d.name
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  address = VALUES(address),
  summary = VALUES(summary),
  map_query = VALUES(map_query);
