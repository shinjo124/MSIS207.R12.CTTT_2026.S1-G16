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
  assert.deepEqual({ ...places[0], mapsUrl: undefined }, { id: 'a', name: 'Chợ Đà Lạt', address: 'Nguyễn Thị Minh Khai, Đà Lạt', distanceKm: 1.2, latitude: 11.94, longitude: 108.43, mapsUrl: undefined });
  assert.match(places[0].mapsUrl, /^https:\/\/www\.google\.com\/maps\/search\//);
  assert.deepEqual(shapePlaces({}), []);
});

test('client reports Geoapify errors', async () => {
  const ok = createPlaceIdeasClient({ fetchImpl: async () => ({ ok: true, json: async () => ({ features: [] }) }) });
  assert.deepEqual(await ok('https://api.geoapify.com/v2/places'), []);
  const failing = createPlaceIdeasClient({ fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: 'Invalid apiKey' }) }) });
  await assert.rejects(failing('x'), /401: Invalid apiKey/);
});

test('geocoding stays in Vietnam, near the destination', async () => {
  const { buildGeocodeUrl, pickGeocodeResult } = await import('../src/services/place-ideas.js');
  const url = new URL(buildGeocodeUrl({ apiKey: 'k', text: 'Chợ Đà Lạt, Đà Lạt, Việt Nam', near: dalat }));
  assert.equal(url.searchParams.get('filter'), 'countrycode:vn');
  assert.equal(url.searchParams.get('bias'), 'proximity:108.4583,11.94046');
  assert.deepEqual(pickGeocodeResult({ results: [{ lat: 11.9429, lon: 108.4368 }] }, dalat), { latitude: 11.9429, longitude: 108.4368 });
  assert.equal(pickGeocodeResult({ results: [{ lat: 21.03, lon: 105.85 }] }, dalat), null);
  assert.equal(pickGeocodeResult({ results: [] }, dalat), null);
});

test('geocoding tries specific texts first and has an OpenStreetMap fallback', async () => {
  const { geocodeQueries, buildNominatimUrl, pickNominatimResult } = await import('../src/services/place-ideas.js');
  assert.deepEqual(geocodeQueries({ name: 'Dinh Độc Lập', address: 'Quận 1', destinationName: 'TP. Hồ Chí Minh' }),
    ['Dinh Độc Lập, Quận 1, TP. Hồ Chí Minh, Việt Nam', 'Dinh Độc Lập, TP. Hồ Chí Minh, Việt Nam', 'Dinh Độc Lập, Việt Nam']);
  const url = new URL(buildNominatimUrl({ text: 'Dinh Độc Lập, Việt Nam', near: dalat }));
  assert.equal(url.hostname, 'nominatim.openstreetmap.org');
  assert.equal(url.searchParams.get('countrycodes'), 'vn');
  assert.deepEqual(pickNominatimResult([{ lat: '11.9429', lon: '108.4368' }], dalat), { latitude: 11.9429, longitude: 108.4368 });
  assert.equal(pickNominatimResult([], dalat), null);
});
