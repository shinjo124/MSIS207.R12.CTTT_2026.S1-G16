import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { commonsInfoUrl, isRelevantTitle, pageImageUrl, pickCommonsInfo, pickPageImage, searchTitles, wikiSearchUrl } from '../src/services/wiki-images.js';

// Add a Wikimedia Commons photo (with author and licence) to catalogue places that have none.
// Safe to re-run; only places without a photo are looked up. Run: npm run places:images
const HEADERS = { 'User-Agent': 'TripoStudentProject/1.0 (MSIS207 coursework; place photos)' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`status ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(1500);
    }
  }
  return null;
}

async function findPhoto(place) {
  for (const text of [place.name, `${place.name} ${place.destinationName}`]) {
    const titles = searchTitles(await getJson(wikiSearchUrl(text))).filter((title) => isRelevantTitle(place.name, title));
    await sleep(200);
    for (const title of titles.slice(0, 2)) {
      const image = pickPageImage(await getJson(pageImageUrl(title)));
      await sleep(200);
      if (!image) continue;
      const info = pickCommonsInfo(await getJson(commonsInfoUrl(image.fileName)));
      await sleep(200);
      if (info) return { url: image.thumbnail, ...info, title };
    }
  }
  return null;
}

try {
  const [places] = await pool.query(
    `SELECT p.id, p.name, COALESCE(d.local_name, d.name) AS destinationName
     FROM places p JOIN destinations d ON d.id = p.destination_id WHERE p.image_url IS NULL ORDER BY p.id`,
  );
  console.log(`Places without a photo: ${places.length}`);
  let found = 0;
  for (const [index, place] of places.entries()) {
    try {
      const photo = await findPhoto(place);
      if (photo) {
        await pool.execute('UPDATE places SET image_url = ?, image_credit = ?, image_license = ?, image_page_url = ? WHERE id = ?',
          [photo.url, photo.credit, photo.license, photo.pageUrl, place.id]);
        found += 1;
      } else {
        console.log(`  no free photo: ${place.name}`);
      }
    } catch (error) {
      console.error(`  failed: ${place.name} (${error.message})`);
    }
    if ((index + 1) % 25 === 0) console.log(`  …${index + 1}/${places.length}`);
  }
  console.log(`Done. Added photos for ${found} of ${places.length} places. Run again to retry the rest.`);
} finally {
  await pool.end();
}
