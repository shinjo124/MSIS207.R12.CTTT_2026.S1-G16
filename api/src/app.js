import cors from 'cors';
import express from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
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
import newsRouter from './routes/news.js';
import { isTripSyncRequest, tripSyncKey } from './services/trip-sync-limit.js';
import { apiLimitKey } from './services/api-limit.js';

const app = express();
const openApiPath = new URL('../../docs/api/openapi.yaml', import.meta.url);
const openApiDocument = parse(await readFile(fileURLToPath(openApiPath), 'utf8'));
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [
  ...configuredOrigins,
  'https://www.tripo.website',
  'https://tripo.website',
  'https://tripo-web.vercel.app',
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173']),
];
// Load Swagger UI assets from a CDN; bundling the package assets left this page blank in production.
const SWAGGER_UI = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14';
const swaggerPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tripo API docs</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/api-docs/openapi.json', dom_id: '#swagger-ui', deepLinking: true });
  </script>
</body>
</html>`;
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Isolate authenticated users and unrelated API areas from a shared-IP bucket.
  keyGenerator: (req) => {
    const auth = process.env.CLERK_SECRET_KEY ? getAuth(req) : null;
    return apiLimitKey({ userId: auth?.isAuthenticated ? auth.userId : null, ip: ipKeyGenerator(req.ip), path: req.originalUrl });
  },
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
if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware({
    // Local Clerk tokens were issued ~95s ahead; Vercel keeps Clerk's 5s default.
    clockSkewInMs: process.env.VERCEL ? undefined : 120_000,
  }));
}
// shortcut: per-process memory only; use a shared store before running multiple API instances.
app.use('/api', (req, res, next) => (isTripSyncRequest(req) ? tripSyncLimiter : apiLimiter)(req, res, next));
app.get('/api-docs/openapi.json', (_req, res) => res.json(openApiDocument));
app.get(['/api-docs', '/api-docs/'], (_req, res) => res.type('html').send(swaggerPage));
app.get('/', (_req, res) => res.redirect('/api'));

// Index for the public API URL, so /api shows where to go instead of "Cannot GET /api".
app.get('/api', (_req, res) => {
  res.json({
    name: 'Tripo API',
    docs: '/api-docs',
    health: '/api/health',
    openapi: '/api-docs/openapi.json',
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.use('/api/destinations', destinationsRouter);
app.use('/api/news', newsRouter);
app.use('/api/auth', authRouter);
app.use('/api/trips', tripsRouter);
app.use('/api', activitiesRouter);
app.use('/api', weatherRouter);
app.use('/api', shareRouter);
app.use('/api/posts', postsRouter);
app.use('/api/trip-photos', photosRouter);

// Unknown API routes answer in the spec's JSON error shape instead of Express's HTML page.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This API route does not exist. See /api-docs.' } });
});

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
