import { clerkClient } from '@clerk/express';
import { Router } from 'express';
import { syncProfile } from '../services/profiles.js';
import { requireAuth } from '../middleware/require-auth.js';

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

export default router;
