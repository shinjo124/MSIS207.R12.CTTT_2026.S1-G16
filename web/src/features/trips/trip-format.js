import { getLanguage, locale, t } from '../../lib/i18n.js';
export const CATEGORIES = [
  { value: 'sightseeing', label: 'Sightseeing / check-in' },
  { value: 'food_drink', label: 'Food & drink' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'transport', label: 'Transport' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
];

export const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'KRW', 'THB', 'SGD'];

export const MONEY_INPUT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

function formatMoneyInput(value) {
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

// Keep form state in the API's decimal format. Only the input uses Vietnamese separators.
export function moneyInputProps(value, onChange) {
  const formatted = formatMoneyInput(value);
  return {
    inputMode: 'decimal',
    value: formatted,
    onChange(event) {
      const input = event.currentTarget;
      const { data, inputType } = event.nativeEvent;
      let text = input.value;
      const caret = input.selectionStart ?? text.length;
      if (inputType === 'insertText' && data === '.' && text[caret - 1] === '.') {
        text = text.slice(0, caret - 1) + ',' + text.slice(caret);
      } else if (inputType === 'insertFromPaste') {
        // Accept amounts copied from the app's existing currency displays too.
        if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(text)) {
          text = text.replaceAll(',', '').replace('.', ',');
        } else if (/^\d+\.\d{1,2}$/.test(text)) {
          text = text.replace('.', ',');
        }
      }
      const nextValue = text.replaceAll('.', '').replace(',', '.');
      if (nextValue && !/^\d{1,10}(\.\d{0,2})?$/.test(nextValue)) {
        input.value = formatted;
        input.setSelectionRange(Math.min(caret, formatted.length), Math.min(caret, formatted.length));
        return;
      }
      const display = formatMoneyInput(nextValue);
      if (display !== input.value) {
        // Count digits and the decimal comma so grouping changes do not move the caret to the end.
        let remaining = text.slice(0, caret).replaceAll('.', '').length;
        let position = 0;
        while (position < display.length && remaining) {
          if (display[position++] !== '.') remaining--;
        }
        if (inputType === 'deleteContentForward' && value === nextValue && display[position] === '.') position++;
        input.value = display;
        input.setSelectionRange(position, position);
      }
      onChange(nextValue);
    },
  };
}

export function formatTripTitle(title) {
  return title.normalize('NFC').replace(/\s+([,.;!?])/g, '$1');
}

export const categoryLabel = (value) => t(CATEGORIES.find((item) => item.value === value)?.label || value);

// shortcut: only Vietnam has a reliable country-wide zone; use destination zone metadata when available.
export function destinationTimeZone(destination) {
  return destination?.timeZone || (destination?.country?.trim().toLowerCase() === 'vietnam' ? 'Asia/Ho_Chi_Minh' : null);
}

export function timeZoneLabel(timeZone) {
  if (!timeZone) return t('Time zone not set');
  try { return new Intl.DateTimeFormat(getLanguage() === 'vi' ? 'vi' : 'en', { timeZone, timeZoneName: 'longGeneric' }).formatToParts(new Date()).find(({ type }) => type === 'timeZoneName')?.value || t('Local time'); }
  catch { return t('Local time'); }
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
  return new Intl.DateTimeFormat(locale(), { ...options, timeZone: 'UTC' }).format(toUtc(date));
}

export function formatDateTime(value, options = { dateStyle: 'medium', timeStyle: 'short' }, timeZone) {
  return new Intl.DateTimeFormat(locale(), { ...options, ...(timeZone ? { timeZone } : {}) }).format(new Date(value));
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
    const parts = new Intl.NumberFormat(getLanguage() === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 }).formatToParts(value);
    const amountText = parts.filter(({ type }) => type !== 'currency' && type !== 'literal').map(({ value: part }) => part).join('');
    return `${amountText} ${parts.find(({ type }) => type === 'currency').value}`;
  } catch {
    return `${value.toLocaleString(getLanguage() === 'vi' ? 'vi-VN' : 'en-US')} ${currencyCode}`;
  }
}

// "Open in Google Maps" uses a plain search URL: no API key, no scraping (spec §3).
export function mapsUrl(activity) {
  const query = [activity.title, activity.address, activity.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Use the destination's clock to derive an itinerary date, even when the viewer is traveling.
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
