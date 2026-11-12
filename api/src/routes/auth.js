import { clerkClient } from '@clerk/express';
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/require-auth.js';

const router = Router();

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const clerkUser = await clerkClient.users.getUser(req.clerkUserId);
    const email = clerkUser.primaryEmailAddress?.emailAddress;
    if (!email) {
      return res.status(422).json({
        error: { code: 'EMAIL_REQUIRED', message: 'Your account needs a primary email address.' },
      });
    }

    const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')
      || email.split('@')[0];

    await pool.execute(
      `INSERT INTO users (clerk_user_id, email, display_name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE email = VALUES(email), display_name = VALUES(display_name)`,
      [req.clerkUserId, email, displayName],
    );
    const [rows] = await pool.execute(
      'SELECT id, email, display_name AS displayName FROM users WHERE clerk_user_id = ?',
      [req.clerkUserId],
    );

    res.json({ data: rows[0] });
  } catch (error) {
    // Email is UNIQUE: a re-created Clerk account with an old email would otherwise be a 500.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: { code: 'EMAIL_IN_USE', message: 'This email is already linked to another Tripo account.' },
      });
    }
    next(error);
  }
});

export default router;
