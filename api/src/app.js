import cors from 'cors';
import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { pool } from './db/pool.js';
import destinationsRouter from './routes/destinations.js';
import authRouter from './routes/auth.js';
import shareRouter from './routes/share.js';

const app = express();
const openApiPath = new URL('../../docs/api/openapi.yaml', import.meta.url);
const openApiDocument = parse(await readFile(fileURLToPath(openApiPath), 'utf8'));
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } },
});

if (Number(process.env.TRUST_PROXY_HOPS) > 0) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
}
app.use(cors({ origin: allowedOrigins, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '1mb' }));
if (process.env.CLERK_SECRET_KEY) app.use(clerkMiddleware());
// shortcut: per-process memory only; use a shared store before running multiple API instances.
app.use('/api', apiLimiter);
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
app.use('/api', shareRouter);

app.use((error, _req, res, _next) => {
  console.error(error.message);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' } });
});

export default app;
