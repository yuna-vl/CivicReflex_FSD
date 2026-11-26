/**
 * src/modules/admin/admin.service.js
 * 
 * Purpose:
 * Core administrative service layer handling user governance, moderation workflows,
 * municipal wards, department maintenance, settings, and operational metrics.
 */

const User = require('../users/user.model');
const Report = require('../reports/report.model');
const Ticket = require('../tickets/ticket.model');
const Ward = require('../wards/ward.model');
const Category = require('../categories/category.model');
const Settings = require('../settings/settings.model');
const Department = require('../departments/department.model');
const ApiError = require('../../utils/ApiError');
const { nextSequence } = require('../../utils/counter');
const { hashPassword } = require('../../utils/token');
const { logAudit } = require('../audit/audit.service');
const { setCachedSlaHours } = require('../../constants/sla');

// =============================================================================
// USER MANAGEMENT (Part 2)
// =============================================================================

const getUsers = async (queryParams) => {
  const { role, accountStatus, q, sort = 'memberSince', page: rawPage, limit: rawLimit } = queryParams;

  const page = parseInt(rawPage, 10) > 0 ? parseInt(rawPage, 10) : 1;
  const limit = parseInt(rawLimit, 10) > 0 ? Math.min(parseInt(rawLimit, 10), 100) : 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (role) filter.role = role;
  if (accountStatus) filter.accountStatus = accountStatus;
  if (q && q.trim()) {
    const regex = new RegExp(q.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    filter.$or = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { ward: regex },
      { userCode: regex }
    ];
  }

  const sortOrder = sort === 'name' ? { name: 1 } : { memberSince: -1 };

  const [items, total] = await Promise.all([
    User.find(filter).sort(sortOrder).skip(skip).limit(limit),
    User.countDocuments(filter)
  ]);

  return { items, page, limit, total };
};

const createUser = async (userData, creator) => {
  const existing = await User.findOne({ email: userData.email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'Email is already registered');
  }

  const seq = await nextSequence('users', 1001);
  const userCode = `USR-${seq}`;
  const passwordHash = await hashPassword(userData.password);

  const newUser = new User({
    userCode,
    name: userData.name,
    email: userData.email.toLowerCase(),
    passwordHash,
    role: userData.role || 'citizen',
    designation: userData.designation,
    department: userData.department,
    ward: userData.ward,
    phone: userData.phone,
    badgeNumber: userData.badgeNumber,
    accountStatus: 'Active',
    memberSince: new Date()
  });

  const savedUser = await newUser.save();

  logAudit({
    action: 'USER_CREATED',
    relatedRecord: savedUser.userCode,
    user: `${creator.name} (${creator.userCode})`,
    role: creator.role,
    description: `Created new user ${savedUser.name} (${savedUser.userCode}) with role '${savedUser.role}'`
  });

  return savedUser;
};

const suspendUser = async (identifier, reason, actor) => {
  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'Suspension reason is required');
  }

  const user = await User.findOne({
    $or: [{ userCode: identifier }, { _id: identifier.match(/^[0-9a-fA-F]{24}$/) ? identifier : null }]
  });

  if (!user) {
    throw new ApiError(404, `User '${identifier}' not found`);
  }

  if (user.userCode === actor.userCode) {
    throw new ApiError(400, 'Admins cannot suspend their own account');
  }

  user.accountStatus = 'Suspended';
  user.suspensionReason = reason.trim();
  user.refreshTokenHash = undefined; // Invalidate current session
  await user.save();

  logAudit({
    action: 'USER_SUSPENDED',
    relatedRecord: user.userCode,
    user: `${actor.name} (${actor.userCode})`,
    role: actor.role,
    description: `Suspended user ${user.name} (${user.userCode}). Reason: ${reason}`
  });

  return user;
};

const reinstateUser = async (identifier, actor) => {
  const user = await User.findOne({
    $or: [{ userCode: identifier }, { _id: identifier.match(/^[0-9a-fA-F]{24}$/) ? identifier : null }]
  });

  if (!user) {
    throw new ApiError(404, `User '${identifier}' not found`);
  }

  user.accountStatus = 'Active';
  user.suspensionReason = undefined;
  await user.save();

  logAudit({
    action: 'USER_REINSTATED',
    relatedRecord: user.userCode,
    user: `${actor.name} (${actor.userCode})`,
    role: actor.role,
    description: `Reinstated user ${user.name} (${user.userCode}) to Active status`
  });

  return user;
};

// =============================================================================
// MODERATION (Part 4)
// =============================================================================

const getModerationReports = async (view = 'queue') => {
  if (view === 'history') {
    return Report.find({
      moderationStatus: { $ne: 'Pending', $exists: true },
      'moderationHistory.0': { $exists: true }
    }).sort({ updatedAt: -1 });
  }

  // Queue view (Pending or flagged)
  return Report.find({
    $or: [{ isFlagged: true }, { moderationStatus: 'Pending' }]
  }).sort({ reportedAt: -1 });
};

const decideModeration = async (reportId, decisionData, actor) => {
  const { action, reason, duplicateOf } = decisionData;
  const ALLOWED_ACTIONS = ['approve', 'reject', 'duplicate', 'clarify', 'escalate'];

  if (!ALLOWED_ACTIONS.includes(action)) {
    throw new ApiError(400, `Invalid moderation action: '${action}'. Allowed: ${ALLOWED_ACTIONS.join(', ')}`);
  }

  if (['reject', 'clarify', 'escalate'].includes(action) && (!reason || !reason.trim())) {
    throw new ApiError(400, `Reason is required for moderation action '${action}'`);
  }

  if (action === 'duplicate' && (!duplicateOf || !duplicateOf.trim())) {
    throw new ApiError(400, 'duplicateOf ticket number is required for duplicate action');
  }

  const report = await Report.findOne({ reportId });
  if (!report) {
    throw new ApiError(404, `Report with ID '${reportId}' not found`);
  }

  const now = new Date();
  let newReportStatus;
  let newModerationStatus;
  let timelineTitle;
  let timelineDesc;

  switch (action) {
    case 'approve':
      report.isFlagged = false;
      newReportStatus = 'Reported';
      newModerationStatus = 'Approved';
      timelineTitle = 'Moderation Approved';
      timelineDesc = 'Report verified and released to active civic queue';
      break;
    case 'reject':
      newReportStatus = 'Rejected by Moderation';
      newModerationStatus = 'Rejected';
      timelineTitle = 'Rejected by Moderation';
      timelineDesc = reason;
      break;
    case 'duplicate':
      newReportStatus = 'Duplicate';
      newModerationStatus = 'Duplicate';
      timelineTitle = 'Marked as Duplicate';
      timelineDesc = `Duplicate of ticket ${duplicateOf}`;
      break;
    case 'clarify':
      newReportStatus = 'Clarification Requested';
      newModerationStatus = 'Clarification Requested';
      timelineTitle = 'Clarification Requested';
      timelineDesc = reason;
      break;
    case 'escalate':
      newReportStatus = 'Escalated';
      newModerationStatus = 'Escalated';
      timelineTitle = 'Escalated by Moderation';
      timelineDesc = reason;
      break;
  }

  report.status = newReportStatus;
  report.moderationStatus = newModerationStatus;
  report.moderationHistory.push({
    action,
    by: `${actor.name} (${actor.userCode})`,
    reason: reason || '',
    duplicateOf: duplicateOf || '',
    at: now
  });

  report.actionsTaken.push({
    timestamp: now,
    action: `Moderation action '${action}' applied by ${actor.name} (${actor.userCode})`
  });

  await report.save();

  // Mirror to linked Ticket
  if (report.ticketNumber) {
    const ticket = await Ticket.findOne({ ticketNumber: report.ticketNumber });
    if (ticket) {
      ticket.currentStatus = newReportStatus;
      ticket.timeline.push({
        stage: 'Moderation',
        title: timelineTitle,
        description: timelineDesc || '',
        date: now,
        completed: true,
        officer: actor.name
      });
      await ticket.save();
    }
  }

  logAudit({
    action: 'REPORT_MODERATED',
    relatedRecord: report.reportId,
    user: `${actor.name} (${actor.userCode})`,
    role: actor.role,
    description: `Moderated report ${report.reportId} with action '${action}' -> ${newReportStatus}`
  });

  return report;
};

// =============================================================================
// WARDS (Part 4)
// =============================================================================

const getWardsWithStats = async () => {
  const wards = await Ward.find().sort({ wardNumber: 1 });

  // Calculate grievance metrics per ward
  const stats = await Ticket.aggregate([
    {
      $group: {
        _id: '$ward',
        totalGrievances: { $sum: 1 },
        resolvedGrievances: {
          $sum: {
            $cond: [{ $in: ['$currentStatus', ['Resolved', 'Citizen-Confirmed']] }, 1, 0]
          }
        }
      }
    }
  ]);

  const statsMap = {};
  stats.forEach((s) => {
    if (s._id) {
      statsMap[s._id] = {
        totalGrievances: s.totalGrievances,
        resolvedGrievances: s.resolvedGrievances,
        resolutionRate:
          s.totalGrievances > 0 ? Math.round((s.resolvedGrievances / s.totalGrievances) * 100) : 0
      };
    }
  });

  return wards.map((w) => {
    const obj = w.toJSON();
    const wardStat = statsMap[w.wardNumber] || {
      totalGrievances: 0,
      resolvedGrievances: 0,
      resolutionRate: 0
    };
    return {
      ...obj,
      totalGrievances: wardStat.totalGrievances,
      resolvedGrievances: wardStat.resolvedGrievances,
      resolutionRate: wardStat.resolutionRate
    };
  });
};

const createWard = async (wardData) => {
  const existing = await Ward.findOne({ wardNumber: wardData.wardNumber });
  if (existing) {
    throw new ApiError(409, `Ward with number '${wardData.wardNumber}' already exists`);
  }

  const ward = new Ward(wardData);
  return ward.save();
};

const updateWard = async (wardNumber, updateData) => {
  const ward = await Ward.findOneAndUpdate({ wardNumber }, { $set: updateData }, { new: true });
  if (!ward) {
    throw new ApiError(404, `Ward '${wardNumber}' not found`);
  }
  return ward;
};

// =============================================================================
// DEPARTMENTS (Part 4)
// =============================================================================

const updateDepartment = async (code, updateData) => {
  const dept = await Department.findOneAndUpdate(
    { code: code.toUpperCase() },
    { $set: updateData },
    { new: true }
  );
  if (!dept) {
    throw new ApiError(404, `Department with code '${code}' not found`);
  }
  return dept;
};

// =============================================================================
// CATEGORIES (Part 4)
// =============================================================================

const getCategories = async (adminView = false) => {
  const filter = adminView ? {} : { status: 'Active' };
  return Category.find(filter).sort({ name: 1 });
};

const createCategory = async (catData) => {
  const existing = await Category.findOne({ name: catData.name });
  if (existing) {
    throw new ApiError(409, `Category '${catData.name}' already exists`);
  }
  const category = new Category(catData);
  return category.save();
};

const updateCategory = async (id, updateData) => {
  const category = await Category.findByIdAndUpdate(id, { $set: updateData }, { new: true });
  if (!category) {
    throw new ApiError(404, `Category '${id}' not found`);
  }
  return category;
};

// =============================================================================
// SETTINGS (Part 4)
// =============================================================================

const getSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = new Settings({});
    await settings.save();
  }
  setCachedSlaHours(settings);
  return settings;
};

const updateSettings = async (updateData, actor) => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = new Settings(updateData);
  } else {
    Object.assign(settings, updateData);
  }

  const saved = await settings.save();
  setCachedSlaHours(saved);

  logAudit({
    action: 'SETTINGS_UPDATED',
    relatedRecord: 'SYSTEM_SETTINGS',
    user: `${actor.name} (${actor.userCode})`,
    role: actor.role,
    description: 'Updated municipal portal operational settings and SLA thresholds'
  });

  return saved;
};

// =============================================================================
// OVERVIEW (Part 4)
// =============================================================================

const getOverview = async () => {
  const [
    userStats,
    reportsCount,
    ticketStatusStats,
    pendingModerationCount,
    wardsCount,
    departmentsCount
  ] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]),
    Report.countDocuments(),
    Ticket.aggregate([
      {
        $group: {
          _id: '$currentStatus',
          count: { $sum: 1 }
        }
      }
    ]),
    Report.countDocuments({
      $or: [{ isFlagged: true }, { moderationStatus: 'Pending' }]
    }),
    Ward.countDocuments(),
    Department.countDocuments()
  ]);

  const usersByRole = {
    citizen: 0,
    authority: 0,
    field_officer: 0,
    admin: 0,
    total: 0
  };

  userStats.forEach((u) => {
    if (usersByRole[u._id] !== undefined) {
      usersByRole[u._id] = u.count;
    }
    usersByRole.total += u.count;
  });

  const ticketsByStatus = {};
  ticketStatusStats.forEach((t) => {
    if (t._id) {
      ticketsByStatus[t._id] = t.count;
    }
  });

  return {
    users: usersByRole,
    reports: reportsCount,
    tickets: ticketsByStatus,
    pendingModeration: pendingModerationCount,
    wards: wardsCount,
    departments: departmentsCount
  };
};

module.exports = {
  getUsers,
  createUser,
  suspendUser,
  reinstateUser,
  getModerationReports,
  decideModeration,
  getWardsWithStats,
  createWard,
  updateWard,
  updateDepartment,
  getCategories,
  createCategory,
  updateCategory,
  getSettings,
  updateSettings,
  getOverview
};
