import { pool } from '../db/pool.js';

// Store write counters in MySQL so separate API instances share the same allowance.
export function sharedWriteLimit(scope, perUser, global) {
  return async (req, res, next) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      // Charge the account and global buckets together. A rejected request rolls back both increments.
      for (const [subject, limit] of [[String(req.userId), perUser], ['global', global]]) {
        await connection.execute(
          `INSERT INTO write_limits (scope, subject, window_start, hits) VALUES (?, ?, UNIX_TIMESTAMP(), 1)
           ON DUPLICATE KEY UPDATE
             hits = CASE WHEN window_start <= UNIX_TIMESTAMP() - 900 THEN 1 ELSE hits + 1 END,
             window_start = CASE WHEN window_start <= UNIX_TIMESTAMP() - 900 THEN UNIX_TIMESTAMP() ELSE window_start END`,
          [scope, subject],
        );
        const [rows] = await connection.execute('SELECT hits FROM write_limits WHERE scope = ? AND subject = ? FOR UPDATE', [scope, subject]);
        if (Number(rows[0].hits) > limit) {
          await connection.rollback();
          return res.status(429).json({ error: { code: 'WRITE_LIMITED', message: 'Too many requests. Try again later.' } });
        }
      }
      await connection.commit();
      next();
    } catch (error) {
      if (connection) await connection.rollback().catch(() => {});
      next(error);
    } finally {
      connection?.release();
    }
  };
}
