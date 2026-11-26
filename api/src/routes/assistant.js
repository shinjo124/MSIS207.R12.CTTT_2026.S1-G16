import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { loadTripDetail } from './trips.js';
import { parseId, sendError } from '../services/trip-rules.js';
import { DEFAULT_GEMINI_MODEL, GENERAL_CONTEXT, askGemini, buildTripContext, parseModelReply, validateMessages } from '../services/assistant.js';

const router = Router();
// Each question costs an AI call, so limit it per signed-in user.
const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: (req) => `assistant:${req.userId}`,
  message: { error: { code: 'ASSISTANT_RATE_LIMITED', message: 'Too many questions for Tribot. Try again in a few minutes.' } },
});

const INVALID_MESSAGES = { status: 400, code: 'INVALID_MESSAGES', message: 'Send 1–12 messages of up to 2000 characters, ending with your question.' };

async function loadPlaces(trip) {
  const destinationIds = trip.destinations.map((d) => d.id);
  if (!destinationIds.length) return [];
  const [places] = await pool.execute(
    `SELECT p.name, p.category, p.address, COALESCE(d.local_name, d.name) AS destinationName
     FROM places p JOIN destinations d ON d.id = p.destination_id
     WHERE p.destination_id IN (${destinationIds.map(() => '?').join(', ')}) ORDER BY d.id, p.name LIMIT 60`,
    destinationIds,
  );
  return places;
}

// Calls Gemini and sends the checked reply. Answers are not stored.
async function answer(res, { context, messages, trip }) {
  res.set('Cache-Control', 'private, no-store');
  if (!process.env.GEMINI_API_KEY) return sendError(res, { status: 503, code: 'ASSISTANT_NOT_CONFIGURED', message: 'Tribot is not set up on this server yet.' });
  let text;
  try {
    text = await askGemini({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, context, messages });
  } catch (error) {
    console.error(`[tribot] ${error.name === 'TimeoutError' ? 'Gemini did not answer in time' : error.message}`);
    return sendError(res, { status: 503, code: 'ASSISTANT_UNAVAILABLE', message: 'Tribot is unavailable right now. Try again later.' });
  }
  return res.json({ data: parseModelReply(text, trip) });
}

// General travel questions from any page (the floating chat with no trip chosen).
router.post('/assistant', requireAuth, requireProfile, assistantLimiter, async (req, res, next) => {
  const parsed = validateMessages(req.body);
  if (!parsed.ok) return sendError(res, INVALID_MESSAGES);
  try { await answer(res, { context: GENERAL_CONTEXT, messages: parsed.value, trip: null }); } catch (error) { next(error); }
});

// Questions about one trip. Owners and members only.
router.post('/trips/:tripId/assistant', requireAuth, requireProfile, assistantLimiter, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, { status: 400, code: 'INVALID_TRIP_ID', message: 'Trip ID must be a positive integer.' });
  const parsed = validateMessages(req.body);
  if (!parsed.ok) return sendError(res, INVALID_MESSAGES);
  try {
    const trip = await loadTripDetail(tripId, req.userId);
    if (!trip) return sendError(res, { status: 404, code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' });
    const places = await loadPlaces(trip);
    await answer(res, { context: buildTripContext(trip, places), messages: parsed.value, trip });
  } catch (error) { next(error); }
});

export default router;
