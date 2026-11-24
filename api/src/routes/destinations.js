import { Router } from 'express';
import { pool } from '../db/pool.js';

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

export default router;
