/**
 * src/middleware/actor.js
 * 
 * Purpose:
 * Temporary identity and authorization middleware for development.
 * Extracts actor credentials from HTTP headers:
 * - `x-actor-role`: 'citizen' | 'authority' | 'field_officer' | 'admin'
 * - `x-actor-id`: Non-empty caller identifier
 * - `x-actor-name`: Non-empty caller name
 * 
 * TODO: replace with real JWT auth (req.user) in feature/auth-admin
 */

const ApiError = require('../utils/ApiError');

const VALID_ROLES = ['citizen', 'authority', 'field_officer', 'admin'];

const actorMiddleware = (req, res, next) => {
  const roleHeader = req.headers['x-actor-role'];
  const idHeader = req.headers['x-actor-id'];
  const nameHeader = req.headers['x-actor-name'];

  if (!roleHeader || !idHeader || !nameHeader) {
    return next(new ApiError(401, 'Missing or invalid actor headers'));
  }

  const role = String(roleHeader).trim().toLowerCase();
  const id = String(idHeader).trim();
  const name = String(nameHeader).trim();

  if (!VALID_ROLES.includes(role) || !id || !name) {
    return next(new ApiError(401, 'Missing or invalid actor headers'));
  }

  // Treat 'admin' as allowed to perform all 'authority' actions
  req.actor = {
    role,
    id,
    name,
    isAdmin: role === 'admin',
    isAuthority: role === 'authority' || role === 'admin'
  };

  next();
};

module.exports = actorMiddleware;

