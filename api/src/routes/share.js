import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { buildSharedTripView } from '../services/share-view.js';

const router = Router();

router.get('/trips/:tripId/share', requireAuth, async (req, res, next) => {
  const tripId = Number(req.params.tripId);
  if (!Number.isSafeInteger(tripId) || tripId < 1) {
    return res.status(400).json({ error: { code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' } });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT t.share_token AS shareToken, t.share_enabled AS shareEnabled
       FROM trips t JOIN users u ON u.id = t.owner_user_id
       WHERE t.id = ? AND u.clerk_user_id = ?`,
      [tripId, req.clerkUserId],
    );
    if (!rows.length) {
      return res.status(404).json({ error: { code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' } });
    }
    const active = Boolean(rows[0].shareEnabled && rows[0].shareToken);
    res.set('Cache-Control', 'private, no-store').json({
      data: { sharePath: active ? `/api/share/${rows[0].shareToken}` : null },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/trips/:tripId/share', requireAuth, async (req, res, next) => {
  const tripId = Number(req.params.tripId);
  if (!Number.isSafeInteger(tripId) || tripId < 1) {
    return res.status(400).json({
      error: { code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' },
    });
  }

  try {
    const shareToken = randomBytes(32).toString('hex');
    const [result] = await pool.execute(
      `UPDATE trips t JOIN users u ON u.id = t.owner_user_id
       SET t.share_token = ?, t.share_enabled = 1
       WHERE t.id = ? AND u.clerk_user_id = ?`,
      [shareToken, tripId, req.clerkUserId],
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: { code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' } });
    }
    res.status(201).json({ data: { shareToken, sharePath: `/api/share/${shareToken}` } });
  } catch (error) {
    next(error);
  }
});

router.delete('/trips/:tripId/share', requireAuth, async (req, res, next) => {
  const tripId = Number(req.params.tripId);
  if (!Number.isSafeInteger(tripId) || tripId < 1) {
    return res.status(400).json({
      error: { code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' },
    });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE trips t
       JOIN users u ON u.id = t.owner_user_id
       SET t.share_token = NULL, t.share_enabled = 0
       WHERE t.id = ? AND u.clerk_user_id = ?`,
      [tripId, req.clerkUserId],
    );
    if (!result.affectedRows) {
      const [ownedTrips] = await pool.execute(
        `SELECT t.id FROM trips t
         JOIN users u ON u.id = t.owner_user_id
         WHERE t.id = ? AND u.clerk_user_id = ?`,
        [tripId, req.clerkUserId],
      );
      if (!ownedTrips.length) {
        return res.status(404).json({
          error: { code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' },
        });
      }
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/share/:token', async (req, res, next) => {
  const { token } = req.params;
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(404).json({
      error: { code: 'SHARE_NOT_FOUND', message: 'This shared trip is unavailable.' },
    });
  }

  try {
    const [trips] = await pool.execute(
      `SELECT id, title, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
              DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
              group_size AS groupSize, budget, currency_code AS currencyCode
       FROM trips WHERE share_token = ? AND share_enabled = 1`,
      [token],
    );
    if (!trips.length) {
      return res.status(404).json({
        error: { code: 'SHARE_NOT_FOUND', message: 'This shared trip is unavailable.' },
      });
    }

    const trip = trips[0];
    const [destinations] = await pool.execute(
      `SELECT d.id, d.name, d.country, d.region, d.category, d.map_query AS mapQuery,
              td.destination_order AS destinationOrder
       FROM trip_destinations td
       JOIN destinations d ON d.id = td.destination_id
       WHERE td.trip_id = ? ORDER BY td.destination_order`,
      [trip.id],
    );
    const [activityRows] = await pool.execute(
      `SELECT id, DATE_FORMAT(activity_date, '%Y-%m-%d') AS date,
              TIME_FORMAT(start_time, '%H:%i') AS time,
              category, title, city, address
       FROM activities WHERE trip_id = ?
       ORDER BY activity_date, start_time IS NULL, start_time, id`,
      [trip.id],
    );
    res.set('Cache-Control', 'no-store').json({
      data: buildSharedTripView(trip, destinations, activityRows),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
