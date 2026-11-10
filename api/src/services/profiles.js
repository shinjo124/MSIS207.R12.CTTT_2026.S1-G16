import { pool } from '../db/pool.js';

export async function findLocalUserId(clerkUserId) {
  const [rows] = await pool.execute(
    'SELECT id FROM users WHERE clerk_user_id = ?',
    [clerkUserId],
  );
  return rows[0]?.id ?? null;
}
