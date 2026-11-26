/**
 * src/modules/reports/reports.service.js
 * 
 * Purpose:
 * Business logic layer for Civic Reports.
 * Handles database operations, unique ID generation via counter,
 * geospatial transformations, search filtering, citizen verification,
 * and automatic grievance Ticket generation (starting at 9001).
 * Enforces system-controlled defaults (status="Reported", upvotes=0, verifiedCount=0).
 */

const Report = require('./report.model');
const Ticket = require('../tickets/ticket.model');
const { nextSequence } = require('../../utils/counter');
const { calculateExpectedResolutionDate } = require('../../constants/sla');
const ApiError = require('../../utils/ApiError');
const { safeEmit } = require('../../utils/events');
const { parseBbox } = require('../../utils/bbox');
const { logAudit } = require('../audit/audit.service');
const mongoose = require('mongoose');

/**
 * Escapes regex special characters to prevent ReDoS and regex syntax errors
 * @param {string} text
 * @returns {string}
 */
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * Creates a new report and automatically generates an associated grievance Ticket.
 * If creating the ticket fails, the report is rolled back (deleted).
 * Enforces server-managed fields so clients cannot tamper with status, upvotes, or timestamps.
 * 
 * @param {Object} reportData - Validated payload (sanitized by Zod)
 * @param {string} [idempotencyKey] - Client idempotency key taken strictly from header
 * @param {Object} [user] - Authenticated user creating the report
 * @returns {Promise<{ report: Object, isExisting: boolean }>}
 */
const createReport = async (reportData, idempotencyKey, user) => {
  const key = idempotencyKey && typeof idempotencyKey === 'string' ? idempotencyKey.trim() : undefined;

  // Check Category status if categories exist in DB (Part 4)
  const Category = mongoose.models.Category;
  if (Category) {
    const catCount = await Category.countDocuments();
    if (catCount > 0) {
      const activeCat = await Category.findOne({ name: reportData.category, status: 'Active' });
      if (!activeCat) {
        throw new ApiError(400, `Category '${reportData.category}' is invalid or inactive`);
      }
    }
  }

  // 1. Idempotency Check: return existing report if previously created with this key
  if (key) {
    const existing = await Report.findOne({ idempotencyKey: key });
    if (existing) {
      return { report: existing, isExisting: true };
    }
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  // 2. Generate unique human-readable reportId (e.g. REP-2026-1001) and ticketNumber (e.g. CR-2026-9001)
  const [reportSeq, ticketSeq] = await Promise.all([
    nextSequence('reports', 1001),
    nextSequence('tickets', 9001)
  ]);
  const reportId = `REP-${currentYear}-${reportSeq}`;
  const ticketNumber = `CR-${currentYear}-${ticketSeq}`;

  // 3. Calculate SLA expected resolution date
  const expectedResolutionDate = calculateExpectedResolutionDate(reportData.severity || 'Medium', now);

  // 4. Prepare GeoJSON geometry if both latitude and longitude are supplied
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

  // 5. Initial audit log entry
  const actionsTaken = [
    {
      timestamp: now,
      action: 'Grievance registered'
    }
  ];

  // 6. Construct report document with strict server-enforced system fields
  const newReport = new Report({
    ...reportData,
    reportId,
    ticketNumber,
    geo,
    actionsTaken,
    status: 'Reported',
    upvotes: 0,
    verifiedCount: 0,
    verifiedBy: [],
    reportedAt: now,
    slaTargetDate: expectedResolutionDate,
    idempotencyKey: key || undefined,
    createdBy: user ? user.userCode : undefined
  });

  const savedReport = await newReport.save();

  // 7. Automatically create associated grievance Ticket
  try {
    const timeline = [
      {
        stage: 'Registered',
        title: 'Grievance Registered',
        description: 'Ticket automatically created from citizen report',
        date: now,
        completed: true,
        officer: null
      },
      {
        stage: 'Assigned',
        title: 'Department Assignment',
        description: 'Pending verification and assignment to field officer',
        date: null,
        completed: false,
        officer: null
      },
      {
        stage: 'Field Inspection',
        title: 'Site Inspection',
        description: 'On-site assessment by field engineer',
        date: null,
        completed: false,
        officer: null
      },
      {
        stage: 'Execution',
        title: 'Work in Progress',
        description: 'Corrective repair or cleanup operation',
        date: null,
        completed: false,
        officer: null
      },
      {
        stage: 'Verification',
        title: 'Authority Verification',
        description: 'Quality and completion check',
        date: null,
        completed: false,
        officer: null
      },
      {
        stage: 'Closure',
        title: 'Ticket Closure',
        description: 'Citizen confirmation and final resolution',
        date: null,
        completed: false,
        officer: null
      }
    ];

    const newTicket = new Ticket({
      ticketNumber,
      reportIds: [savedReport.reportId],
      source: 'manual',
      currentStatus: 'Reported',
      urgencyLevel: reportData.severity || 'Medium',
      ward: reportData.wardNumber,
      category: reportData.category,
      issueType: reportData.subcategory || reportData.category || '',
      subject: reportData.title,
      address: reportData.location || '',
      submissionDate: now,
      expectedResolutionDate,
      priorityScore: 0,
      createdBy: user ? user.userCode : undefined,
      timeline
    });

    await newTicket.save();
  } catch (ticketError) {
    // If ticket creation fails, rollback the created report
    await Report.findByIdAndDelete(savedReport._id);
    throw ticketError;
  }

  // Audit trail logging
  logAudit({
    action: 'GRIEVANCE_LODGED',
    relatedRecord: savedReport.reportId,
    user: user ? `${user.name} (${user.userCode})` : 'System',
    role: user ? user.role : 'citizen',
    description: `Grievance registered: "${savedReport.title}" (${savedReport.ticketNumber})`
  });

  // Announce report creation event
  safeEmit('report.created', {
    reportId: savedReport.reportId,
    ticketNumber
  });

  return { report: savedReport, isExisting: false };
};

/**
 * Queries reports with filters, text search, and pagination (newest first)
 * @param {Object} queryParams
 * @param {boolean} [isAuthority=false]
 * @returns {Promise<{ items: Array, page: number, limit: number, total: number }>}
 */
const getReports = async (queryParams, isAuthority = false) => {
  const {
    wardNumber,
    type,
    category,
    status,
    timeOfDay,
    search,
    bbox,
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

  // Geospatial bounding box filter (west,south,east,north)
  if (typeof bbox !== 'undefined') {
    const { error, geoFilter } = parseBbox(bbox);
    if (error) {
      throw new ApiError(400, error);
    }
    filter.geo = geoFilter;
  }

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

  const formattedItems = isAuthority ? items.map((doc) => doc.toJSON({ isAuthority: true })) : items;

  return {
    items: formattedItems,
    page,
    limit,
    total
  };
};

/**
 * Finds a single report by its unique reportId
 * @param {string} reportId
 * @param {boolean} [isAuthority=false]
 * @returns {Promise<Object>}
 */
const getReportById = async (reportId, isAuthority = false) => {
  const report = await Report.findOne({ reportId });
  if (!report) {
    throw new ApiError(404, `Report with ID '${reportId}' not found`);
  }
  return isAuthority ? report.toJSON({ isAuthority: true }) : report;
};

/**
 * Marks a report as flagged for moderation
 * @param {string} reportId
 * @param {string} reason
 * @param {Object} user
 * @returns {Promise<Object>}
 */
const flagReport = async (reportId, reason, user) => {
  const report = await Report.findOne({ reportId });
  if (!report) {
    throw new ApiError(404, `Report with ID '${reportId}' not found`);
  }

  report.isFlagged = true;
  report.flagReason = reason;
  report.moderationStatus = 'Pending';
  report.moderationHistory.push({
    action: 'flagged',
    by: `${user.name} (${user.userCode})`,
    reason,
    at: new Date()
  });

  await report.save();
  return report;
};

/**
 * Verifies a report on behalf of a citizen user (atomic, one verification per user).
 * Uses atomic findOneAndUpdate with $ne query check and $push / $inc to prevent race conditions.
 * 
 * @param {string} reportId - The unique reportId
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} - Updated report document
 */
const verifyReport = async (reportId, userId) => {
  // 1. Atomic update: only updates if report exists AND verifiedBy does not contain userId
  const updatedReport = await Report.findOneAndUpdate(
    {
      reportId,
      verifiedBy: { $ne: userId }
    },
    {
      $push: {
        verifiedBy: userId,
        actionsTaken: {
          timestamp: new Date(),
          action: 'Verified by a citizen'
        }
      },
      $inc: { verifiedCount: 1 }
    },
    { new: true }
  );

  if (updatedReport) {
    safeEmit('report.verified', {
      reportId: updatedReport.reportId,
      userId,
      verifiedCount: updatedReport.verifiedCount
    });
    return updatedReport;
  }

  // 2. If update didn't match, determine if report doesn't exist (404) or user already verified (409)
  const reportExists = await Report.exists({ reportId });
  if (!reportExists) {
    throw new ApiError(404, `Report with ID '${reportId}' not found`);
  }

  throw new ApiError(409, 'You have already verified this report');
};

module.exports = {
  createReport,
  getReports,
  getReportById,
  verifyReport,
  flagReport
};
