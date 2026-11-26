/**
 * src/middleware/requireRole.js
 * 
 * Purpose:
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated caller holds one of the specified roles.
 * Treats 'admin' as having universal supervisor authority over 'authority' routes.
 */

const ApiError = require('../utils/ApiError');

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    const userRole = req.user.role;

    // Check if user's role is in allowed list, or if user is admin when authority is accepted
    const isDirectMatch = allowedRoles.includes(userRole);
    const isAdminInheritingAuthority = userRole === 'admin' && allowedRoles.includes('authority');
    const isAdminSuper = userRole === 'admin';

    // If allowedRoles explicitly requires admin, isAdminSuper matches.
    // If it requires authority or other, admin is permitted.
    if (isDirectMatch || isAdminInheritingAuthority || (isAdminSuper && !allowedRoles.includes('field_officer'))) {
      return next();
    }

    return next(new ApiError(403, `Forbidden: Role '${userRole}' does not have sufficient permissions`));
  };
};

module.exports = requireRole;
