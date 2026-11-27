import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { findEditableTrip } from '../services/trip-data.js';
import { badRequest, parseId, sendError } from '../services/trip-rules.js';
import { settleUp, validatePersonName } from '../services/split-bill.js';

// Split bill for a trip: people, who paid each recorded spend, who shares it, and who owes whom.
const router = Router();
const signedIn = [requireAuth, requireProfile];
const TRIP_NOT_FOUND = { status: 404, code: 'TRIP_NOT_FOUND', message: 'Trip was not found.' };

async function loadPeople(db, tripId) {
  const [rows] = await db.execute('SELECT id, name, user_id AS userId FROM trip_people WHERE trip_id = ? ORDER BY id', [tripId]);
  return rows.map((row) => ({ id: Number(row.id), name: row.name, userId: row.userId == null ? null : Number(row.userId) }));
}

export async function loadSplit(db, trip) {
  const people = await loadPeople(db, trip.id);
  const [activities] = await db.execute(
    `SELECT id, title, DATE_FORMAT(activity_date, '%Y-%m-%d') AS date, actual_spend AS amount, paid_by_person_id AS paidBy
     FROM activities WHERE trip_id = ? AND actual_spend IS NOT NULL AND actual_spend > 0
     ORDER BY activity_date, start_time IS NULL, start_time, id`,
    [trip.id],
  );
  const [splitRows] = await db.execute(
    'SELECT s.activity_id AS activityId, s.person_id AS personId FROM activity_split_people s JOIN activities a ON a.id = s.activity_id WHERE a.trip_id = ?',
    [trip.id],
  );
  const participants = new Map();
  for (const row of splitRows) participants.set(Number(row.activityId), [...(participants.get(Number(row.activityId)) || []), Number(row.personId)]);
  const expenses = activities.map((row) => ({
    activityId: Number(row.id), title: row.title, date: row.date, amount: String(row.amount),
    paidBy: row.paidBy == null ? null : Number(row.paidBy), participants: (participants.get(Number(row.id)) || []).sort((a, b) => a - b),
  }));

  // Tripo members not yet in the list, offered as one-click additions.
  const [members] = await db.execute(
    `SELECT u.id, u.display_name AS name FROM trips t JOIN users u ON u.id = t.owner_user_id WHERE t.id = ?
     UNION SELECT u.id, u.display_name AS name FROM trip_members m JOIN users u ON u.id = m.user_id WHERE m.trip_id = ?`,
    [trip.id, trip.id],
  );
  const linked = new Set(people.map((person) => person.userId).filter(Boolean));
  const names = new Set(people.map((person) => person.name.toLowerCase()));
  const suggestions = members
    .filter((member) => member.name && !linked.has(Number(member.id)) && !names.has(String(member.name).toLowerCase()))
    .map((member) => ({ userId: Number(member.id), name: String(member.name).slice(0, 60) }));

  return { currencyCode: trip.currencyCode, people, expenses, suggestions, ...settleUp(people, expenses) };
}

// Run a change inside a transaction with the trip locked, then bump the revision so other tabs refresh.
async function changeTrip(req, res, next, tripId, work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const trip = await findEditableTrip(connection, tripId, req.userId, true);
    if (!trip) { await connection.rollback(); return sendError(res, TRIP_NOT_FOUND); }
    const failure = await work(connection, trip);
    if (failure) { await connection.rollback(); return sendError(res, failure); }
    await connection.execute('UPDATE trips SET revision = revision + 1 WHERE id = ?', [tripId]);
    const data = await loadSplit(connection, trip);
    await connection.commit();
    return res.json({ data });
  } catch (error) {
    await connection.rollback().catch(() => {});
    return next(error);
  } finally {
    connection.release();
  }
}

router.get('/trips/:tripId/split', signedIn, async (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, badRequest('INVALID_TRIP_ID', 'Trip ID must be a positive integer.'));
  try {
    const trip = await findEditableTrip(pool, tripId, req.userId);
    if (!trip) return sendError(res, TRIP_NOT_FOUND);
    res.set('Cache-Control', 'private, no-store').json({ data: await loadSplit(pool, trip) });
  } catch (error) { next(error); }
});

router.post('/trips/:tripId/people', signedIn, (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return sendError(res, badRequest('INVALID_TRIP_ID', 'Trip ID must be a positive integer.'));
  const name = validatePersonName(req.body?.name);
  if (!name) return sendError(res, badRequest('INVALID_PERSON_NAME', 'Enter a name of up to 60 characters.'));
  const userId = req.body?.userId == null ? null : parseId(req.body.userId);
  return changeTrip(req, res, next, tripId, async (db) => {
    const [count] = await db.execute('SELECT COUNT(*) AS n FROM trip_people WHERE trip_id = ?', [tripId]);
    if (Number(count[0].n) >= 30) return { status: 400, code: 'TOO_MANY_PEOPLE', message: 'A trip can split costs between up to 30 people.' };
    const [same] = await db.execute('SELECT id FROM trip_people WHERE trip_id = ? AND name = ?', [tripId, name]);
    if (same.length) return { status: 409, code: 'PERSON_EXISTS', message: 'This name is already in the list.' };
    let linkedUser = null;
    if (userId) {
      const [ok] = await db.execute(
        'SELECT 1 FROM trips WHERE id = ? AND owner_user_id = ? UNION SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?',
        [tripId, userId, tripId, userId],
      );
      if (ok.length) linkedUser = userId;
    }
    await db.execute('INSERT INTO trip_people (trip_id, name, user_id) VALUES (?, ?, ?)', [tripId, name, linkedUser]);
    return null;
  });
});

router.delete('/trips/:tripId/people/:personId', signedIn, (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  const personId = parseId(req.params.personId);
  if (!tripId || !personId) return sendError(res, badRequest('INVALID_ID', 'Trip and person IDs must be positive integers.'));
  return changeTrip(req, res, next, tripId, async (db) => {
    const [result] = await db.execute('DELETE FROM trip_people WHERE id = ? AND trip_id = ?', [personId, tripId]);
    return result.affectedRows ? null : { status: 404, code: 'PERSON_NOT_FOUND', message: 'This person is not on the trip.' };
  });
});

// Who paid one recorded spend, and who shares it ([] = the whole group).
router.put('/trips/:tripId/split/:activityId', signedIn, (req, res, next) => {
  const tripId = parseId(req.params.tripId);
  const activityId = parseId(req.params.activityId);
  if (!tripId || !activityId) return sendError(res, badRequest('INVALID_ID', 'Trip and activity IDs must be positive integers.'));
  const paidBy = req.body?.paidBy == null ? null : parseId(req.body.paidBy);
  const list = req.body?.participants;
  if ((req.body?.paidBy != null && !paidBy) || !Array.isArray(list) || list.length > 30 || list.some((id) => !parseId(id))) {
    return sendError(res, badRequest('INVALID_SPLIT', 'Send paidBy (a person ID or null) and participants (a list of person IDs).'));
  }
  const participants = [...new Set(list.map(Number))];
  return changeTrip(req, res, next, tripId, async (db) => {
    const [activities] = await db.execute('SELECT id FROM activities WHERE id = ? AND trip_id = ? FOR UPDATE', [activityId, tripId]);
    if (!activities.length) return { status: 404, code: 'ACTIVITY_NOT_FOUND', message: 'Activity was not found.' };
    const people = new Set((await loadPeople(db, tripId)).map((person) => person.id));
    if ((paidBy && !people.has(paidBy)) || participants.some((id) => !people.has(id))) {
      return { status: 400, code: 'UNKNOWN_PERSON', message: 'Choose people from this trip.' };
    }
    await db.execute('UPDATE activities SET paid_by_person_id = ? WHERE id = ?', [paidBy, activityId]);
    await db.execute('DELETE FROM activity_split_people WHERE activity_id = ?', [activityId]);
    for (const personId of participants) await db.execute('INSERT INTO activity_split_people (activity_id, person_id) VALUES (?, ?)', [activityId, personId]);
    return null;
  });
});

export default router;
