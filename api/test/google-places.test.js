import test from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_PLACES_FIELD_MASK, buildTextSearchRequest, createGooglePlacesClient, shapePlaces } from '../src/services/google-places.js';

const dalat = { name: 'Da Lat', localName: 'Đà Lạt', country: 'Vietnam', latitude: '11.940400', longitude: '108.458300' };

test('builds a Vietnamese or English query near the destination', () => {
  const vi = buildTextSearchRequest(dalat, 'food', 'vi');
  assert.equal(vi.textQuery, 'quán ăn đặc sản ngon ở Đà Lạt, Việt Nam');
  assert.equal(vi.languageCode, 'vi');
  assert.equal(vi.regionCode, 'VN');
  assert.deepEqual(vi.locationBias.circle.center, { latitude: 11.9404, longitude: 108.4583 });
  const en = buildTextSearchRequest({ ...dalat, latitude: null }, 'sights', 'en');
  assert.equal(en.textQuery, 'top tourist attractions in Da Lat, Vietnam');
  assert.equal(en.locationBias, undefined);
});

test('keeps only the fields the page shows', () => {
  assert.deepEqual(shapePlaces({ places: [
    { id: 'a', displayName: { text: 'Chợ Đà Lạt' }, formattedAddress: 'Nguyễn Thị Minh Khai', googleMapsUri: 'https://maps.google.com/?cid=1', primaryTypeDisplayName: { text: 'Chợ' }, rating: 4.4, userRatingCount: 1200, reviews: [{}] },
    { id: 'b', displayName: { text: '' } },
  ] }), [{ id: 'a', name: 'Chợ Đà Lạt', address: 'Nguyễn Thị Minh Khai', mapsUrl: 'https://maps.google.com/?cid=1', type: 'Chợ', rating: 4.4, ratingCount: 1200 }]);
  assert.deepEqual(shapePlaces({}), []);
});

test('client sends the key and field mask and reports Google errors', async () => {
  let sent;
  const client = createGooglePlacesClient({ fetchImpl: async (url, options) => { sent = { url, options }; return { ok: true, json: async () => ({ places: [] }) }; } });
  assert.deepEqual(await client({ apiKey: 'k', body: { textQuery: 'x' } }), []);
  assert.equal(sent.url, 'https://places.googleapis.com/v1/places:searchText');
  assert.equal(sent.options.headers['X-Goog-Api-Key'], 'k');
  assert.equal(sent.options.headers['X-Goog-FieldMask'], GOOGLE_PLACES_FIELD_MASK);
  const failing = createGooglePlacesClient({ fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'API key not valid' } }) }) });
  await assert.rejects(failing({ apiKey: 'k', body: {} }), /403: API key not valid/);
});
