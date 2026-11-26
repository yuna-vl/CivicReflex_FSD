/**
 * src/modules/admin/admin.routes.js
 * 
 * Purpose:
 * Express route definitions for all administrative governance endpoints.
 * All routes mounted here strictly require an authenticated caller with the 'admin' role.
 */

const express = require('express');
const adminController = require('./admin.controller');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const {
  createUserSchema,
  suspendUserSchema,
  moderationDecisionSchema,
  wardSchema,
  updateWardSchema,
  categorySchema,
  updateCategorySchema,
  settingsSchema
} = require('./admin.validation');

const router = express.Router();

/**
 * Middleware for validating request body against a Zod schema
 */
const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

// Global protection: Admin only
router.use(auth, requireRole('admin'));

// 1. Users management (Part 2)
router.get('/users', adminController.getUsers);
router.post('/users', validateBody(createUserSchema), adminController.createUser);
router.patch('/users/:id/suspend', validateBody(suspendUserSchema), adminController.suspendUser);
router.patch('/users/:id/reinstate', adminController.reinstateUser);

// 2. Audit logs (Part 3 & Part 5)
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/audit-logs/verify', adminController.verifyAuditChain);

// 3. Moderation (Part 4)
router.get('/moderation', adminController.getModeration);
router.post('/moderation/:reportId/decision', validateBody(moderationDecisionSchema), adminController.decideModeration);

// 4. Municipal Wards (Part 4)
router.get('/wards', adminController.getWards);
router.post('/wards', validateBody(wardSchema), adminController.createWard);
router.patch('/wards/:wardNumber', validateBody(updateWardSchema), adminController.updateWard);

// 5. Departments (Part 4)
router.patch('/departments/:code', adminController.updateDepartment);

// 6. Categories (Part 4)
router.get('/categories', adminController.getCategories);
router.post('/categories', validateBody(categorySchema), adminController.createCategory);
router.patch('/categories/:id', validateBody(updateCategorySchema), adminController.updateCategory);

// 7. Operational Settings (Part 4)
router.get('/settings', adminController.getSettings);
router.put('/settings', validateBody(settingsSchema), adminController.updateSettings);

// 8. Overview metrics (Part 4)
router.get('/overview', adminController.getOverview);

module.exports = router;
