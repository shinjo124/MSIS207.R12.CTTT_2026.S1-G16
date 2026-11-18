import { Router } from 'express';
import { getNews } from '../services/newsService.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=600').json({ data: await getNews() });
  } catch (error) {
    next(error);
  }
});

export default router;
