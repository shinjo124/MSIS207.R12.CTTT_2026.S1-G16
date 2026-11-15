import { pool } from '../db/pool.js';

export async function findLocalUserId(clerkUserId) {
  const [rows] = await pool.execute(
    'SELECT id FROM users WHERE clerk_user_id = ?',
    [clerkUserId],
  );
  return rows[0]?.id ?? null;
}

export async function syncProfile(clerkId, email, displayName, db = pool) {
  let conflict;
  try {
    await db.execute('INSERT INTO users (clerk_user_id, email, display_name) VALUES (?, ?, ?)', [clerkId, email, displayName]);
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error;
    conflict = error;
    await db.execute('UPDATE users SET email = ?, display_name = ? WHERE clerk_user_id = ?', [email, displayName, clerkId]);
  }
  const [rows] = await db.execute('SELECT id, email, display_name AS displayName FROM users WHERE clerk_user_id = ?', [clerkId]);
  if (!rows.length) throw conflict || new Error('Profile disappeared during sync');
  return rows[0];
}
