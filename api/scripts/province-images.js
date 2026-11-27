import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { pickProvincePhoto } from '../src/services/wiki-images.js';

// Give each province or city without a photo the best photo of one of its places (run places:images first).
// Photos already set (for example the Unsplash photos in seed 004) are kept. Run: npm run provinces:images
try {
  const [provinces] = await pool.query(
    'SELECT id, COALESCE(local_name, name) AS name FROM destinations WHERE admin_level IS NOT NULL AND image_url IS NULL ORDER BY id',
  );
  console.log(`Provinces without a photo: ${provinces.length}`);
  let done = 0;
  for (const province of provinces) {
    const [places] = await pool.execute(
      `SELECT id, name, category, image_url AS imageUrl, image_credit AS imageCredit, image_license AS imageLicense, image_page_url AS imagePageUrl
       FROM places WHERE destination_id = ? AND image_url IS NOT NULL`,
      [province.id],
    );
    const photo = pickProvincePhoto(places);
    if (!photo) { console.log(`  no place photo yet: ${province.name}`); continue; }
    await pool.execute('UPDATE destinations SET image_url = ?, image_credit = ?, image_license = ?, image_page_url = ? WHERE id = ?',
      [photo.url, photo.credit, photo.license, photo.pageUrl, province.id]);
    console.log(`  ${province.name}: ${photo.placeName}`);
    done += 1;
  }
  console.log(`Done. Added photos for ${done} of ${provinces.length} provinces.`);
} finally {
  await pool.end();
}
