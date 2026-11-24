/**
 * src/modules/reports/reports.service.js
 * 
 * Purpose:
 * Business logic layer for Civic Reports.
 * Handles database operations, unique ID generation via counter,
 * geospatial transformations, and search filtering.
 * Enforces system-controlled defaults (status="Reported", upvotes=0, verifiedCount=0).
 */

const Report = require('./report.model');
const { nextSequence } = require('../../utils/counter');
const ApiError = require('../../utils/ApiError');

/**
 * Escapes regex special characters to prevent ReDoS and regex syntax errors
 * @param {string} text
 * @returns {string}
 */
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * Creates a new report or returns an existing one if the idempotency key matches.
 * Enforces server-managed fields so clients cannot tamper with status, upvotes, or timestamps.
 * 
 * @param {Object} reportData - Validated payload (sanitized by Zod)
 * @param {string} [idempotencyKey] - Client idempotency key taken strictly from header
 * @returns {Promise<{ report: Object, isExisting: boolean }>}
 */
const createReport = async (reportData, idempotencyKey) => {
  const key = idempotencyKey && typeof idempotencyKey === 'string' ? idempotencyKey.trim() : undefined;

  // 1. Idempotency Check: return existing report if previously created with this key
  if (key) {
    const existing = await Report.findOne({ idempotencyKey: key });
    if (existing) {
      return { report: existing, isExisting: true };
    }
  }

  // 2. Generate unique human-readable reportId (e.g. REP-2026-1001)
  const currentYear = new Date().getFullYear();
  const sequenceNumber = await nextSequence('reports');
  const reportId = `REP-${currentYear}-${sequenceNumber}`;

  // 3. Prepare GeoJSON geometry if both latitude and longitude are supplied
  let geo;
  if (
    typeof reportData.latitude === 'number' &&
    typeof reportData.longitude === 'number'
  ) {
    geo = {
      type: 'Point',
      coordinates: [reportData.longitude, reportData.latitude] // GeoJSON: [longitude, latitude]
    };
  }

  // 4. Initial audit log entry
  const actionsTaken = [
    {
      timestamp: new Date(),
      action: 'Grievance registered'
    }
  ];

  // 5. Construct document with strict server-enforced system fields
  const newReport = new Report({
    ...reportData,
    reportId,
    geo,
    actionsTaken,
    // Server-controlled fields: client values are completely ignored/overridden
    status: 'Reported',
    upvotes: 0,
    verifiedCount: 0,
    reportedAt: new Date(),
    idempotencyKey: key || undefined
  });

  const savedReport = await newReport.save();
  return { report: savedReport, isExisting: false };
};

/**
 * Queries reports with filters, text search, and pagination (newest first)
 * @param {Object} queryParams
 * @returns {Promise<{ items: Array, page: number, limit: number, total: number }>}
 */
const getReports = async (queryParams) => {
  const {
    wardNumber,
    type,
    category,
    status,
    timeOfDay,
    search,
    page: rawPage,
    limit: rawLimit
  } = queryParams;

  // Sanitize pagination inputs
  const parsedPage = parseInt(rawPage, 10);
  const parsedLimit = parseInt(rawLimit, 10);
  const page = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = !isNaN(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 20;
  const skip = (page - 1) * limit;

  // Build MongoDB query filter
  const filter = {};

  if (wardNumber) filter.wardNumber = wardNumber;
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (timeOfDay) filter.timeOfDay = timeOfDay;

  // Text search on title or description (case-insensitive, regex-escaped)
  if (search && search.trim() !== '') {
    const safeRegex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ title: safeRegex }, { description: safeRegex }];
  }

  // Execute query and count in parallel
  const [items, total] = await Promise.all([
    Report.find(filter).sort({ reportedAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments(filter)
  ]);

  return {
    items,
    page,
    limit,
    total
  };
};

/**
 * Finds a single report by its unique reportId
 * @param {string} reportId
 * @returns {Promise<Object>}
 */
const getReportById = async (reportId) => {
  const report = await Report.findOne({ reportId });
  if (!report) {
    throw new ApiError(404, `Report with ID '${reportId}' not found`);
  }
  return report;
};

module.exports = {
  createReport,
  getReports,
  getReportById
};
