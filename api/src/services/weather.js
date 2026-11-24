import { isValidTimeZone } from './trip-rules.js';

export function validateWeatherLocation(input) {
  const { destinationId, latitude, longitude, timeZone, confirmed } = input || {};
  if (!Number.isSafeInteger(destinationId) || destinationId < 1 || typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || confirmed !== true || !isValidTimeZone(timeZone)) return { ok: false };
  return { ok: true, value: { destinationId, latitude, longitude, timeZone } };
}

function localParts(unix, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(unix * 1000)).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// Keep the sample closest to noon for each date in the forecast location's time zone.
export function normalizeForecast(samples, timeZone) {
  const byDate = new Map();
  for (const sample of samples) {
    if (!Number.isFinite(sample.dt) || !Number.isFinite(sample.main?.temp) || typeof sample.weather?.[0]?.description !== 'string') continue;
    const { date, time } = localParts(sample.dt, timeZone);
    const distance = Math.abs(Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) - 720);
    if (!byDate.has(date) || distance < byDate.get(date).distance) byDate.set(date, { date, time, temperature: sample.main.temp, description: sample.weather[0].description.slice(0, 100), distance });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map(({ distance, ...item }) => item);
}
// Cache by location and time zone. Requests for the same location can share an in-flight result.
export function createWeatherClient({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map();
  return async (location, apiKey) => {
    const cacheKey = `${location.latitude},${location.longitude},${location.timeZone}`;
    const existing = cache.get(cacheKey);
    if (existing && (existing.pending || existing.expiresAt > now())) return existing.pending || existing.data;
    const request = async (endpoint) => {
      const url = new URL(`https://api.openweathermap.org/data/2.5/${endpoint}`);
      url.search = new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), appid: apiKey, units: 'metric' });
      const response = await fetchImpl(url.toString(), { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Weather provider unavailable.');
      return response.json();
    };
    const pending = (async () => {
      const [current, forecast] = await Promise.all([request('weather'), request('forecast')]);
      if (!Number.isFinite(current.dt) || !Number.isFinite(current.main?.temp) || typeof current.weather?.[0]?.description !== 'string' || !Array.isArray(forecast.list)) throw new Error('Weather provider returned invalid data.');
      return { current: { observedAt: new Date(current.dt * 1000).toISOString(), temperature: current.main.temp, description: current.weather[0].description.slice(0, 100) }, forecast: normalizeForecast(forecast.list, location.timeZone) };
    })();
    cache.set(cacheKey, { pending });
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    try {
      const data = await pending;
      if (cache.get(cacheKey)?.pending === pending) cache.set(cacheKey, { data, expiresAt: now() + 600000 });
      return data;
    } catch (error) {
      if (cache.get(cacheKey)?.pending === pending) cache.delete(cacheKey);
      throw error;
    }
  };
}

export const fetchWeather = createWeatherClient();
export function weatherLocalDate(unix, timeZone) { return localParts(unix, timeZone).date; }
