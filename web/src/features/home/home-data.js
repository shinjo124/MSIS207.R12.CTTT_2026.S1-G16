// Data for the home page suggestions. Destination names refer to destinations.name in the seeds.

// Highlighted provinces, each with the catalogue spot whose photo represents it.
export const HIGHLIGHTS = [
  { province: 'Hanoi', photoFrom: 'Hanoi' },
  { province: 'Lam Dong', photoFrom: 'Da Lat' },
  { province: 'Quang Ninh', photoFrom: 'Ha Long Bay' },
  { province: 'Da Nang', photoFrom: 'Hoi An' },
  { province: 'Ninh Binh', photoFrom: 'Ninh Binh' },
  { province: 'Hue', photoFrom: 'Hue' },
  { province: 'Lao Cai', photoFrom: 'Sa Pa' },
  { province: 'Ho Chi Minh City', photoFrom: 'Ho Chi Minh City' },
  { province: 'An Giang', photoFrom: 'Phu Quoc' },
];

// Where is best each month: [province, spot, Vietnamese reason, English reason].
export const SEASON_PICKS = {
  1: [['Lam Dong', 'Đà Lạt', 'Mùa khô se lạnh, cuối tháng có mai anh đào.', 'Cool dry season; cherry blossoms late in the month.'],
    ['An Giang', 'Phú Quốc', 'Mùa khô, biển êm và nắng đẹp.', 'Dry season with calm sea and sunshine.'],
    ['Son La', 'Mộc Châu', 'Hoa mận, hoa đào nở trắng đồi.', 'Plum and peach blossoms cover the hills.'],
    ['Tuyen Quang', 'Hà Giang', 'Hoa đào, hoa mận nở trên cao nguyên đá.', 'Peach and plum blossoms on the karst plateau.']],
  2: [['Tuyen Quang', 'Hà Giang', 'Mùa hoa đào, hoa mận rực rỡ nhất.', 'Peak season for peach and plum blossoms.'],
    ['Son La', 'Mộc Châu', 'Đồi mận trắng muốt sau Tết.', 'White plum orchards after Tet.'],
    ['Lam Dong', 'Đà Lạt', 'Mai anh đào nở hồng phố núi.', 'Pink cherry blossoms around town.'],
    ['An Giang', 'Phú Quốc', 'Biển lặng, trời trong, ít mưa.', 'Calm sea, clear sky, little rain.']],
  3: [['Dien Bien', 'Điện Biên', 'Hoa ban nở trắng núi rừng Tây Bắc.', 'Ban flowers bloom across the northwest.'],
    ['Da Nang', 'Hội An', 'Nắng ráo, chưa nóng gắt, dạo phố rất thích.', 'Dry and mild, great for walking the old town.'],
    ['Ho Chi Minh City', 'Côn Đảo', 'Biển êm, nước trong, ít mưa.', 'Calm, clear water and little rain.'],
    ['An Giang', 'Phú Quốc', 'Cuối mùa khô, biển vẫn đẹp.', 'End of the dry season, still great beaches.']],
  4: [['Da Nang', 'Đà Nẵng', 'Bắt đầu mùa biển, trời trong xanh.', 'Beach season begins under clear skies.'],
    ['Khanh Hoa', 'Vịnh Vĩnh Hy', 'Nắng đẹp, biển xanh ngắm san hô.', 'Sunny, blue water for coral viewing.'],
    ['Gia Lai', 'Quy Nhơn', 'Mùa biển bắt đầu, nước trong vắt.', 'Beach season starts with clear water.'],
    ['Quang Tri', 'Phong Nha', 'Mùa khô, vào hang thuận lợi.', 'Dry season, easy cave visits.']],
  5: [['Ninh Binh', 'Tam Cốc', 'Lúa chín vàng giữa núi đá (cuối tháng 5).', 'Golden rice between karst peaks (late May).'],
    ['Lao Cai', 'Mù Cang Chải', 'Mùa nước đổ, ruộng bậc thang lấp lánh.', 'Flooded terraces shine before planting.'],
    ['Quang Ngai', 'Lý Sơn', 'Biển lặng, nước trong như ngọc.', 'Calm sea and crystal-clear water.'],
    ['Gia Lai', 'Quy Nhơn', 'Nắng đẹp, hải sản tươi ngon.', 'Sunny days and fresh seafood.']],
  6: [['Quang Ninh', 'Cô Tô', 'Mùa hè ở đảo xa, biển trong xanh.', 'Summer on a remote island with clear water.'],
    ['Dak Lak', 'Phú Yên', 'Mùa biển, ngắm Gành Đá Đĩa.', 'Beach season and the Ganh Da Dia rocks.'],
    ['Quang Ngai', 'Lý Sơn', 'Thời điểm đẹp nhất ra đảo.', 'The best time to visit the island.'],
    ['Thanh Hoa', 'Sầm Sơn', 'Cao điểm mùa tắm biển miền Bắc.', 'Peak beach season in the north.']],
  7: [['Hai Phong', 'Cát Bà', 'Chèo kayak trên vịnh Lan Hạ mùa hè.', 'Summer kayaking in Lan Ha Bay.'],
    ['Quang Ninh', 'Vịnh Hạ Long', 'Du thuyền ngắm vịnh mùa hè.', 'Summer cruises around the bay.'],
    ['Da Nang', 'Đà Nẵng', 'Biển đẹp, nhiều hoạt động về đêm.', 'Great beaches and lively nights.'],
    ['Quang Tri', 'Phong Nha', 'Mát lạnh trong những hang động lớn.', 'Cool off inside giant caves.']],
  8: [['Quang Tri', 'Phong Nha', 'Cuối mùa khám phá hang động.', 'Last weeks of the cave season.'],
    ['Khanh Hoa', 'Nha Trang', 'Còn nắng, biển đẹp trước mùa mưa.', 'Still sunny before the rainy season.'],
    ['Hai Phong', 'Cát Bà', 'Biển và rừng quốc gia mùa hè.', 'Sea and national park in summer.'],
    ['Da Nang', 'Hội An', 'Phố đèn lồng trước mùa mưa miền Trung.', 'Lantern town before the central rains.']],
  9: [['Lao Cai', 'Mù Cang Chải', 'Lúa chín vàng óng (giữa – cuối tháng 9).', 'Golden rice terraces (mid to late Sept).'],
    ['Tuyen Quang', 'Hoàng Su Phì', 'Ruộng bậc thang vào mùa gặt.', 'Terraced fields at harvest time.'],
    ['Hanoi', 'Hà Nội', 'Thu sang, gió heo may và cốm làng Vòng.', 'Autumn breeze and green rice flakes.'],
    ['Lao Cai', 'Sa Pa', 'Mùa đẹp để trekking qua thung lũng.', 'A great month for valley treks.']],
  10: [['Hanoi', 'Hà Nội', 'Mùa thu đẹp nhất năm, trời trong mát.', 'The loveliest autumn weather of the year.'],
    ['Tuyen Quang', 'Hà Giang', 'Hoa tam giác mạch bắt đầu nở.', 'Buckwheat flowers start to bloom.'],
    ['Son La', 'Mộc Châu', 'Trời mát, đồi chè xanh mướt.', 'Cool air and green tea hills.'],
    ['Lao Cai', 'Sa Pa', 'Trời trong, dễ săn mây.', 'Clear skies, good for cloud hunting.']],
  11: [['Tuyen Quang', 'Hà Giang', 'Tam giác mạch nở rộ khắp cao nguyên.', 'Buckwheat flowers in full bloom.'],
    ['Lam Dong', 'Đà Lạt', 'Dã quỳ vàng khắp đồi, trời se lạnh.', 'Wild sunflowers and crisp air.'],
    ['Son La', 'Mộc Châu', 'Hoa cải trắng bắt đầu nở.', 'White mustard flowers start blooming.'],
    ['Gia Lai', 'Pleiku', 'Mùa dã quỳ Tây Nguyên.', 'Wild sunflower season in the highlands.']],
  12: [['Lam Dong', 'Đà Lạt', 'Se lạnh, phố núi vào mùa hoa.', 'Chilly and full of flowers.'],
    ['Son La', 'Mộc Châu', 'Đồi hoa cải trắng tinh khôi.', 'Hills of white mustard flowers.'],
    ['An Giang', 'Phú Quốc', 'Mùa khô, biển êm, nắng nhẹ.', 'Dry season, calm sea, gentle sun.'],
    ['Dong Thap', 'Làng hoa Sa Đéc', 'Làng hoa vào vụ Tết rực rỡ.', 'Flower village gets ready for Tet.']],
};

export function highlightCards(destinations) {
  const byName = new Map(destinations.map((destination) => [destination.name, destination]));
  return HIGHLIGHTS.map(({ province, photoFrom }) => {
    const item = byName.get(province);
    return item ? { ...item, photo: byName.get(photoFrom)?.imageUrl || item.imageUrl || null } : null;
  }).filter(Boolean);
}

export function seasonCards(destinations, month) {
  const byName = new Map(destinations.map((destination) => [destination.name, destination]));
  return (SEASON_PICKS[month] || []).map(([province, spot, vi, en]) => ({ province: byName.get(province) || null, spot, vi, en }));
}

export function heroPhotos(destinations, count = 3) {
  return destinations.filter((destination) => destination.featured && destination.imageUrl).slice(0, count);
}
