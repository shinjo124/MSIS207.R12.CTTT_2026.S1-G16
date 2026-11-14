-- Every province/centrally run city on the 2025 administrative map (34 units) plus popular
-- spots, for destination search. Aliases include former province names that were merged.
-- Requires migration 006. Safe to re-run.
INSERT INTO destinations (name, local_name, aliases, is_featured, country, region, category, summary, map_query)
VALUES
  ('Hanoi', 'Hà Nội', 'Ha Noi', 0, 'Vietnam', 'Northern Vietnam', 'City', 'Capital city known for its Old Quarter, lakes, and street food.', 'Hanoi, Vietnam'),
  ('Hai Phong', 'Hải Phòng', 'Hải Dương, Cát Bà', 0, 'Vietnam', 'Northern Vietnam', 'City', 'Northern port city and gateway to Cat Ba Island.', 'Hai Phong, Vietnam'),
  ('Hue', 'Huế', 'Thừa Thiên Huế', 0, 'Vietnam', 'Central Vietnam', 'City', 'Former imperial capital with a citadel and royal tombs along the Perfume River.', 'Hue, Vietnam'),
  ('Da Nang', 'Đà Nẵng', 'Danang, Quảng Nam', 0, 'Vietnam', 'Central Vietnam', 'City', 'Coastal city with long beaches, the Marble Mountains, and Ba Na Hills.', 'Da Nang, Vietnam'),
  ('Can Tho', 'Cần Thơ', 'Sóc Trăng, Hậu Giang', 0, 'Vietnam', 'Southern Vietnam', 'City', 'Mekong Delta city known for its floating markets.', 'Can Tho, Vietnam'),
  ('Tuyen Quang', 'Tuyên Quang', 'Hà Giang', 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Northern mountain province that now includes the Ha Giang loop.', 'Tuyen Quang, Vietnam'),
  ('Cao Bang', 'Cao Bằng', NULL, 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Karst mountains and Ban Gioc Waterfall on the northern border.', 'Cao Bang, Vietnam'),
  ('Lai Chau', 'Lai Châu', NULL, 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Remote high mountains in the far northwest.', 'Lai Chau, Vietnam'),
  ('Lao Cai', 'Lào Cai', 'Yên Bái', 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Home to Sa Pa rice terraces and Fansipan peak.', 'Lao Cai, Vietnam'),
  ('Thai Nguyen', 'Thái Nguyên', 'Bắc Kạn', 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Northern province known for its tea hills.', 'Thai Nguyen, Vietnam'),
  ('Dien Bien', 'Điện Biên', NULL, 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Northwest province with the historic Dien Bien Phu battlefield.', 'Dien Bien, Vietnam'),
  ('Lang Son', 'Lạng Sơn', NULL, 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Border province with karst mountains and busy markets.', 'Lang Son, Vietnam'),
  ('Son La', 'Sơn La', NULL, 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Northwest province with the Moc Chau plateau.', 'Son La, Vietnam'),
  ('Phu Tho', 'Phú Thọ', 'Vĩnh Phúc, Hòa Bình', 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Midland province with the Hung Kings Temple and Mai Chau valley.', 'Phu Tho, Vietnam'),
  ('Bac Ninh', 'Bắc Ninh', 'Bắc Giang', 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Birthplace of Quan ho folk singing, with old pagodas.', 'Bac Ninh, Vietnam'),
  ('Quang Ninh', 'Quảng Ninh', NULL, 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Coastal province around Ha Long Bay and its islands.', 'Quang Ninh, Vietnam'),
  ('Hung Yen', 'Hưng Yên', 'Thái Bình', 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Red River Delta province with the historic Pho Hien town.', 'Hung Yen, Vietnam'),
  ('Ninh Binh', 'Ninh Bình', 'Hà Nam, Nam Định', 0, 'Vietnam', 'Northern Vietnam', 'Province', 'Karst landscapes of Trang An and Tam Coc.', 'Ninh Binh, Vietnam'),
  ('Thanh Hoa', 'Thanh Hóa', NULL, 0, 'Vietnam', 'Central Vietnam', 'Province', 'North central province with Sam Son beach and Pu Luong nature reserve.', 'Thanh Hoa, Vietnam'),
  ('Nghe An', 'Nghệ An', NULL, 0, 'Vietnam', 'Central Vietnam', 'Province', 'North central province with Cua Lo beach.', 'Nghe An, Vietnam'),
  ('Ha Tinh', 'Hà Tĩnh', NULL, 0, 'Vietnam', 'Central Vietnam', 'Province', 'Quiet beaches on the north central coast.', 'Ha Tinh, Vietnam'),
  ('Quang Tri', 'Quảng Trị', 'Quảng Bình', 0, 'Vietnam', 'Central Vietnam', 'Province', 'Central province with the Phong Nha caves and wartime history sites.', 'Quang Tri, Vietnam'),
  ('Quang Ngai', 'Quảng Ngãi', 'Kon Tum', 0, 'Vietnam', 'Central Vietnam', 'Province', 'Central province with Ly Son island.', 'Quang Ngai, Vietnam'),
  ('Gia Lai', 'Gia Lai', 'Bình Định', 0, 'Vietnam', 'Central Vietnam', 'Province', 'Central Highlands province that now reaches the coast at Quy Nhon.', 'Gia Lai, Vietnam'),
  ('Khanh Hoa', 'Khánh Hòa', 'Ninh Thuận', 0, 'Vietnam', 'Central Vietnam', 'Province', 'South central coast with Nha Trang beaches and islands.', 'Khanh Hoa, Vietnam'),
  ('Lam Dong', 'Lâm Đồng', 'Đắk Nông, Bình Thuận', 0, 'Vietnam', 'Central Vietnam', 'Province', 'Highland province around Da Lat that now includes Mui Ne.', 'Lam Dong, Vietnam'),
  ('Dak Lak', 'Đắk Lắk', 'Daklak, Phú Yên', 0, 'Vietnam', 'Central Vietnam', 'Province', 'Coffee country around Buon Ma Thuot, with waterfalls.', 'Dak Lak, Vietnam'),
  ('Dong Nai', 'Đồng Nai', 'Bình Phước', 0, 'Vietnam', 'Southern Vietnam', 'Province', 'Southeast province with Nam Cat Tien National Park.', 'Dong Nai, Vietnam'),
  ('Tay Ninh', 'Tây Ninh', 'Long An', 0, 'Vietnam', 'Southern Vietnam', 'Province', 'Southern province with Ba Den Mountain and the Cao Dai Holy See.', 'Tay Ninh, Vietnam'),
  ('Vinh Long', 'Vĩnh Long', 'Bến Tre, Trà Vinh', 0, 'Vietnam', 'Southern Vietnam', 'Province', 'Mekong orchards and river islands.', 'Vinh Long, Vietnam'),
  ('Dong Thap', 'Đồng Tháp', 'Tiền Giang', 0, 'Vietnam', 'Southern Vietnam', 'Province', 'Lotus fields and the Tram Chim wetlands.', 'Dong Thap, Vietnam'),
  ('Ca Mau', 'Cà Mau', 'Bạc Liêu', 0, 'Vietnam', 'Southern Vietnam', 'Province', 'The southernmost point of Vietnam, with mangrove forests.', 'Ca Mau, Vietnam'),
  ('An Giang', 'An Giang', 'Kiên Giang', 0, 'Vietnam', 'Southern Vietnam', 'Province', 'Mekong province with Chau Doc, Sam Mountain, and Phu Quoc island.', 'An Giang, Vietnam'),
  ('Sa Pa', 'Sa Pa', 'Sapa', 0, 'Vietnam', 'Lào Cai', 'Nature', 'Mountain town with rice terraces and trekking trails.', 'Sa Pa, Vietnam'),
  ('Ha Giang', 'Hà Giang', NULL, 0, 'Vietnam', 'Tuyên Quang', 'Nature', 'Mountain passes and karst plateaus on the Ha Giang loop.', 'Ha Giang, Vietnam'),
  ('Moc Chau', 'Mộc Châu', NULL, 0, 'Vietnam', 'Sơn La', 'Nature', 'Cool plateau with tea hills and seasonal flower fields.', 'Moc Chau, Vietnam'),
  ('Mai Chau', 'Mai Châu', NULL, 0, 'Vietnam', 'Phú Thọ', 'Nature', 'Valley of rice fields and stilt-house villages.', 'Mai Chau, Vietnam'),
  ('Cat Ba', 'Cát Bà', 'Catba', 0, 'Vietnam', 'Hải Phòng', 'Nature', 'Island with a national park next to Lan Ha Bay.', 'Cat Ba, Vietnam'),
  ('Phong Nha', 'Phong Nha', 'Phong Nha Kẻ Bàng', 0, 'Vietnam', 'Quảng Trị', 'Nature', 'Cave systems inside Phong Nha-Ke Bang National Park.', 'Phong Nha, Vietnam'),
  ('Quy Nhon', 'Quy Nhơn', 'Quinhon', 0, 'Vietnam', 'Gia Lai', 'Beach', 'Seaside city with quiet beaches and seafood.', 'Quy Nhon, Vietnam'),
  ('Nha Trang', 'Nha Trang', 'Nhatrang', 0, 'Vietnam', 'Khánh Hòa', 'Beach', 'Beach city with islands and diving spots.', 'Nha Trang, Vietnam'),
  ('Mui Ne', 'Mũi Né', 'Phan Thiết', 0, 'Vietnam', 'Lâm Đồng', 'Beach', 'Sand dunes and a windy coast popular for kitesurfing.', 'Mui Ne, Vietnam'),
  ('Phu Quoc', 'Phú Quốc', 'Phuquoc', 0, 'Vietnam', 'An Giang', 'Beach', 'Large island with beaches, night markets, and resorts.', 'Phu Quoc, Vietnam'),
  ('Vung Tau', 'Vũng Tàu', 'Bà Rịa', 0, 'Vietnam', 'TP. Hồ Chí Minh', 'Beach', 'Seaside city close to Ho Chi Minh City.', 'Vung Tau, Vietnam'),
  ('Con Dao', 'Côn Đảo', NULL, 0, 'Vietnam', 'TP. Hồ Chí Minh', 'Beach', 'Island group with clear water and historic prison sites.', 'Con Dao, Vietnam')
ON DUPLICATE KEY UPDATE
  local_name = VALUES(local_name),
  aliases = VALUES(aliases),
  region = VALUES(region),
  category = VALUES(category),
  summary = VALUES(summary),
  map_query = VALUES(map_query);

-- Vietnamese names and aliases for the original curated destinations (they stay featured).
UPDATE destinations SET local_name = 'Đà Lạt', aliases = 'Dalat' WHERE name = 'Da Lat' AND country = 'Vietnam';
UPDATE destinations SET local_name = 'Hội An', aliases = 'Hoian' WHERE name = 'Hoi An' AND country = 'Vietnam';
UPDATE destinations SET local_name = 'Vịnh Hạ Long', aliases = 'Hạ Long, Halong' WHERE name = 'Ha Long Bay' AND country = 'Vietnam';
UPDATE destinations SET local_name = 'TP. Hồ Chí Minh', aliases = 'Hồ Chí Minh, Sài Gòn, Saigon, HCM, TPHCM, HCMC, Bình Dương'
  WHERE name = 'Ho Chi Minh City' AND country = 'Vietnam';
