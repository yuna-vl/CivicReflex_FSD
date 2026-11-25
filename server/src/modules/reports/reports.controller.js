/**
 * src/modules/reports/reports.controller.js
 * 
 * Purpose:
 * Controller layer for handling HTTP requests and formatting responses for Reports.
 * Ensures consistent response envelopes:
 * { success: true, data: ... } or { success: false, error: { message: ... } }
 */

const reportsService = require('./reports.service');

/**
 * POST /api/reports
 * Creates a new report or returns an existing one if idempotency key matches.
 * Takes idempotencyKey ONLY from the 'Idempotency-Key' request header.
 */
const createReport = async (req, res, next) => {
  try {
    // Take idempotencyKey strictly from the Idempotency-Key header
    const idempotencyKey = req.headers['idempotency-key'];

    const { report, isExisting } = await reportsService.createReport(
      req.body,
      idempotencyKey
    );

    // 200 for idempotent retrieval of existing report, 201 for fresh creation
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
 * Retrieves paginated reports with optional filtering and keyword search.
 */
const getReports = async (req, res, next) => {
  try {
    const result = await reportsService.getReports(req.query);

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
 */
const getReportById = async (req, res, next) => {
  try {
    const report = await reportsService.getReportById(req.params.id);

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
 */
const verifyReport = async (req, res, next) => {
  try {
    // TODO: replace body userId with req.user.id in feature/auth-admin
    const { userId } = req.body;
    const report = await reportsService.verifyReport(req.params.id, userId);

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
  verifyReport
};
