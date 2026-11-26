import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { GOOGLE_PLACE_TYPES, buildTextSearchRequest, searchGooglePlaces } from '../services/google-places.js';

const router = Router();

// Default: featured destinations for the home page.
// Scope all includes the entire public catalog. Custom destinations stay inside their trips.
router.get('/', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const conditions = ['custom_trip_id IS NULL'];
    const params = [];
    if (req.query.scope !== 'all') conditions.push('is_featured = 1');
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT id, name, local_name AS localName, aliases, is_featured AS featured, country, region, category,
              summary, best_season AS bestSeason, map_query AS mapQuery, image_url AS imageUrl,
              latitude, longitude, time_zone AS timeZone
       FROM destinations ${where} ORDER BY name`,
      params,
    );

    res.json({ data: rows.map((row) => ({ ...row, featured: Boolean(row.featured) })) });
  } catch (error) {
    next(error);
  }
});

// Check the public destination first so an empty place list and a missing destination are distinct.
router.get('/:id/places', async (req, res, next) => {
  const destinationId = Number(req.params.id);
  if (!Number.isSafeInteger(destinationId) || destinationId < 1) {
    return res.status(400).json({
      error: { code: 'INVALID_DESTINATION_ID', message: 'Destination ID must be a positive integer.' },
    });
  }

  try {
    const [destinationRows] = await pool.execute(
      'SELECT id FROM destinations WHERE id = ? AND custom_trip_id IS NULL',
      [destinationId],
    );
    if (!destinationRows.length) {
      return res.status(404).json({
        error: { code: 'DESTINATION_NOT_FOUND', message: 'Destination was not found.' },
      });
    }

    const [places] = await pool.execute(
      `SELECT id, destination_id AS destinationId, name, category, address, summary,
              map_query AS mapQuery
       FROM places WHERE destination_id = ? ORDER BY name`,
      [destinationId],
    );
    res.json({ data: places });
  } catch (error) {
    next(error);
  }
});

// Each search is a paid Google call, so limit it per signed-in user.
const googlePlacesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: (req) => `google-places:${req.userId}`,
  message: { error: { code: 'GOOGLE_PLACES_RATE_LIMITED', message: 'Too many Google searches. Try again in a few minutes.' } },
});

// Live ideas from Google Maps for a catalogue destination. Results are not stored (Google's terms).
router.get('/:id/google-places', requireAuth, requireProfile, googlePlacesLimiter, async (req, res, next) => {
  const destinationId = Number(req.params.id);
  if (!Number.isSafeInteger(destinationId) || destinationId < 1) {
    return res.status(400).json({ error: { code: 'INVALID_DESTINATION_ID', message: 'Destination ID must be a positive integer.' } });
  }
  const type = typeof req.query.type === 'string' && Object.hasOwn(GOOGLE_PLACE_TYPES, req.query.type) ? req.query.type : null;
  if (!type) return res.status(400).json({ error: { code: 'INVALID_PLACE_TYPE', message: 'Choose a valid place type.' } });
  res.set('Cache-Control', 'private, no-store');
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, local_name AS localName, country, latitude, longitude
       FROM destinations WHERE id = ? AND custom_trip_id IS NULL`,
      [destinationId],
    );
    if (!rows.length) return res.status(404).json({ error: { code: 'DESTINATION_NOT_FOUND', message: 'Destination was not found.' } });
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return res.status(503).json({ error: { code: 'GOOGLE_PLACES_NOT_CONFIGURED', message: 'Google suggestions are not set up on this server yet.' } });
    }
    let places;
    try {
      places = await searchGooglePlaces({ apiKey: process.env.GOOGLE_PLACES_API_KEY, body: buildTextSearchRequest(rows[0], type, req.query.lang) });
    } catch (error) {
      console.error(`[google-places] ${error.name === 'TimeoutError' ? 'Google did not answer in time' : error.message}`);
      return res.status(503).json({ error: { code: 'GOOGLE_PLACES_UNAVAILABLE', message: 'Google suggestions are unavailable right now. Try again later.' } });
    }
    return res.json({ data: places });
  } catch (error) {
    return next(error);
  }
});

export default router;
