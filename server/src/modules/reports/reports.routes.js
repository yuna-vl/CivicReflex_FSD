/**
 * src/modules/reports/reports.routes.js
 * 
 * Purpose:
 * Express route definitions for the Reports API.
 * Maps endpoints to JWT auth middleware, soft optionalAuth, Zod validators, and controller functions.
 */

const express = require('express');
const reportsController = require('./reports.controller');
const { createReportSchema } = require('./reports.validation');
const auth = require('../../middleware/auth');
const optionalAuth = require('../../middleware/optionalAuth');

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

// Citizen lodged reports require authentication
router.post('/', auth, validateBody(createReportSchema), reportsController.createReport);

// Public query endpoints with optional auth for authority unblurred viewing
router.get('/', optionalAuth, reportsController.getReports);
router.get('/:id', optionalAuth, reportsController.getReportById);

// Citizen verification (requires login, uses authenticated user's userCode)
router.post('/:id/verify', auth, reportsController.verifyReport);

// Citizen / user flagging (requires login, reason required)
router.post('/:id/flag', auth, reportsController.flagReport);

module.exports = router;
