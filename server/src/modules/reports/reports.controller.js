/**
 * src/modules/reports/reports.controller.js
 * 
 * Purpose:
 * Controller layer for handling HTTP requests and formatting responses for Reports.
 * Enforces uniform JSON response envelope: { success: true, data: ... }
 */

const reportsService = require('./reports.service');
const ApiError = require('../../utils/ApiError');

/**
 * POST /api/reports
 * Creates a new report or returns an existing one if idempotency key matches.
 * Takes idempotencyKey strictly from 'Idempotency-Key' request header.
 * Uses authenticated req.user as creator.
 */
const createReport = async (req, res, next) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'];

    const { report, isExisting } = await reportsService.createReport(
      req.body,
      idempotencyKey,
      req.user
    );

    const statusCode = isExisting ? 200 : 201;

    res.status(statusCode).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports
 * Retrieves paginated reports with optional filtering, bounding-box search, and keyword search.
 * Unblurs anonymous data if caller holds authority or admin role.
 */
const getReports = async (req, res, next) => {
  try {
    const isAuthority = !!(req.user && (req.user.role === 'authority' || req.user.role === 'admin'));
    const result = await reportsService.getReports(req.query, isAuthority);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/:id
 * Retrieves a single report by its unique reportId (e.g. REP-2026-1001).
 * Unblurs coordinates and metadata if caller is an authority or admin.
 */
const getReportById = async (req, res, next) => {
  try {
    const isAuthority = !!(req.user && (req.user.role === 'authority' || req.user.role === 'admin'));
    const report = await reportsService.getReportById(req.params.id, isAuthority);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reports/:id/verify
 * Adds citizen verification to a report (one vote per user).
 * Uses authenticated user's userCode instead of body userId.
 */
const verifyReport = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const report = await reportsService.verifyReport(req.params.id, req.user.userCode);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reports/:id/flag
 * Marks report as flagged for moderation.
 */
const flagReport = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      throw new ApiError(400, 'Flag reason is required');
    }

    const report = await reportsService.flagReport(req.params.id, reason.trim(), req.user);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getReports,
  getReportById,
  verifyReport,
  flagReport
};
