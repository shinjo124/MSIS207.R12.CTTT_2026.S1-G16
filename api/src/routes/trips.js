import { randomBytes, createHash } from 'node:crypto';
import { Router } from 'express';
import { setTimeout as delay } from 'node:timers/promises';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { summarizeBudget } from '../services/budget-summary.js';
import { listDates, parseDate, parseId, sendError, validateTripInput } from '../services/trip-rules.js';
import { ACTIVITY_COLUMNS, findEditableTrip, findOwnedTrip, shapeActivity, shapeTrip, TRIP_COLUMNS } from '../services/trip-data.js';

const router = Router();
const signedIn = [requireAuth, requireProfile];
const TRIP_NOT_FOUND = { status: 404, code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' };

const DESTINATION_NOT_FOUND = { status: 400, code: 'DESTINATION_NOT_FOUND', message: 'One or more destinations do not exist for this trip.' };

// Turn ordered catalog IDs and custom entries into IDs for this trip only.
async function resolveDestinations(db, tripId, destinations) {
  const ids = [];
  for (const destination of destinations) {
    if (destination.id) {
      const [rows] = await db.execute(
        'SELECT id FROM destinations WHERE id = ? AND (custom_trip_id IS NULL OR custom_trip_id = ?)',
        [destination.id, tripId],
      );
      if (!rows.length) return { error: DESTINATION_NOT_FOUND };
      ids.push(destination.id);
    } else {
      const { name, country } = destination;
      const [rows] = await db.execute('SELECT id FROM destinations WHERE custom_trip_id = ? AND name = ? AND country = ?', [tripId, name, country]);
      if (rows.length) {
        ids.push(Number(rows[0].id));
      } else {
        const [result] = await db.execute(
          "INSERT INTO destinations (name, country, region, category, summary, map_query, custom_trip_id) VALUES (?, ?, ?, 'Custom', '', ?, ?)",
          [name, country, country, `${name}, ${country}`, tripId],
        );
        ids.push(Number(result.insertId));
      }
    }
  }
  if (new Set(ids).size !== ids.length) {
    return { error: { status: 400, code: 'INVALID_DESTINATIONS', message: 'Choose different destinations.' } };
  }
  return { ids };
}

// Keep links for destinations that remain on the trip. Deleting a link also deletes its day assignments.
async function replaceDestinations(db, tripId, destinationIds) {
  const [current] = await db.execute('SELECT destination_id AS id FROM trip_destinations WHERE trip_id = ? ORDER BY destination_order', [tripId]);
  const retained = new Set(current.map(({ id }) => Number(id)));
  for (const id of retained) {
    if (!destinationIds.includes(id)) {
      await db.execute('DELETE FROM trip_destinations WHERE trip_id = ? AND destination_id = ?', [tripId, id]);
      retained.delete(id);
    }
  }
  // Move retained links out of the final order range so reordering can keep day assignments.
  if (retained.size) {
    await db.execute('UPDATE trip_destinations SET destination_order = destination_order + 10 WHERE trip_id = ?', [tripId]);
  }
  for (const [index, destinationId] of destinationIds.entries()) {
    if (retained.has(destinationId)) {
      await db.execute('UPDATE trip_destinations SET destination_order = ? WHERE trip_id = ? AND destination_id = ?', [index + 1, tripId, destinationId]);
    } else await db.execute(
      'INSERT INTO trip_destinations (trip_id, destination_id, destination_order) VALUES (?, ?, ?)',
      [tripId, destinationId, index + 1],
    );
  }
  await db.execute(
    `DELETE FROM trip_weather_location WHERE trip_id = ? AND NOT EXISTS
       (SELECT 1 FROM trip_destinations td WHERE td.trip_id = ? AND td.destination_id = trip_weather_location.destination_id)`,
    [tripId, tripId],
  );
  await db.execute(
    'DELETE FROM destinations WHERE custom_trip_id = ? AND NOT EXISTS (SELECT 1 FROM trip_destinations td WHERE td.trip_id = ? AND td.destination_id = destinations.id)',
    [tripId, tripId],
  );
}

async function loadDestinations(db, tripIds) {
  if (!tripIds.length) return new Map();
  const placeholders = tripIds.map(() => '?').join(', ');
  const [rows] = await db.execute(
    `SELECT td.trip_id AS tripId, d.id, COALESCE(d.local_name, d.name) AS name, d.country, d.region,
            d.map_query AS mapQuery, d.custom_trip_id IS NOT NULL AS custom
     FROM trip_destinations td JOIN destinations d ON d.id = td.destination_id
     WHERE td.trip_id IN (${placeholders}) ORDER BY td.trip_id, td.destination_order`,
    tripIds,
  );
  const byTrip = new Map();
  for (const { tripId, ...destination } of rows) {
    byTrip.set(tripId, [...(byTrip.get(tripId) || []), { ...destination, custom: Boolean(destination.custom) }]);
  }
  return byTrip;
}

// Build the editor response from the trip, ordered destinations, activities, and computed budget.
export async function loadTripDetail(tripId, userId, db = pool) {
  const trip = await findEditableTrip(db, tripId, userId);
  if (!trip) return null;

  const destinations = (await loadDestinations(db, [trip.id])).get(trip.id) || [];
  const [activityRows] = await db.execute(
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
    destinationId: null,
    activities: activitiesByDate.get(date) || [],
  }));
  let dayDestinations = [];
  try {
    [dayDestinations] = await db.execute(
      'SELECT DATE_FORMAT(activity_date, \'%Y-%m-%d\') AS date, destination_id AS destinationId FROM trip_day_destinations WHERE trip_id = ?',
      [trip.id],
    );
  } catch (error) {
    if (!/no such table|doesn't exist/i.test(error.message)) throw error;
    // shortcut: before migration 015, every day uses the trip's first destination; apply 015 before enabling assignment writes.
  }
  const firstDestinationId = destinations[0]?.id ?? null;
  const destinationByDate = new Map(dayDestinations.map(({ date, destinationId }) => [date, Number(destinationId)]));
  for (const day of days) day.destinationId = destinationByDate.get(day.date) ?? firstDestinationId;
  return { ...trip, destinations, days, budgetSummary: summarizeBudget(trip.budget, activityRows) };
}

router.get('/', signedIn, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${TRIP_COLUMNS} FROM trips t WHERE t.owner_user_id = ? OR EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = ?) ORDER BY t.start_date DESC, t.id DESC`,
      [req.userId, req.userId],
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
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO trips (owner_user_id, title, start_date, end_date, group_size, budget, currency_code, time_zone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, value.title, value.startDate, value.endDate, value.groupSize, value.budget, value.currencyCode, value.timeZone ?? null],
    );
    const destinations = await resolveDestinations(connection, result.insertId, value.destinations);
    if (destinations.error) {
      await connection.rollback();
      return sendError(res, destinations.error);
    }
    await replaceDestinations(connection, result.insertId, destinations.ids);
    const data = await loadTripDetail(result.insertId, req.userId, connection);
    await connection.commit();
    res.status(201).json({ data });
  } catch (error) {
    await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
});

// Replace the previous invite and store only a hash. The raw token is returned once to the owner.
router.post('/:tripId/invitations', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Invalid trip ID.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findOwnedTrip(connection, tripId, req.userId, true)) { await connection.rollback(); return sendError(res, TRIP_NOT_FOUND); }
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await connection.execute('DELETE FROM trip_invites WHERE trip_id = ?', [tripId]);
    await connection.execute('INSERT INTO trip_invites (trip_id, token_hash, expires_at) VALUES (?, ?, ?)', [tripId, hash, expiresAt]);
    await connection.commit();
    res.set('Cache-Control', 'no-store').status(201).json({ data: { token, expiresAt: new Date(expiresAt).toISOString() } });
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

router.delete('/:tripId/invitations', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Invalid trip ID.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findOwnedTrip(connection, tripId, req.userId, true)) { await connection.rollback(); return sendError(res, TRIP_NOT_FOUND); }
    await connection.execute('DELETE FROM trip_invites WHERE trip_id = ?', [tripId]);
    await connection.commit();
    res.status(204).end();
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

// Lock the trip before rechecking the invite, then add membership and consume the token together.
router.post('/invitations/accept', signedIn, async (req, res, next) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation is unavailable.' } });
  const hash = createHash('sha256').update(token).digest('hex');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [found] = await connection.execute('SELECT trip_id AS tripId FROM trip_invites WHERE token_hash = ?', [hash]);
    if (!found.length) { await connection.rollback(); return res.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation is unavailable.' } }); }
    const tripId = found[0].tripId;
    const [trips] = await connection.execute('SELECT id, owner_user_id AS ownerUserId FROM trips WHERE id = ? FOR UPDATE', [tripId]);
    const [invites] = await connection.execute('SELECT expires_at AS expiresAt FROM trip_invites WHERE trip_id = ? AND token_hash = ? FOR UPDATE', [tripId, hash]);
    if (!trips.length || !invites.length || Number(invites[0].expiresAt) <= Date.now() || Number(trips[0].ownerUserId) === Number(req.userId)) {
      await connection.rollback(); return res.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation is unavailable.' } });
    }
    const [members] = await connection.execute('SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id = ? FOR UPDATE', [tripId, req.userId]);
    if (!members.length) await connection.execute('INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)', [tripId, req.userId]);
    await connection.execute('DELETE FROM trip_invites WHERE trip_id = ?', [tripId]);
    await connection.commit();
    res.json({ data: { tripId } });
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

router.get('/:tripId/members', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Invalid trip ID.' });
  try {
    if (!await findOwnedTrip(pool, tripId, req.userId)) return sendError(res, TRIP_NOT_FOUND);
    const [rows] = await pool.execute('SELECT u.id AS userId, u.display_name AS displayName FROM trip_members m JOIN users u ON u.id = m.user_id WHERE m.trip_id = ? ORDER BY u.id', [tripId]);
    res.set('Cache-Control', 'private, no-store').json({ data: rows });
  } catch (error) { next(error); }
});

router.delete('/:tripId/members/:userId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId), userId = parseId(req.params.userId);
  if (!tripId || !userId) return sendError(res, { status: 400, code: 'INVALID_MEMBER', message: 'Invalid trip or user ID.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findOwnedTrip(connection, tripId, req.userId, true)) { await connection.rollback(); return sendError(res, TRIP_NOT_FOUND); }
    const [members] = await connection.execute('SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id = ? FOR UPDATE', [tripId, userId]);
    if (!members.length) { await connection.rollback(); return res.status(404).json({ error: { code: 'MEMBER_NOT_FOUND', message: 'Member was not found.' } }); }
    await connection.execute('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?', [tripId, userId]);
    await connection.commit();
    res.status(204).end();
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

// Wait briefly for a different trip revision. Recheck access on every database read.
router.get('/:tripId/version', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  const wait = req.query.wait === '1';
  const since = Number(req.query.since);
  if ((req.query.wait !== undefined && !wait) || (wait && (typeof req.query.since !== 'string' || !/^\d+$/.test(req.query.since) || !Number.isSafeInteger(since)))) {
    return sendError(res, { status: 400, code: 'INVALID_REVISION', message: 'Send a valid trip revision when waiting for changes.' });
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  res.on('close', cancel);
  try {
    const deadline = Date.now() + 8000;
    while (!controller.signal.aborted) {
      const [rows] = await pool.execute(`SELECT t.revision FROM trips t WHERE t.id = ? AND (t.owner_user_id = ? OR EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = ?))`, [tripId, req.userId, req.userId]);
      if (controller.signal.aborted) return;
      if (!rows.length) return sendError(res, TRIP_NOT_FOUND);
      if (!wait || Number(rows[0].revision) !== since || Date.now() >= deadline) {
        return res.set('Cache-Control', 'private, no-store').json({ data: { revision: rows[0].revision }, ...(wait ? { pollAfterMs: 0 } : {}) });
      }
      // shortcut: shared DB checks every second; use managed pub/sub when measured load needs it.
      await delay(Math.min(1000, deadline - Date.now()), undefined, { signal: controller.signal });
    }
  } catch (error) { if (!controller.signal.aborted) next(error); }
  finally { res.off('close', cancel); }
});

// A day can use only a destination already attached to this trip.
router.put('/:tripId/days/:date/destination', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  const destinationId = parseId(req.body?.destinationId);
  const date = req.params.date;
  if (!tripId || !destinationId || parseDate(date) === null) return sendError(res, { status: 400, code: 'INVALID_DAY_DESTINATION', message: 'Choose a valid trip day and destination.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const trip = await findEditableTrip(connection, tripId, req.userId, true);
    if (!trip) { await connection.rollback(); return sendError(res, TRIP_NOT_FOUND); }
    if (date < trip.startDate || date > trip.endDate) {
      await connection.rollback();
      return sendError(res, { status: 400, code: 'DATE_OUTSIDE_TRIP', message: 'Choose a date within the trip.' });
    }
    const [destinations] = await connection.execute('SELECT destination_id FROM trip_destinations WHERE trip_id = ? AND destination_id = ?', [tripId, destinationId]);
    if (!destinations.length) {
      await connection.rollback();
      return sendError(res, { status: 400, code: 'DESTINATION_NOT_IN_TRIP', message: 'Choose a destination from this trip.' });
    }
    await connection.execute('INSERT INTO trip_day_destinations (trip_id, activity_date, destination_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE destination_id = VALUES(destination_id)', [tripId, date, destinationId]);
    await connection.execute('UPDATE trips SET revision = revision + 1 WHERE id = ?', [tripId]);
    await connection.commit();
    res.json({ data: { date, destinationId } });
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
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

// A full update sends the editable fields and the last-read revision to catch a stale form.
router.put('/:tripId', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  const { value, error } = validateTripInput(req.body);
  if (error) return sendError(res, error);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const trip = await findEditableTrip(connection, tripId, req.userId, true);
    if (!trip) {
      await connection.rollback();
      return sendError(res, TRIP_NOT_FOUND);
    }

    if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 1) {
      await connection.rollback();
      return sendError(res, { status: 400, code: 'INVALID_REVISION', message: 'Send the trip revision you last read.' });
    }
    if (Number(trip.revision) !== req.body.revision) {
      await connection.rollback();
      return sendError(res, { status: 409, code: 'TRIP_CONFLICT', message: 'This trip changed elsewhere. Reload it and review your changes.' });
    }

    const destinations = await resolveDestinations(connection, tripId, value.destinations);
    if (destinations.error) {
      await connection.rollback();
      return sendError(res, destinations.error);
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

    let timeZone = value.timeZone;
    if (timeZone === undefined && trip.timeZone) {
      const [oldDestinations] = await connection.execute('SELECT destination_id AS id FROM trip_destinations WHERE trip_id = ? ORDER BY destination_order', [tripId]);
      const unchanged = oldDestinations.length === destinations.ids.length && oldDestinations.every((destination, index) => Number(destination.id) === destinations.ids[index]);
      timeZone = unchanged ? trip.timeZone : null;
    }
    await connection.execute(
      `UPDATE trips SET title = ?, start_date = ?, end_date = ?, group_size = ?, budget = ?, currency_code = ?, time_zone = ?, revision = revision + 1
       WHERE id = ?`,
      [value.title, value.startDate, value.endDate, value.groupSize, value.budget, value.currencyCode, timeZone ?? null, tripId],
    );
    await replaceDestinations(connection, tripId, destinations.ids);
    const data = await loadTripDetail(tripId, req.userId, connection);
    await connection.commit();
    res.json({ data });
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findOwnedTrip(connection, tripId, req.userId, true)) {
      await connection.rollback();
      return sendError(res, TRIP_NOT_FOUND);
    }
    await connection.execute('DELETE FROM trips WHERE id = ? AND owner_user_id = ?', [tripId, req.userId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    return next(error);
  } finally {
    connection.release();
  }
  res.status(204).end();
});

export default router;
