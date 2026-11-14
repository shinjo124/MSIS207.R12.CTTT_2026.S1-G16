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

export function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
