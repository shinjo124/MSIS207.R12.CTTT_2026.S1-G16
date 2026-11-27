import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlacesUrl, createPlaceIdeasClient, shapePlaces } from '../src/services/place-ideas.js';

const dalat = { latitude: '11.940460', longitude: '108.458300' };

test('builds a Geoapify search around the destination', () => {
  const url = new URL(buildPlacesUrl({ apiKey: 'k', destination: dalat, type: 'food', language: 'vi' }));
  assert.equal(url.origin + url.pathname, 'https://api.geoapify.com/v2/places');
  assert.equal(url.searchParams.get('categories'), 'catering.restaurant');
  assert.equal(url.searchParams.get('filter'), 'circle:108.4583,11.94046,25000');
  assert.equal(url.searchParams.get('lang'), 'vi');
  assert.equal(new URL(buildPlacesUrl({ apiKey: 'k', destination: dalat, type: 'sights', language: 'en' })).searchParams.get('lang'), 'en');
  assert.equal(buildPlacesUrl({ apiKey: 'k', destination: { latitude: null, longitude: null }, type: 'food' }), null);
});

test('keeps named places once, with address, distance and a map link', () => {
  const places = shapePlaces({ features: [
    { properties: { place_id: 'a', name: 'Chợ Đà Lạt', address_line2: 'Nguyễn Thị Minh Khai, Đà Lạt', distance: 1234, lat: 11.94, lon: 108.43 } },
    { properties: { place_id: 'b', name: 'chợ đà lạt' } },
    { properties: { place_id: 'c' } },
  ] });
  assert.equal(places.length, 1);
  assert.deepEqual({ ...places[0], mapsUrl: undefined }, { id: 'a', name: 'Chợ Đà Lạt', address: 'Nguyễn Thị Minh Khai, Đà Lạt', distanceKm: 1.2, mapsUrl: undefined });
  assert.match(places[0].mapsUrl, /^https:\/\/www\.google\.com\/maps\/search\//);
  assert.deepEqual(shapePlaces({}), []);
});

test('client reports Geoapify errors', async () => {
  const ok = createPlaceIdeasClient({ fetchImpl: async () => ({ ok: true, json: async () => ({ features: [] }) }) });
  assert.deepEqual(await ok('https://api.geoapify.com/v2/places'), []);
  const failing = createPlaceIdeasClient({ fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: 'Invalid apiKey' }) }) });
  await assert.rejects(failing('x'), /401: Invalid apiKey/);
});
