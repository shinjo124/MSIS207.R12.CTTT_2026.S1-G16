import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { ACTIVITY_COLUMNS, shapeActivity } from './trips.js';
import {
  ACTIVITY_CATEGORIES, badRequest, optionalText, parseDate, parseId, parseMoney, parseTime, sendError,
} from '../services/trip-rules.js';

const router = Router();
const signedIn = [requireAuth, requireProfile];
const TRIP_NOT_FOUND = { status: 404, code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' };
const ACTIVITY_NOT_FOUND = { status: 404, code: 'ACTIVITY_NOT_FOUND', message: 'Activity was not found.' };

// Validates only the fields present, so PATCH can send e.g. { "visited": true }.
// With `partial = false` (create), date, category and title are required.
function validateActivity(body, partial) {
  const input = body && typeof body === 'object' ? body : {};
  const has = (key) => Object.hasOwn(input, key);
  const out = {};

  if (!partial || has('date')) {
    if (parseDate(input.date) === null) return { error: badRequest('INVALID_DATE', 'Date must be a valid date in YYYY-MM-DD format.') };
    out.activity_date = input.date;
  }
  if (!partial || has('category')) {
    if (!ACTIVITY_CATEGORIES.includes(input.category)) {
      return { error: badRequest('INVALID_CATEGORY', `Category must be one of: ${ACTIVITY_CATEGORIES.join(', ')}.`) };
    }
    out.category = input.category;
  }
  if (!partial || has('title')) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title || title.length > 160) return { error: badRequest('INVALID_TITLE', 'Place or activity name is required (160 characters max).') };
    out.title = title;
  }
  if (has('time')) {
    const time = parseTime(input.time);
    if (!time.ok) return { error: badRequest('INVALID_TIME', 'Time must use 24-hour HH:MM format.') };
    out.start_time = time.value;
  }
  for (const [key, column, max] of [['city', 'city', 120], ['address', 'address', 255], ['note', 'note', 1000]]) {
    if (!has(key)) continue;
    const text = optionalText(input[key], max);
    if (!text.ok) return { error: badRequest(`INVALID_${key.toUpperCase()}`, `${key[0].toUpperCase()}${key.slice(1)} must be text of ${max} characters or fewer.`) };
    out[column] = text.value;
  }
  if (has('plannedCost') || !partial) {
    const planned = input.plannedCost == null || input.plannedCost === '' ? '0' : parseMoney(input.plannedCost);
    if (planned === null) return { error: badRequest('INVALID_PLANNED_COST', 'Planned cost must be zero or a positive amount.') };
    out.planned_cost = planned;
  }
  if (has('actualSpend')) {
    // null / empty = not recorded yet. It is NOT the same as 0 (spec §4).
    const actual = input.actualSpend == null || input.actualSpend === '' ? null : parseMoney(input.actualSpend);
    if (actual === null && input.actualSpend != null && input.actualSpend !== '') {
      return { error: badRequest('INVALID_ACTUAL_SPEND', 'Actual spend must be empty (not recorded) or a positive amount.') };
    }
    out.actual_spend = actual;
  }
  if (has('visited')) {
    if (typeof input.visited !== 'boolean') return { error: badRequest('INVALID_VISITED', 'Visited must be true or false.') };
    out.visited = input.visited ? 1 : 0;
  }

  if (partial && !Object.keys(out).length) return { error: badRequest('NO_CHANGES', 'Send at least one field to update.') };
  return { value: out };
}

function isOutsideTrip(date, trip) {
  return date < trip.startDate || date > trip.endDate;
}

const DATE_OUTSIDE_TRIP = {
  status: 400, code: 'DATE_OUTSIDE_TRIP', message: 'The activity date must be within the trip dates.',
};

async function loadActivity(id) {
  const [rows] = await pool.execute(`SELECT ${ACTIVITY_COLUMNS} FROM activities a WHERE a.id = ?`, [id]);
  return shapeActivity(rows[0]);
}

router.post('/trips/:tripId/activities', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  const { value, error } = validateActivity(req.body, false);
  if (error) return sendError(res, error);

  try {
    const [trips] = await pool.execute(
      `SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate
       FROM trips WHERE id = ? AND owner_user_id = ?`,
      [tripId, req.userId],
    );
    if (!trips.length) return sendError(res, TRIP_NOT_FOUND);
    if (isOutsideTrip(value.activity_date, trips[0])) return sendError(res, DATE_OUTSIDE_TRIP);

    const columns = ['trip_id', ...Object.keys(value)];
    const [result] = await pool.execute(
      `INSERT INTO activities (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      [tripId, ...Object.values(value)],
    );
    res.status(201).json({ data: await loadActivity(result.insertId) });
  } catch (error) {
    next(error);
  }
});

router.patch('/activities/:activityId', signedIn, async (req, res, next) => {
  const activityId = parseId(req.params.activityId);
  if (!activityId) return sendError(res, { status: 400, code: 'INVALID_ACTIVITY_ID', message: 'Activity ID must be a positive integer.' });
  const { value, error } = validateActivity(req.body, true);
  if (error) return sendError(res, error);

  try {
    // Joins the trip so only its owner can find (and therefore change) the activity.
    const [rows] = await pool.execute(
      `SELECT DATE_FORMAT(t.start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(t.end_date, '%Y-%m-%d') AS endDate
       FROM activities a JOIN trips t ON t.id = a.trip_id
       WHERE a.id = ? AND t.owner_user_id = ?`,
      [activityId, req.userId],
    );
    if (!rows.length) return sendError(res, ACTIVITY_NOT_FOUND);
    if (value.activity_date && isOutsideTrip(value.activity_date, rows[0])) return sendError(res, DATE_OUTSIDE_TRIP);

    // Column names come from validateActivity's fixed list, never from the request.
    const assignments = Object.keys(value).map((column) => `${column} = ?`).join(', ');
    await pool.execute(`UPDATE activities SET ${assignments} WHERE id = ?`, [...Object.values(value), activityId]);
    res.json({ data: await loadActivity(activityId) });
  } catch (error) {
    next(error);
  }
});

router.delete('/activities/:activityId', signedIn, async (req, res, next) => {
  const activityId = parseId(req.params.activityId);
  if (!activityId) return sendError(res, { status: 400, code: 'INVALID_ACTIVITY_ID', message: 'Activity ID must be a positive integer.' });
  try {
    const [result] = await pool.execute(
      `DELETE a FROM activities a JOIN trips t ON t.id = a.trip_id
       WHERE a.id = ? AND t.owner_user_id = ?`,
      [activityId, req.userId],
    );
    if (!result.affectedRows) return sendError(res, ACTIVITY_NOT_FOUND);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
