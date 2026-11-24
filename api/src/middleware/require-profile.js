import { findLocalUserId } from '../services/profiles.js';

// Run after requireAuth to translate the Clerk identity into the numeric ID used by MySQL.
// The browser calls /api/auth/me after sign-in to create or refresh this profile.
export async function requireProfile(req, res, next) {
  try {
    const userId = await findLocalUserId(req.clerkUserId);
    if (!userId) {
      return res.status(409).json({
        error: { code: 'PROFILE_NOT_READY', message: 'Load your profile before continuing.' },
      });
    }
    req.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
}
