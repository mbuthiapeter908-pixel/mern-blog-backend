const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const User = require('../models/User');

// Clerk middleware that enforces a signed-in session and attaches `req.auth`
const clerkRequireAuth = ClerkExpressRequireAuth();

/**
 * requireAuth - verifies Clerk session and enriches req.auth with local user role
 * - uses ClerkExpressRequireAuth to validate the session
 * - loads the application's User (by clerkId) and sets `req.auth.role`
 */
const requireAuth = (req, res, next) => {
  clerkRequireAuth(req, res, async (err) => {
    if (err) return next(err);

    try {
      // Ensure we have a clerk user id from Clerk
      const clerkUserId = req.auth?.userId;

      // Default role when user not found in our DB
      let role = 'reader';

      if (clerkUserId) {
        const user = await User.findOne({ clerkId: clerkUserId }).select('role').lean();
        if (user && user.role) role = user.role;
      }

      req.auth = { ...(req.auth || {}), role };
      next();
    } catch (error) {
      next(error);
    }
  });
};

/**
 * requireAdmin - requires an authenticated user with the `admin` role
 */
const requireAdmin = (req, res, next) => {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.auth?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin privileges required' });
    }
    next();
  });
};

module.exports = {
  requireAuth,
  requireAdmin
};