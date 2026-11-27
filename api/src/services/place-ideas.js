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
