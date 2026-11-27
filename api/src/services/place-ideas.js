// Live place ideas near a destination from the Geoapify Places API (OpenStreetMap data).
// Results are fetched on request; the page shows the required Geoapify and OpenStreetMap credit.
export const PLACE_IDEA_TYPES = {
  sights: ['tourism.sights', 'tourism.attraction'],
  food: ['catering.restaurant'],
  cafe: ['catering.cafe'],
  nature: ['natural', 'national_park', 'leisure.park'],
  culture: ['entertainment.museum', 'heritage', 'religion.place_of_worship'],
  shopping: ['commercial.marketplace', 'commercial.shopping_mall'],
};
export const PLACE_IDEAS_LIMIT = 12;
export const PLACE_IDEAS_RADIUS_METERS = 25000;

export function buildPlacesUrl({ apiKey, destination, type, language }) {
  const latitude = Number(destination.latitude);
  const longitude = Number(destination.longitude);
  if (destination.latitude == null || destination.longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const params = new URLSearchParams({
    categories: PLACE_IDEA_TYPES[type].join(','),
    filter: `circle:${longitude},${latitude},${PLACE_IDEAS_RADIUS_METERS}`,
    bias: `proximity:${longitude},${latitude}`,
    limit: String(PLACE_IDEAS_LIMIT),
    lang: language === 'en' ? 'en' : 'vi',
    apiKey,
  });
  return `https://api.geoapify.com/v2/places?${params}`;
}

// Keep named places only, once each, with the fields the page shows.
export function shapePlaces(data) {
  const seen = new Set();
  const out = [];
  for (const feature of Array.isArray(data?.features) ? data.features : []) {
    const p = feature?.properties || {};
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || !p.place_id || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const place = { id: String(p.place_id), name };
    const address = [p.address_line2, p.formatted].find((value) => typeof value === 'string' && value.trim());
    if (address) place.address = address.trim();
    if (Number.isFinite(p.distance)) place.distanceKm = Math.round(p.distance / 100) / 10;
    if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) { place.latitude = p.lat; place.longitude = p.lon; }
    if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) place.mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${p.lat},${p.lon}`)}`;
    out.push(place);
  }
  return out;
}

export function createPlaceIdeasClient({ fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  return async (url) => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.message || ''; } catch { /* no JSON body */ }
      throw new Error(`Geoapify request failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    return shapePlaces(await response.json());
  };
}

export const searchPlaceIdeas = createPlaceIdeasClient();

// Geocoding for catalogue places (script only). Search near the destination, inside Vietnam.
export function buildGeocodeUrl({ apiKey, text, near }) {
  const params = new URLSearchParams({ text, filter: 'countrycode:vn', limit: '1', format: 'json', lang: 'vi', apiKey });
  const latitude = Number(near?.latitude);
  const longitude = Number(near?.longitude);
  if (near?.latitude != null && near?.longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) params.set('bias', `proximity:${longitude},${latitude}`);
  return `https://api.geoapify.com/v1/geocode/search?${params}`;
}

// The first result, only if it lies within maxKm of the destination (so a same-named place elsewhere is ignored).
export function pickGeocodeResult(data, near, maxKm = 250) {
  const result = Array.isArray(data?.results) ? data.results[0] : null;
  if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lon)) return null;
  const latitude = Number(near?.latitude);
  const longitude = Number(near?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && near?.latitude != null && distanceKm(latitude, longitude, result.lat, result.lon) > maxKm) return null;
  return { latitude: Math.round(result.lat * 1e6) / 1e6, longitude: Math.round(result.lon * 1e6) / 1e6 };
}

export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (value) => (value * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// Fallback geocoder: OpenStreetMap Nominatim (free, max 1 request per second, needs a User-Agent).
export function buildNominatimUrl({ text, near }) {
  const params = new URLSearchParams({ q: text, countrycodes: 'vn', format: 'jsonv2', limit: '1', 'accept-language': 'vi' });
  const latitude = Number(near?.latitude);
  const longitude = Number(near?.longitude);
  if (near?.latitude != null && near?.longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    params.set('viewbox', `${longitude - 1.5},${latitude + 1.5},${longitude + 1.5},${latitude - 1.5}`);
  }
  return `https://nominatim.openstreetmap.org/search?${params}`;
}

export function pickNominatimResult(data, near, maxKm = 250) {
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;
  return pickGeocodeResult({ results: [{ lat: Number(first.lat), lon: Number(first.lon) }] }, near, maxKm);
}

// Search texts from most to least specific: "name, area, province", "name, province", "name".
export function geocodeQueries(place) {
  const name = place.name;
  const texts = [
    [name, place.address, place.destinationName, 'Việt Nam'],
    [name, place.destinationName, 'Việt Nam'],
    [name, 'Việt Nam'],
  ].map((parts) => parts.filter(Boolean).join(', '));
  return [...new Set(texts)];
}
