// Shared validation for trips and activities (spec §4: dates, money, categories).

export const MAX_TRIP_DAYS = 60;
export const ACTIVITY_CATEGORIES = ['sightseeing', 'food_drink', 'accommodation', 'transport', 'shopping', 'other'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/; // fits DECIMAL(12,2)
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function badRequest(code, message) {
  return { status: 400, code, message };
}

export function sendError(res, { status, code, message }) {
  return res.status(status).json({ error: { code, message } });
}

export function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Calendar dates are handled as UTC midnight so the server time zone never shifts a day.
export function parseDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

// Inclusive: 13 → 16 Nov is 4 days.
export function countDays(startDate, endDate) {
  return Math.round((parseDate(endDate) - parseDate(startDate)) / 86_400_000) + 1;
}

export function listDates(startDate, endDate) {
  const start = parseDate(startDate);
  return Array.from({ length: countDays(startDate, endDate) }, (_, index) => (
    new Date(start + index * 86_400_000).toISOString().slice(0, 10)
  ));
}

// Accepts 1500000, "1500000" or "1500000.50"; returns a string for DECIMAL storage.
export function parseMoney(value) {
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return MONEY_PATTERN.test(trimmed) ? trimmed : null;
}

export function parseTime(value) {
  if (value == null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const short = value.slice(0, 5);
  return TIME_PATTERN.test(short) ? { ok: true, value: short } : { ok: false };
}

export function optionalText(value, maxLength) {
  if (value == null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { ok: false };
  return { ok: true, value: trimmed || null };
}

export function validateTripInput(body) {
  const input = body && typeof body === 'object' ? body : {};
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title || title.length > 160) {
    return { error: badRequest('INVALID_TITLE', 'Title is required and must be 160 characters or fewer.') };
  }

  const destinationIds = Array.isArray(input.destinationIds) ? input.destinationIds.map(parseId) : [];
  if (!destinationIds.length || destinationIds.length > 10 || destinationIds.includes(null)
    || new Set(destinationIds).size !== destinationIds.length) {
    return { error: badRequest('INVALID_DESTINATIONS', 'Choose between 1 and 10 different destinations.') };
  }

  const { startDate, endDate } = input;
  if (parseDate(startDate) === null || parseDate(endDate) === null) {
    return { error: badRequest('INVALID_DATE', 'Start and end dates must be valid dates in YYYY-MM-DD format.') };
  }
  if (parseDate(endDate) < parseDate(startDate)) {
    return { error: badRequest('END_BEFORE_START', 'The end date cannot be before the start date.') };
  }
  if (countDays(startDate, endDate) > MAX_TRIP_DAYS) {
    return { error: badRequest('TRIP_TOO_LONG', `A trip can be at most ${MAX_TRIP_DAYS} days.`) };
  }

  const groupSize = Number(input.groupSize);
  if (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > 100) {
    return { error: badRequest('INVALID_GROUP_SIZE', 'Group size must be a whole number from 1 to 100.') };
  }

  const currencyCode = typeof input.currencyCode === 'string' ? input.currencyCode.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return { error: badRequest('INVALID_CURRENCY', 'Currency must be a 3-letter code such as VND or USD.') };
  }

  const budget = parseMoney(input.budget);
  if (budget === null) {
    return { error: badRequest('INVALID_BUDGET', 'Budget must be zero or a positive amount with at most 2 decimals.') };
  }

  return { value: { title, destinationIds, startDate, endDate, groupSize, currencyCode, budget } };
}
