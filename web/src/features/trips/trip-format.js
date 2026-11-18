export const CATEGORIES = [
  { value: 'sightseeing', label: 'Sightseeing / check-in' },
  { value: 'food_drink', label: 'Food & drink' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'transport', label: 'Transport' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
];

export const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'KRW', 'THB', 'SGD'];

export const categoryLabel = (value) => CATEGORIES.find((item) => item.value === value)?.label || value;

// shortcut: only Vietnam has a reliable country-wide zone; use destination zone metadata when available.
export function destinationTimeZone(destination) {
  return destination?.timeZone || (destination?.country?.trim().toLowerCase() === 'vietnam' ? 'Asia/Ho_Chi_Minh' : null);
}

export function timeZoneLabel(timeZone) {
  if (!timeZone) return 'Time zone not set';
  try { return new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longGeneric' }).formatToParts(new Date()).find(({ type }) => type === 'timeZoneName')?.value || 'Local time'; }
  catch { return 'Local time'; }
}

export function withDefaultTimeZone(trip) {
  const fallback = destinationTimeZone(trip.destinations?.[0]);
  return trip.timeZone || !fallback ? trip : { ...trip, timeZone: fallback, timeZoneDefaulted: true };
}

// Treat YYYY-MM-DD as a calendar date in UTC so the browser's time zone never shifts it.
const toUtc = (date) => new Date(`${date}T00:00:00Z`);

export function countDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const days = Math.round((toUtc(endDate) - toUtc(startDate)) / 86_400_000) + 1;
  return Number.isFinite(days) ? days : 0;
}

export function formatDate(date, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(toUtc(date));
}

export function formatDateTime(value, options = { dateStyle: 'medium', timeStyle: 'short' }, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { ...options, ...(timeZone ? { timeZone } : {}) }).format(new Date(value));
}

export function addDays(date, days) {
  const value = toUtc(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function formatDayHeading(date) {
  return formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatMoney(amount, currencyCode) {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toLocaleString('en-US')} ${currencyCode}`;
  }
}

// "Open in Google Maps" uses a plain search URL: no API key, no scraping (spec §3).
export function mapsUrl(activity) {
  const query = [activity.title, activity.address, activity.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function todayInTimeZone(timeZone, now = new Date()) {
  if (!timeZone) return null;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch { return null; }
}
export function calendarStartDate(trip, now = new Date()) {
  const today = todayInTimeZone(trip.timeZone, now);
  return today && today >= trip.startDate && today <= trip.endDate ? today : trip.startDate;
}
export function canCompareWeatherDate(tripZone, weatherZone) { return Boolean(tripZone && weatherZone && tripZone === weatherZone); }
