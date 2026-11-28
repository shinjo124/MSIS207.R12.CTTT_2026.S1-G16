import { clerkClient } from '@clerk/express';
import { Router } from 'express';
import { syncProfile } from '../services/profiles.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireProfile } from '../middleware/require-profile.js';
import { pool } from '../db/pool.js';
import { validateUsername } from '../services/chat-rules.js';

const router = Router();

// Sync the Clerk account into MySQL before the browser opens features that need a local user ID.
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

    res.json({ data: await syncProfile(req.clerkUserId, email, displayName) });
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

// The signed-in user's Tripo username (null until they choose one).
router.get('/username', requireAuth, requireProfile, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT username FROM users WHERE id = ?', [req.userId]);
    res.json({ data: { username: rows[0]?.username || null } });
  } catch (error) { next(error); }
});

// Choose or change the Tripo username others search for in Messages.
router.put('/username', requireAuth, requireProfile, async (req, res, next) => {
  const username = validateUsername(req.body?.username);
  if (!username) {
    return res.status(400).json({
      error: { code: 'INVALID_USERNAME', message: 'Use 3–20 letters a–z, numbers, dots or underscores, without accents.' },
    });
  }
  try {
    await pool.execute('UPDATE users SET username = ? WHERE id = ?', [username, req.userId]);
    res.json({ data: { username } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: 'This username is already taken.' } });
    }
    next(error);
  }
});

export default router;
