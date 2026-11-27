import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { buildGeocodeUrl, buildNominatimUrl, geocodeQueries, pickGeocodeResult, pickNominatimResult } from '../src/services/place-ideas.js';

// Fill map coordinates for catalogue places that have none. Safe to re-run; only empty rows are looked up.
// Tries Geoapify geocoding with a few search texts, then OpenStreetMap Nominatim (1 request per second).
// Run: npm run places:geocode
const apiKey = process.env.GEOAPIFY_API_KEY;
if (!apiKey) {
  console.error('Set GEOAPIFY_API_KEY in api/.env first.');
  process.exit(1);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const USER_AGENT = 'Tripo student project (MSIS207, geocoding a small place list)';

async function getJson(url, headers = {}) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`status ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(1500);
    }
  }
  return null;
}

async function locate(place) {
  for (const text of geocodeQueries(place)) {
    const point = pickGeocodeResult(await getJson(buildGeocodeUrl({ apiKey, text, near: place })), place);
    await sleep(250); // Geoapify free plan: up to 5 requests per second
    if (point) return { ...point, source: 'Geoapify' };
  }
  for (const text of geocodeQueries(place).slice(1)) {
    const point = pickNominatimResult(await getJson(buildNominatimUrl({ text, near: place }), { 'User-Agent': USER_AGENT }), place);
    await sleep(1100); // Nominatim usage policy: at most 1 request per second
    if (point) return { ...point, source: 'Nominatim' };
  }
  return null;
}

try {
  const [places] = await pool.query(
    `SELECT p.id, p.name, p.address, d.latitude, d.longitude, COALESCE(d.local_name, d.name) AS destinationName
     FROM places p JOIN destinations d ON d.id = p.destination_id
     WHERE p.latitude IS NULL OR p.longitude IS NULL ORDER BY p.id`,
  );
  console.log(`Places without coordinates: ${places.length}`);
  let found = 0;
  for (const [index, place] of places.entries()) {
    try {
      const point = await locate(place);
      if (point) {
        await pool.execute('UPDATE places SET latitude = ?, longitude = ? WHERE id = ?', [point.latitude, point.longitude, place.id]);
        found += 1;
        if (point.source === 'Nominatim') console.log(`  found with OpenStreetMap: ${place.name}`);
      } else {
        console.log(`  not found: ${place.name}`);
      }
    } catch (error) {
      console.error(`  failed: ${place.name} (${error.message})`);
    }
    if ((index + 1) % 25 === 0) console.log(`  …${index + 1}/${places.length}`);
  }
  console.log(`Done. Added coordinates for ${found} of ${places.length} places. Run again to retry the rest.`);
} finally {
  await pool.end();
}
