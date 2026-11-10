import { getAuth } from '@clerk/express';

export function requireAuth(req, res, next) {
  if (!process.env.CLERK_SECRET_KEY) {
    return res.status(503).json({
      error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured.' },
    });
  }

  const { isAuthenticated, userId } = getAuth(req);
  if (!isAuthenticated || !userId) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
    });
  }

  req.clerkUserId = userId;
  next();
}
