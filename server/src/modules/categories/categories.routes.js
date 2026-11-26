/**
 * src/modules/categories/categories.routes.js
 * 
 * Purpose:
 * Express route definitions for public category lookups.
 * Returns only active categories for citizen report lodging forms.
 */

const express = require('express');
const adminService = require('../admin/admin.service');

const router = express.Router();

/**
 * GET /api/categories
 * Public endpoint returning all active grievance categories
 */
router.get('/', async (req, res, next) => {
  try {
    const categories = await adminService.getCategories(false);
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
