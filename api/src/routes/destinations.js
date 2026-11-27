import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { PLACE_IDEA_TYPES, buildPlacesUrl, searchPlaceIdeas } from '../services/place-ideas.js';

const router = Router();
const DESTINATION_COLUMNS = `id, name, local_name AS localName, aliases, is_featured AS featured, country, region, category,
  admin_level AS adminLevel, merged_from AS mergedFrom, summary, summary_vi AS summaryVi,
  best_season AS bestSeason, map_query AS mapQuery, image_url AS imageUrl, latitude, longitude, time_zone AS timeZone`;

// Default: featured destinations for the home page.
// Scope all includes the entire public catalog. Custom destinations stay inside their trips.
router.get('/', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const conditions = ['custom_trip_id IS NULL'];
    const params = [];
    // scope=provinces: the 34 provinces and centrally run cities shown on the Explore page.
    if (req.query.scope === 'provinces') conditions.push('admin_level IS NOT NULL');
    else if (req.query.scope !== 'all') conditions.push('is_featured = 1');
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT ${DESTINATION_COLUMNS} FROM destinations ${where} ORDER BY name`,
      params,
    );

    res.json({ data: rows.map((row) => ({ ...row, featured: Boolean(row.featured) })) });
  } catch (error) {
    next(error);
  }
});

// Lets the page hide the "More ideas" box when no key is set.
router.get('/place-ideas/status', (req, res) => {
  res.json({ data: { enabled: Boolean(process.env.GEOAPIFY_API_KEY) } });
});

// One public catalogue destination, for the Explore province page.
router.get('/:id', async (req, res, next) => {
  const destinationId = Number(req.params.id);
  if (!Number.isSafeInteger(destinationId) || destinationId < 1) {
    return res.status(400).json({ error: { code: 'INVALID_DESTINATION_ID', message: 'Destination ID must be a positive integer.' } });
  }
  try {
    const [rows] = await pool.execute(`SELECT ${DESTINATION_COLUMNS} FROM destinations WHERE id = ? AND custom_trip_id IS NULL`, [destinationId]);
    if (!rows.length) return res.status(404).json({ error: { code: 'DESTINATION_NOT_FOUND', message: 'Destination was not found.' } });
    return res.json({ data: { ...rows[0], featured: Boolean(rows[0].featured) } });
  } catch (error) {
    return next(error);
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
      `SELECT id, destination_id AS destinationId, name, category, address, summary, summary_vi AS summaryVi,
              map_query AS mapQuery
       FROM places WHERE destination_id = ? ORDER BY name`,
      [destinationId],
    );
    res.json({ data: places });
  } catch (error) {
    next(error);
  }
});

// Live ideas from Geoapify cost a request each, so limit them per visitor.
const placeIdeasLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { code: 'PLACE_IDEAS_RATE_LIMITED', message: 'Too many searches. Try again in a few minutes.' } },
});

// Places near a catalogue destination (OpenStreetMap data via Geoapify).
router.get('/:id/place-ideas', placeIdeasLimiter, async (req, res, next) => {
  const destinationId = Number(req.params.id);
  if (!Number.isSafeInteger(destinationId) || destinationId < 1) {
    return res.status(400).json({ error: { code: 'INVALID_DESTINATION_ID', message: 'Destination ID must be a positive integer.' } });
  }
  const type = typeof req.query.type === 'string' && Object.hasOwn(PLACE_IDEA_TYPES, req.query.type) ? req.query.type : null;
  if (!type) return res.status(400).json({ error: { code: 'INVALID_PLACE_TYPE', message: 'Choose a valid place type.' } });
  try {
    const [rows] = await pool.execute(
      'SELECT id, latitude, longitude FROM destinations WHERE id = ? AND custom_trip_id IS NULL',
      [destinationId],
    );
    if (!rows.length) return res.status(404).json({ error: { code: 'DESTINATION_NOT_FOUND', message: 'Destination was not found.' } });
    if (!process.env.GEOAPIFY_API_KEY) {
      return res.status(503).json({ error: { code: 'PLACE_IDEAS_NOT_CONFIGURED', message: 'More place ideas are not set up on this server yet.' } });
    }
    const url = buildPlacesUrl({ apiKey: process.env.GEOAPIFY_API_KEY, destination: rows[0], type, language: req.query.lang });
    if (!url) return res.json({ data: [] });
    let places;
    try {
      places = await searchPlaceIdeas(url);
    } catch (error) {
      console.error(`[place-ideas] ${error.name === 'TimeoutError' ? 'Geoapify did not answer in time' : error.message.replace(/apiKey=[^&\s]+/g, 'apiKey=***')}`);
      return res.status(503).json({ error: { code: 'PLACE_IDEAS_UNAVAILABLE', message: 'Place ideas are unavailable right now. Try again later.' } });
    }
    return res.json({ data: places });
  } catch (error) {
    return next(error);
  }
});

export default router;
