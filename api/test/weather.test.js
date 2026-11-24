import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWeatherLocation, normalizeForecast } from '../src/services/weather.js';

test('requires explicitly confirmed coordinates and an IANA time zone', () => {
  assert.equal(validateWeatherLocation({ destinationId: 1, latitude: 10.1, longitude: 106.6, timeZone: 'Asia/Ho_Chi_Minh', confirmed: true }).ok, true);
  for (const value of [
    { destinationId: 1, latitude: 91, longitude: 0, timeZone: 'UTC', confirmed: true },
    { destinationId: 1, latitude: 0, longitude: 0, timeZone: 'Invalid/Zone', confirmed: true },
    { destinationId: 1, latitude: 0, longitude: 0, timeZone: 'UTC', confirmed: false },
    { destinationId: 1, latitude: '', longitude: 0, timeZone: 'UTC', confirmed: true },
  ]) assert.equal(validateWeatherLocation(value).ok, false);
});

test('groups forecast samples by destination local date across daylight saving change', () => {
  const samples = [
    { dt: Date.parse('2026-03-08T06:00:00Z') / 1000, main: { temp: 2 }, weather: [{ description: 'cloudy' }] },
    { dt: Date.parse('2026-03-08T16:00:00Z') / 1000, main: { temp: 9 }, weather: [{ description: 'clear' }] },
    { dt: Date.parse('2026-03-09T03:00:00Z') / 1000, main: { temp: 5 }, weather: [{ description: 'rain' }] },
  ];
  const result = normalizeForecast(samples, 'America/New_York');
  assert.deepEqual(result.map((item) => item.date), ['2026-03-08']);
  assert.equal(result[0].temperature, 9);
  assert.equal(result[0].time, '12:00');
});

// Inject a clock and fetch implementation to test caching without calling OpenWeather.
test('weather client coalesces requests and caches normalized results for ten minutes', async () => {
  const { createWeatherClient } = await import('../src/services/weather.js');
  let calls = 0, clock = 0;
  const fetchImpl = async (url) => {
    calls++;
    const request = new URL(url);
    assert.equal(request.hostname, 'api.openweathermap.org');
    assert.deepEqual([...request.searchParams.keys()].sort(), ['appid', 'lat', 'lon', 'units']);
    return { ok: true, json: async () => url.includes('/weather?')
      ? { dt: 1772942400, main: { temp: 25 }, weather: [{ description: 'clear sky' }] }
      : { list: [{ dt: 1772942400, main: { temp: 26 }, weather: [{ description: 'cloudy' }] }] } };
  };
  const client = createWeatherClient({ fetchImpl, now: () => clock });
  const location = { latitude: 10, longitude: 106, timeZone: 'Asia/Ho_Chi_Minh' };
  const [first, concurrent] = await Promise.all([client(location, 'key'), client(location, 'key')]);
  assert.deepEqual(first, concurrent);
  assert.equal(calls, 2);
  await client(location, 'key');
  assert.equal(calls, 2);
  clock = 600001;
  await client(location, 'key');
  assert.equal(calls, 4);
});

test('provider failures are not cached as weather data', async () => {
  const { createWeatherClient } = await import('../src/services/weather.js');
  let calls = 0;
  const client = createWeatherClient({ fetchImpl: async () => { calls++; return { ok: false }; } });
  const location = { latitude: 10, longitude: 106, timeZone: 'Asia/Ho_Chi_Minh' };
  await assert.rejects(client(location, 'fixture'), /provider unavailable/i);
  await assert.rejects(client(location, 'fixture'), /provider unavailable/i);
  assert.equal(calls, 4);
});
