import { Router } from 'express';
import { getNews } from '../services/newsService.js';

const router = Router();

// Expose one public response for the dashboard. The service fetches and combines the feeds.
router.get('/', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=600').json({ data: await getNews() });
  } catch (error) {
    next(error);
  }
});

export default router;
