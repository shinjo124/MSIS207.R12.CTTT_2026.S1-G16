import { countDays } from './trip-rules.js';

// Keep SQL aliases consistent across routes and return calendar dates as strings.
export const TRIP_COLUMNS = `t.id, t.title,
  DATE_FORMAT(t.start_date, '%Y-%m-%d') AS startDate,
  DATE_FORMAT(t.end_date, '%Y-%m-%d') AS endDate,
  t.group_size AS groupSize, t.budget, t.currency_code AS currencyCode,
  t.share_enabled AS shareEnabled, t.time_zone AS timeZone, t.revision, t.created_at AS createdAt, t.updated_at AS updatedAt`;

export const ACTIVITY_COLUMNS = `a.id, a.trip_id AS tripId,
  DATE_FORMAT(a.activity_date, '%Y-%m-%d') AS date,
  TIME_FORMAT(a.start_time, '%H:%i') AS time, a.duration_minutes AS durationMinutes, a.version,
  a.category, a.title, a.city, a.address,
  a.planned_cost AS plannedCost, a.actual_spend AS actualSpend,
  a.note, a.visited`;

export function shapeTrip(row) {
  return { ...row, shareEnabled: Boolean(row.shareEnabled), dayCount: countDays(row.startDate, row.endDate) };
}

export function shapeActivity(row) {
  return { ...row, visited: Boolean(row.visited) };
}

export async function findOwnedTrip(db, tripId, userId, lock = false) {
  const [rows] = await db.execute(
    `SELECT ${TRIP_COLUMNS} FROM trips t WHERE t.id = ? AND t.owner_user_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [tripId, userId],
  );
  return rows[0] ? shapeTrip(rows[0]) : null;
}

// Owners and invited members can edit. Mutation callers pass a transaction and request row locks.
export async function findEditableTrip(db, tripId, userId, lock = false) {
  const [rows] = await db.execute(
    `SELECT ${TRIP_COLUMNS}, t.owner_user_id AS ownerUserId FROM trips t WHERE t.id = ?${lock ? ' FOR UPDATE' : ''}`,
    [tripId],
  );
  if (!rows.length) return null;
  const { ownerUserId, ...trip } = rows[0];
  if (Number(ownerUserId) !== Number(userId)) {
    const [members] = await db.execute(
      `SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id = ?${lock ? ' FOR UPDATE' : ''}`,
      [tripId, userId],
    );
    if (!members.length) return null;
  }
  return { ...shapeTrip(trip), role: Number(ownerUserId) === Number(userId) ? 'owner' : 'member' };
}
