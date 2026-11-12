import { findLocalUserId } from '../services/profiles.js';

// Use after requireAuth on every write route that needs the local users.id
// (e.g. trips.owner_user_id). The web calls GET /api/auth/me after sign-in to create the profile.
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
