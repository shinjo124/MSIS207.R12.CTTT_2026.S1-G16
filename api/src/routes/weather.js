import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { findEditableTrip } from './trips.js';
import { parseId, sendError } from '../services/trip-rules.js';
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
  try {
    if (!await findEditableTrip(pool, tripId, req.userId)) return sendError(res, notFound);
    const [rows] = await pool.execute(`SELECT w.destination_id AS destinationId, w.latitude, w.longitude, w.time_zone AS timeZone, COALESCE(d.local_name, d.name) AS destinationName FROM trip_weather_location w JOIN trip_destinations td ON td.trip_id = w.trip_id AND td.destination_id = w.destination_id JOIN destinations d ON d.id = w.destination_id WHERE w.trip_id = ?`, [tripId]);
    const location = rows[0] ? { ...rows[0], latitude: Number(rows[0].latitude), longitude: Number(rows[0].longitude) } : null;
    res.set('Cache-Control', 'private, no-store');
    if (!process.env.OPENWEATHER_API_KEY) return res.json({ data: { status: 'not-configured', location } });
    if (!location) return res.json({ data: { status: 'missing-location', location: null } });
    try {
      const weather = await fetchWeather(location, process.env.OPENWEATHER_API_KEY);
      return res.json({ data: { status: 'available', location, today: weatherLocalDate(Date.now() / 1000, location.timeZone), ...weather } });
    } catch { return res.status(503).json({ error: { code: 'WEATHER_UNAVAILABLE', message: 'Weather is unavailable right now. Try again later.' } }); }
  } catch (error) { next(error); }
});
export default router;
