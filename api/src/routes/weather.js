import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { findEditableTrip } from './trips.js';
import { parseDate, parseId, sendError } from '../services/trip-rules.js';
import { fetchWeather, validateWeatherLocation, weatherLocalDate } from '../services/weather.js';

const router = Router();
const weatherLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'WEATHER_RATE_LIMITED', message: 'Too many weather requests. Try again later.' } } });
const notFound = { status: 404, code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' };

router.put('/trips/:tripId/weather-location', requireAuth, requireProfile, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  const parsed = validateWeatherLocation(req.body);
  if (!tripId || !parsed.ok) return res.status(400).json({ error: { code: 'INVALID_WEATHER_LOCATION', message: 'Confirm a destination, valid coordinates and IANA time zone.' } });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findEditableTrip(connection, tripId, req.userId, true)) { await connection.rollback(); return sendError(res, notFound); }
    const location = parsed.value;
    const [destinations] = await connection.execute('SELECT destination_id FROM trip_destinations WHERE trip_id = ? AND destination_id = ?', [tripId, location.destinationId]);
    if (!destinations.length) { await connection.rollback(); return res.status(400).json({ error: { code: 'DESTINATION_NOT_IN_TRIP', message: 'Choose a destination from this trip.' } }); }
    await connection.execute('DELETE FROM trip_weather_location WHERE trip_id = ?', [tripId]);
    await connection.execute('INSERT INTO trip_weather_location (trip_id, destination_id, latitude, longitude, time_zone) VALUES (?, ?, ?, ?, ?)', [tripId, location.destinationId, location.latitude, location.longitude, location.timeZone]);
    await connection.execute('UPDATE trips SET revision = revision + 1 WHERE id = ?', [tripId]);
    await connection.commit();
    res.json({ data: location });
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

router.delete('/trips/:tripId/weather-location', requireAuth, requireProfile, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return res.status(400).json({ error: { code: 'INVALID_TRIP_ID', message: 'Invalid trip ID.' } });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (!await findEditableTrip(connection, tripId, req.userId, true)) { await connection.rollback(); return sendError(res, notFound); }
    const [existing] = await connection.execute('SELECT trip_id FROM trip_weather_location WHERE trip_id = ? FOR UPDATE', [tripId]);
    if (existing.length) {
      await connection.execute('DELETE FROM trip_weather_location WHERE trip_id = ?', [tripId]);
      await connection.execute('UPDATE trips SET revision = revision + 1 WHERE id = ?', [tripId]);
    }
    await connection.commit();
    res.status(204).end();
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

router.get('/trips/:tripId/weather', requireAuth, requireProfile, weatherLimiter, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return res.status(400).json({ error: { code: 'INVALID_TRIP_ID', message: 'Invalid trip ID.' } });
  const date = typeof req.query.date === 'string' ? req.query.date : null;
  const destinationId = req.query.destinationId === undefined ? null : parseId(req.query.destinationId);
  if (date && !parseDate(date)) return res.status(400).json({ error: { code: 'INVALID_DATE', message: 'Date must use YYYY-MM-DD format.' } });
  if (req.query.destinationId !== undefined && !destinationId) return res.status(400).json({ error: { code: 'INVALID_DESTINATION_ID', message: 'Destination ID must be a positive integer.' } });
  try {
    const trip = await findEditableTrip(pool, tripId, req.userId);
    if (!trip) return sendError(res, notFound);
    if (date && (date < trip.startDate || date > trip.endDate)) return res.status(400).json({ error: { code: 'DATE_OUTSIDE_TRIP', message: 'Date must be within the trip.' } });
    if (destinationId) {
      const [belongs] = await pool.execute('SELECT destination_id FROM trip_destinations WHERE trip_id = ? AND destination_id = ?', [tripId, destinationId]);
      if (!belongs.length) return res.status(400).json({ error: { code: 'DESTINATION_NOT_IN_TRIP', message: 'Choose a destination from this trip.' } });
    }
    let location;
    if (!date && !destinationId) {
      const [legacyRows] = await pool.execute(`SELECT w.destination_id AS destinationId, w.latitude, w.longitude, w.time_zone AS timeZone, COALESCE(d.local_name, d.name) AS destinationName FROM trip_weather_location w JOIN trip_destinations td ON td.trip_id = w.trip_id AND td.destination_id = w.destination_id JOIN destinations d ON d.id = w.destination_id WHERE w.trip_id = ?`, [tripId]);
      location = legacyRows[0] ? { ...legacyRows[0], latitude: Number(legacyRows[0].latitude), longitude: Number(legacyRows[0].longitude) } : null;
    } else {
      const [rows] = await pool.execute(
      `SELECT d.id AS destinationId, COALESCE(d.latitude, w.latitude) AS latitude, COALESCE(d.longitude, w.longitude) AS longitude, COALESCE(d.time_zone, w.time_zone) AS timeZone,
              COALESCE(d.local_name, d.name) AS destinationName
       FROM trips t
       JOIN trip_destinations td ON td.trip_id = t.id
       JOIN destinations d ON d.id = td.destination_id
       LEFT JOIN trip_weather_location w ON w.trip_id = t.id AND w.destination_id = d.id
       LEFT JOIN trip_day_destinations day ON day.trip_id = t.id AND day.activity_date = ?
       WHERE t.id = ? AND d.id = COALESCE(?, day.destination_id, (SELECT destination_id FROM trip_destinations WHERE trip_id = t.id ORDER BY destination_order LIMIT 1))
       LIMIT 1`,
      [date || trip.startDate, tripId, destinationId],
      );
      const row = rows[0];
      location = row && row.latitude != null && row.longitude != null && row.timeZone
        ? { ...row, latitude: Number(row.latitude), longitude: Number(row.longitude) }
        : null;
    }
    res.set('Cache-Control', 'private, no-store');
    if (!process.env.OPENWEATHER_API_KEY) return res.json({ data: { status: 'not-configured', location } });
    if (!location) return res.json({ data: { status: 'missing-location', location: null } });
    try {
      const weather = await fetchWeather(location, process.env.OPENWEATHER_API_KEY);
      return res.json({ data: { status: 'available', location, date: date || trip.startDate, today: weatherLocalDate(Date.now() / 1000, location.timeZone), ...weather } });
    } catch { return res.status(503).json({ error: { code: 'WEATHER_UNAVAILABLE', message: 'Weather is unavailable right now. Try again later.' } }); }
  } catch (error) { next(error); }
});
export default router;
