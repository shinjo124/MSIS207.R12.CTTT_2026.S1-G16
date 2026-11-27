import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { buildGeocodeUrl, pickGeocodeResult } from '../src/services/place-ideas.js';

// Fill map coordinates for catalogue places that have none. Safe to re-run; only empty rows are looked up.
// Uses the Geoapify Geocoding API (free plan allows storing results). Run: npm run places:geocode
const apiKey = process.env.GEOAPIFY_API_KEY;
if (!apiKey) {
  console.error('Set GEOAPIFY_API_KEY in api/.env first.');
  process.exit(1);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const [places] = await pool.query(
    `SELECT p.id, p.name, p.address, p.map_query AS mapQuery, d.latitude, d.longitude, COALESCE(d.local_name, d.name) AS destinationName
     FROM places p JOIN destinations d ON d.id = p.destination_id
     WHERE p.latitude IS NULL OR p.longitude IS NULL ORDER BY p.id`,
  );
  console.log(`Places without coordinates: ${places.length}`);
  let found = 0;
  for (const place of places) {
    const text = place.mapQuery || [place.name, place.address, place.destinationName, 'Việt Nam'].filter(Boolean).join(', ');
    try {
      const response = await fetch(buildGeocodeUrl({ apiKey, text, near: place }), { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const point = pickGeocodeResult(await response.json(), place);
      if (point) {
        await pool.execute('UPDATE places SET latitude = ?, longitude = ? WHERE id = ?', [point.latitude, point.longitude, place.id]);
        found += 1;
      } else {
        console.log(`  not found: ${place.name}`);
      }
    } catch (error) {
      console.error(`  failed: ${place.name} (${error.message})`);
    }
    await sleep(250); // stay well under the free plan's 5 requests per second
  }
  console.log(`Done. Added coordinates for ${found} of ${places.length} places.`);
} finally {
  await pool.end();
}
