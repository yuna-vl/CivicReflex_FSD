/**
 * src/modules/reports/reports.routes.js
 * 
 * Purpose:
 * Express route definitions for the Reports API.
 * Maps endpoints to validation middleware and controller functions.
 */

const express = require('express');
const reportsController = require('./reports.controller');
const { createReportSchema } = require('./reports.validation');

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

// TODO: protect with auth in feature/auth-admin
router.post('/', validateBody(createReportSchema), reportsController.createReport);

// TODO: protect with auth in feature/auth-admin
router.get('/', reportsController.getReports);

// TODO: protect with auth in feature/auth-admin
router.get('/:id', reportsController.getReportById);

module.exports = router;

