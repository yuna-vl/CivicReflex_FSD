/**
 * src/modules/departments/departments.routes.js
 * 
 * Purpose:
 * Express route definitions for the Departments API.
 */

const express = require('express');
const departmentsController = require('./departments.controller');
const { createDepartmentSchema } = require('./departments.validation');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

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

// GET all departments sorted by name
router.get('/', departmentsController.getDepartments);

// GET department by unique code
router.get('/:code', departmentsController.getDepartmentByCode);

// Administrative creation: admin only
router.post('/', auth, requireRole('admin'), validateBody(createDepartmentSchema), departmentsController.createDepartment);

module.exports = router;

