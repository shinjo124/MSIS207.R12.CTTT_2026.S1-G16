import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { countDays, listDates, parseId, sendError, validateTripInput } from '../services/trip-rules.js';

const router = Router();
const signedIn = [requireAuth, requireProfile];
const TRIP_NOT_FOUND = { status: 404, code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' };

const TRIP_COLUMNS = `t.id, t.title,
  DATE_FORMAT(t.start_date, '%Y-%m-%d') AS startDate,
  DATE_FORMAT(t.end_date, '%Y-%m-%d') AS endDate,
  t.group_size AS groupSize, t.budget, t.currency_code AS currencyCode,
  t.share_enabled AS shareEnabled, t.created_at AS createdAt, t.updated_at AS updatedAt`;

export const ACTIVITY_COLUMNS = `a.id, a.trip_id AS tripId,
  DATE_FORMAT(a.activity_date, '%Y-%m-%d') AS date,
  TIME_FORMAT(a.start_time, '%H:%i') AS time,
  a.category, a.title, a.city, a.address,
  a.planned_cost AS plannedCost, a.actual_spend AS actualSpend,
  a.note, a.visited`;

function shapeTrip(row) {
  return { ...row, shareEnabled: Boolean(row.shareEnabled), dayCount: countDays(row.startDate, row.endDate) };
}

export function shapeActivity(row) {
  return { ...row, visited: Boolean(row.visited) };
}

// Ownership is checked in SQL: another user's trip looks exactly like a missing trip.
async function findOwnedTrip(db, tripId, userId, lock = false) {
  const [rows] = await db.execute(
    `SELECT ${TRIP_COLUMNS} FROM trips t WHERE t.id = ? AND t.owner_user_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [tripId, userId],
  );
  return rows[0] ? shapeTrip(rows[0]) : null;
}

async function findMissingDestinations(db, destinationIds) {
  const placeholders = destinationIds.map(() => '?').join(', ');
  const [rows] = await db.execute(`SELECT id FROM destinations WHERE id IN (${placeholders})`, destinationIds);
  const found = new Set(rows.map((row) => Number(row.id)));
  return destinationIds.filter((id) => !found.has(id));
}

async function replaceDestinations(db, tripId, destinationIds) {
  await db.execute('DELETE FROM trip_destinations WHERE trip_id = ?', [tripId]);
  for (const [index, destinationId] of destinationIds.entries()) {
    await db.execute(
      'INSERT INTO trip_destinations (trip_id, destination_id, destination_order) VALUES (?, ?, ?)',
      [tripId, destinationId, index + 1],
    );
  }
}

async function loadDestinations(db, tripIds) {
  if (!tripIds.length) return new Map();
  const placeholders = tripIds.map(() => '?').join(', ');
  const [rows] = await db.execute(
    `SELECT td.trip_id AS tripId, d.id, COALESCE(d.local_name, d.name) AS name, d.country, d.region,
            d.map_query AS mapQuery
     FROM trip_destinations td JOIN destinations d ON d.id = td.destination_id
     WHERE td.trip_id IN (${placeholders}) ORDER BY td.trip_id, td.destination_order`,
    tripIds,
  );
  const byTrip = new Map();
  for (const { tripId, ...destination } of rows) {
    byTrip.set(tripId, [...(byTrip.get(tripId) || []), destination]);
  }
  return byTrip;
}

async function loadTripDetail(tripId, userId) {
  const trip = await findOwnedTrip(pool, tripId, userId);
  if (!trip) return null;

  const destinations = (await loadDestinations(pool, [trip.id])).get(trip.id) || [];
  const [activityRows] = await pool.execute(
    `SELECT ${ACTIVITY_COLUMNS} FROM activities a
     WHERE a.trip_id = ? ORDER BY a.activity_date, a.start_time IS NULL, a.start_time, a.id`,
    [trip.id],
  );
  const activitiesByDate = new Map();
  for (const row of activityRows) {
    activitiesByDate.set(row.date, [...(activitiesByDate.get(row.date) || []), shapeActivity(row)]);
  }

  // One itinerary day per calendar date, start and end included (spec §4).
  const days = listDates(trip.startDate, trip.endDate).map((date, index) => ({
    dayNumber: index + 1,
    date,
    activities: activitiesByDate.get(date) || [],
  }));
  return { ...trip, destinations, days };
}

router.get('/', signedIn, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${TRIP_COLUMNS} FROM trips t WHERE t.owner_user_id = ? ORDER BY t.start_date DESC, t.id DESC`,
      [req.userId],
    );
    const trips = rows.map(shapeTrip);
    const destinations = await loadDestinations(pool, trips.map((trip) => trip.id));
    res.set('Cache-Control', 'private, no-store')
      .json({ data: trips.map((trip) => ({ ...trip, destinations: destinations.get(trip.id) || [] })) });
  } catch (error) {
    next(error);
  }
});

router.post('/', signedIn, async (req, res, next) => {
  const { value, error } = validateTripInput(req.body);
  if (error) return sendError(res, error);

  const connection = await pool.getConnection();
  try {
    const missing = await findMissingDestinations(connection, value.destinationIds);
    if (missing.length) {
      return sendError(res, { status: 400, code: 'DESTINATION_NOT_FOUND', message: 'One or more destinations do not exist.' });
    }

    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO trips (owner_user_id, title, start_date, end_date, group_size, budget, currency_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, value.title, value.startDate, value.endDate, value.groupSize, value.budget, value.currencyCode],
    );
    await replaceDestinations(connection, result.insertId, value.destinationIds);
    await connection.commit();

    res.status(201).json({ data: await loadTripDetail(result.insertId, req.userId) });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

router.get('/:tripId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  try {
    const trip = await loadTripDetail(tripId, req.userId);
    if (!trip) return sendError(res, TRIP_NOT_FOUND);
    res.set('Cache-Control', 'private, no-store').json({ data: trip });
  } catch (error) {
    next(error);
  }
});

// Full update: the client sends every editable field, same shape as POST.
router.put('/:tripId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  const { value, error } = validateTripInput(req.body);
  if (error) return sendError(res, error);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const trip = await findOwnedTrip(connection, tripId, req.userId, true);
    if (!trip) {
      await connection.rollback();
      return sendError(res, TRIP_NOT_FOUND);
    }

    const missing = await findMissingDestinations(connection, value.destinationIds);
    if (missing.length) {
      await connection.rollback();
      return sendError(res, { status: 400, code: 'DESTINATION_NOT_FOUND', message: 'One or more destinations do not exist.' });
    }

    // Shortening a trip must not silently drop planned activities.
    const [outside] = await connection.execute(
      'SELECT COUNT(*) AS total FROM activities WHERE trip_id = ? AND (activity_date < ? OR activity_date > ?)',
      [tripId, value.startDate, value.endDate],
    );
    if (Number(outside[0].total) > 0) {
      await connection.rollback();
      return sendError(res, {
        status: 409,
        code: 'ACTIVITIES_OUTSIDE_DATES',
        message: `${outside[0].total} activity(ies) fall outside the new dates. Move or delete them first.`,
      });
    }

    await connection.execute(
      `UPDATE trips SET title = ?, start_date = ?, end_date = ?, group_size = ?, budget = ?, currency_code = ?
       WHERE id = ? AND owner_user_id = ?`,
      [value.title, value.startDate, value.endDate, value.groupSize, value.budget, value.currencyCode, tripId, req.userId],
    );
    await replaceDestinations(connection, tripId, value.destinationIds);
    await connection.commit();

    res.json({ data: await loadTripDetail(tripId, req.userId) });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

router.delete('/:tripId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  try {
    const [result] = await pool.execute('DELETE FROM trips WHERE id = ? AND owner_user_id = ?', [tripId, req.userId]);
    if (!result.affectedRows) return sendError(res, TRIP_NOT_FOUND);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
