import cors from 'cors';
import express from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { pool } from './db/pool.js';
import destinationsRouter from './routes/destinations.js';
import authRouter from './routes/auth.js';
import shareRouter from './routes/share.js';
import postsRouter from './routes/posts.js';
import photosRouter from './routes/photos.js';
import tripsRouter from './routes/trips.js';
import activitiesRouter from './routes/activities.js';
import weatherRouter from './routes/weather.js';
import { isTripSyncRequest, tripSyncKey } from './services/trip-sync-limit.js';

const app = express();
const openApiPath = new URL('../../docs/api/openapi.yaml', import.meta.url);
const openApiDocument = parse(await readFile(fileURLToPath(openApiPath), 'utf8'));
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [
  ...configuredOrigins,
  'https://tripo-web.vercel.app',
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173']),
];
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } },
});
const tripSyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = process.env.CLERK_SECRET_KEY ? getAuth(req) : null;
    return tripSyncKey(auth?.isAuthenticated ? auth.userId : null, ipKeyGenerator(req.ip));
  },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many trip refreshes. Try again later.' } },
});

if (Number(process.env.TRUST_PROXY_HOPS) > 0) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
}
app.use(cors({
  origin: allowedOrigins,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
if (process.env.CLERK_SECRET_KEY) app.use(clerkMiddleware());
// shortcut: per-process memory only; use a shared store before running multiple API instances.
app.use('/api', (req, res, next) => (isTripSyncRequest(req) ? tripSyncLimiter : apiLimiter)(req, res, next));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.use('/api/destinations', destinationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/trips', tripsRouter);
app.use('/api', activitiesRouter);
app.use('/api', weatherRouter);
app.use('/api', shareRouter);
app.use('/api/posts', postsRouter);
app.use('/api/trip-photos', photosRouter);

app.use((error, _req, res, _next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: { code: 'IMAGE_TOO_LARGE', message: 'Images must be 4 MB or smaller.' } });
  }
  if (error.code?.startsWith('LIMIT_')) {
    return res.status(400).json({ error: { code: 'INVALID_IMAGE_UPLOAD', message: 'Upload one image in the image field.' } });
  }
  console.error(error.message);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
});

export default app;
