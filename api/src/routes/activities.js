import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { ACTIVITY_COLUMNS, findEditableTrip, shapeActivity } from '../services/trip-data.js';
import {
  ACTIVITY_CATEGORIES, badRequest, optionalText, parseDate, parseId, parseMoney, parseTime, sendError,
} from '../services/trip-rules.js';

const router = Router();
const signedIn = [requireAuth, requireProfile];
const TRIP_NOT_FOUND = { status: 404, code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' };
const ACTIVITY_NOT_FOUND = { status: 404, code: 'ACTIVITY_NOT_FOUND', message: 'Activity was not found.' };

// Validates only the fields present, so PATCH can send e.g. { "visited": true }.
// With `partial = false` (create), date, category and title are required.
export function validateActivity(body, partial) {
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
  if (has('durationMinutes')) {
    const duration = input.durationMinutes;
    if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) {
      return { error: badRequest('INVALID_DURATION', 'Duration must be empty or a whole number of minutes from 1 to 1440.') };
    }
    out.duration_minutes = duration;
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

async function loadActivity(id, db = pool) {
  const [rows] = await db.execute(`SELECT ${ACTIVITY_COLUMNS} FROM activities a WHERE a.id = ?`, [id]);
  return shapeActivity(rows[0]);
}

router.post('/trips/:tripId/activities', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  const { value, error } = validateActivity(req.body, false);
  if (error) return sendError(res, error);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const trip = await findEditableTrip(connection, tripId, req.userId, true);
    if (!trip) {
      await connection.rollback();
      return sendError(res, TRIP_NOT_FOUND);
    }
    if (isOutsideTrip(value.activity_date, trip)) {
      await connection.rollback();
      return sendError(res, DATE_OUTSIDE_TRIP);
    }

    const columns = ['trip_id', ...Object.keys(value)];
    const [result] = await connection.execute(
      `INSERT INTO activities (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      [tripId, ...Object.values(value)],
    );
    await connection.execute('UPDATE trips SET revision = revision + 1 WHERE id = ?', [tripId]);
    await connection.commit();
    res.status(201).json({ data: await loadActivity(result.insertId, connection) });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

router.patch('/activities/:activityId', signedIn, async (req, res, next) => {
  const activityId = parseId(req.params.activityId);
  if (!activityId) return sendError(res, { status: 400, code: 'INVALID_ACTIVITY_ID', message: 'Activity ID must be a positive integer.' });
  const version = req.body?.version;
  if (!Number.isSafeInteger(version) || version < 1) return sendError(res, badRequest('INVALID_VERSION', 'Send the activity version you last read.'));
  const { value, error } = validateActivity(req.body, true);
  if (error) return sendError(res, error);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [activities] = await connection.execute('SELECT trip_id AS tripId FROM activities WHERE id = ?', [activityId]);
    const trip = activities.length && await findEditableTrip(connection, activities[0].tripId, req.userId, true);
    if (!trip) {
      await connection.rollback();
      return sendError(res, ACTIVITY_NOT_FOUND);
    }
    const [current] = await connection.execute('SELECT id, version FROM activities WHERE id = ? AND trip_id = ? FOR UPDATE', [activityId, activities[0].tripId]);
    if (!current.length) { await connection.rollback(); return sendError(res, ACTIVITY_NOT_FOUND); }
    if (Number(current[0].version) !== version) { await connection.rollback(); return sendError(res, { status: 409, code: 'ACTIVITY_CONFLICT', message: 'This activity changed elsewhere. Reload the trip and review it before trying again.' }); }
    if (value.activity_date && isOutsideTrip(value.activity_date, trip)) {
      await connection.rollback();
      return sendError(res, DATE_OUTSIDE_TRIP);
    }

    // Column names come from validateActivity's fixed list, never from the request.
    const assignments = Object.keys(value).map((column) => `${column} = ?`).join(', ');
    await connection.execute(`UPDATE activities SET ${assignments}, version = version + 1 WHERE id = ? AND version = ?`, [...Object.values(value), activityId, version]);
    await connection.execute('UPDATE trips SET revision = revision + 1 WHERE id = ?', [activities[0].tripId]);
    const updated = await loadActivity(activityId, connection);
    await connection.commit();
    res.json({ data: updated });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

router.delete('/activities/:activityId', signedIn, async (req, res, next) => {
  const activityId = parseId(req.params.activityId);
  if (!activityId) return sendError(res, { status: 400, code: 'INVALID_ACTIVITY_ID', message: 'Activity ID must be a positive integer.' });
  const version = req.body?.version;
  if (!Number.isSafeInteger(version) || version < 1) return sendError(res, badRequest('INVALID_VERSION', 'Send the activity version you last read.'));
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [activities] = await connection.execute('SELECT trip_id AS tripId FROM activities WHERE id = ?', [activityId]);
    const trip = activities.length && await findEditableTrip(connection, activities[0].tripId, req.userId, true);
    if (!trip) { await connection.rollback(); return sendError(res, ACTIVITY_NOT_FOUND); }
    const [current] = await connection.execute('SELECT id, version FROM activities WHERE id = ? AND trip_id = ? FOR UPDATE', [activityId, activities[0].tripId]);
    if (!current.length) { await connection.rollback(); return sendError(res, ACTIVITY_NOT_FOUND); }
    if (Number(current[0].version) !== version) { await connection.rollback(); return sendError(res, { status: 409, code: 'ACTIVITY_CONFLICT', message: 'This activity changed elsewhere. Reload the trip and review it before trying again.' }); }
    await connection.execute('DELETE FROM activities WHERE id = ? AND version = ?', [activityId, version]);
    await connection.execute('UPDATE trips SET revision = revision + 1 WHERE id = ?', [activities[0].tripId]);
    await connection.commit();
    res.status(204).end();
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally { connection.release(); }
});

export default router;
