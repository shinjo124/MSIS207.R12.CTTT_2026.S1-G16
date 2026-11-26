// Live place ideas from Google Places API (New) Text Search.
// Google's terms do not allow storing Places content, so results are fetched on request and never saved.
export const GOOGLE_PLACE_TYPES = {
  sights: { vi: 'điểm tham quan nổi tiếng', en: 'top tourist attractions' },
  food: { vi: 'quán ăn đặc sản ngon', en: 'best local food restaurants' },
  cafe: { vi: 'quán cà phê đẹp', en: 'best cafes' },
  nature: { vi: 'cảnh đẹp thiên nhiên', en: 'beautiful nature spots' },
  culture: { vi: 'di tích lịch sử và bảo tàng', en: 'historical sites and museums' },
  shopping: { vi: 'chợ và khu mua sắm', en: 'markets and shopping areas' },
};
export const GOOGLE_PLACES_PAGE_SIZE = 10;
// Rating and review count make the list useful; they bill the request as Text Search Enterprise.
export const GOOGLE_PLACES_FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.googleMapsUri',
  'places.primaryTypeDisplayName', 'places.rating', 'places.userRatingCount',
].join(',');

export function buildTextSearchRequest(destination, type, language) {
  const lang = language === 'en' ? 'en' : 'vi';
  const words = GOOGLE_PLACE_TYPES[type][lang];
  const name = lang === 'vi' ? destination.localName || destination.name : destination.name;
  const country = destination.country || 'Vietnam';
  const body = {
    textQuery: lang === 'vi' ? `${words} ở ${name}, ${country === 'Vietnam' ? 'Việt Nam' : country}` : `${words} in ${name}, ${country}`,
    languageCode: lang,
    regionCode: 'VN',
    pageSize: GOOGLE_PLACES_PAGE_SIZE,
  };
  const latitude = Number(destination.latitude);
  const longitude = Number(destination.longitude);
  if (destination.latitude != null && destination.longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    body.locationBias = { circle: { center: { latitude, longitude }, radius: 30000 } };
  }
  return body;
}

// Only the fields the page shows; anything missing is left out.
export function shapePlaces(data) {
  return (Array.isArray(data?.places) ? data.places : []).map((place) => {
    const out = { id: String(place.id || ''), name: place.displayName?.text || '' };
    if (place.formattedAddress) out.address = place.formattedAddress;
    if (place.googleMapsUri) out.mapsUrl = place.googleMapsUri;
    if (place.primaryTypeDisplayName?.text) out.type = place.primaryTypeDisplayName.text;
    if (typeof place.rating === 'number') out.rating = place.rating;
    if (Number.isInteger(place.userRatingCount)) out.ratingCount = place.userRatingCount;
    return out;
  }).filter((place) => place.id && place.name);
}

export function createGooglePlacesClient({ fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  return async ({ apiKey, body }) => {
    const response = await fetchImpl('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': GOOGLE_PLACES_FIELD_MASK },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.error?.message || ''; } catch { /* no JSON body */ }
      throw new Error(`Google Places request failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    return shapePlaces(await response.json());
  };
}

export const searchGooglePlaces = createGooglePlacesClient();
