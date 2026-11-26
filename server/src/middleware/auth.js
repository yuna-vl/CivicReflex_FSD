/**
 * src/middleware/auth.js
 * 
 * Purpose:
 * Authentication middleware verifying Bearer JWT access tokens on incoming requests.
 * Loads the active user from the database and verifies active status on every request.
 */

const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/token');
const User = require('../modules/users/user.model');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing or invalid authorization token');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (jwtErr) {
      throw new ApiError(401, 'Invalid or expired authorization token');
    }

    const user = await User.findOne({ userCode: decoded.sub });
    if (!user) {
      throw new ApiError(401, 'User not found or session expired');
    }

    if (user.accountStatus === 'Suspended') {
      throw new ApiError(403, 'Account suspended');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = auth;
