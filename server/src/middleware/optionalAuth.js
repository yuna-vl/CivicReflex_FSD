/**
 * src/middleware/optionalAuth.js
 * 
 * Purpose:
 * Soft authentication middleware. Attaches req.user if a valid Bearer token is provided,
 * but allows unauthenticated requests to proceed.
 */

const { verifyAccessToken } = require('../utils/token');
const User = require('../modules/users/user.model');

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyAccessToken(token);
        const user = await User.findOne({ userCode: decoded.sub });
        if (user && user.accountStatus !== 'Suspended') {
          req.user = user;
        }
      } catch (e) {
        // Soft fail: proceed without req.user
      }
    }
    next();
  } catch (err) {
    next();
  }
};

module.exports = optionalAuth;
