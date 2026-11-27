import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { commonsInfoUrl, isRelevantTitle, pageImageUrl, pickCommonsInfo, pickPageImage, searchTitles, wikiSearchUrl } from '../src/services/wiki-images.js';

// Add a Wikimedia Commons photo (with author and licence) to catalogue places that have none.
// Safe to re-run; only places without a photo are looked up. Run: npm run places:images
// Wikimedia asks scripts to identify themselves with a contact and to go slowly, one request at a time.
const HEADERS = {
  'User-Agent': 'TripoPlacePhotos/1.0 (https://www.tripo.website; student project MSIS207) node-fetch',
  'Api-User-Agent': 'TripoPlacePhotos/1.0 (https://www.tripo.website)',
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PAUSE_MS = 1100;
let blockedInARow = 0;

class RateLimited extends Error {}

// Wait between requests; on 429 wait for Retry-After (or longer each time) and try again.
async function getJson(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await sleep(PAUSE_MS);
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
    if (response.status === 429 || response.status === 503) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const wait = Math.min(120000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 15000 * attempt);
      console.log(`  Wikimedia asked to slow down, waiting ${Math.round(wait / 1000)} s…`);
      await sleep(wait);
      continue;
    }
    if (!response.ok) throw new Error(`status ${response.status}`);
    blockedInARow = 0;
    return response.json();
  }
  blockedInARow += 1;
  throw new RateLimited('still rate limited');
}

async function findPhoto(place) {
  for (const text of [place.name, `${place.name} ${place.destinationName}`]) {
    const titles = searchTitles(await getJson(wikiSearchUrl(text))).filter((title) => isRelevantTitle(place.name, title));
    for (const title of titles.slice(0, 2)) {
      const image = pickPageImage(await getJson(pageImageUrl(title)));
      if (!image) continue;
      const info = pickCommonsInfo(await getJson(commonsInfoUrl(image.fileName)));
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
      if (blockedInARow >= 3) {
        console.error('Wikimedia keeps refusing requests. Stopping now; wait 15-30 minutes and run again (finished places are kept).');
        break;
      }
    }
    if ((index + 1) % 25 === 0) console.log(`  …${index + 1}/${places.length}`);
  }
  console.log(`Done. Added photos for ${found} of ${places.length} places. Run again to retry the rest.`);
} finally {
  await pool.end();
}
