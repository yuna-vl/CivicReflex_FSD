/**
 * src/modules/admin/admin.controller.js
 * 
 * Purpose:
 * Controller layer for administrative governance endpoints.
 */

const adminService = require('./admin.service');
const auditService = require('../audit/audit.service');

// Users
const getUsers = async (req, res, next) => {
  try {
    const result = await adminService.getUsers(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const user = await adminService.createUser(req.body, req.user);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

const suspendUser = async (req, res, next) => {
  try {
    const user = await adminService.suspendUser(req.params.id, req.body.reason, req.user);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

const reinstateUser = async (req, res, next) => {
  try {
    const user = await adminService.reinstateUser(req.params.id, req.user);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// Audit logs
const getAuditLogs = async (req, res, next) => {
  try {
    if (req.query.format === 'csv') {
      const csv = await auditService.exportAuditLogsCsv(req.query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      return res.status(200).send(csv);
    }
    const result = await auditService.getAuditLogs(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const verifyAuditChain = async (req, res, next) => {
  try {
    const result = await auditService.verifyChain();
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// Moderation
const getModeration = async (req, res, next) => {
  try {
    const reports = await adminService.getModerationReports(req.query.view || 'queue');
    res.status(200).json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
};

const decideModeration = async (req, res, next) => {
  try {
    const report = await adminService.decideModeration(req.params.reportId, req.body, req.user);
    res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// Wards
const getWards = async (req, res, next) => {
  try {
    const wards = await adminService.getWardsWithStats();
    res.status(200).json({ success: true, data: wards });
  } catch (err) {
    next(err);
  }
};

const createWard = async (req, res, next) => {
  try {
    const ward = await adminService.createWard(req.body);
    res.status(201).json({ success: true, data: ward });
  } catch (err) {
    next(err);
  }
};

const updateWard = async (req, res, next) => {
  try {
    const ward = await adminService.updateWard(req.params.wardNumber, req.body);
    res.status(200).json({ success: true, data: ward });
  } catch (err) {
    next(err);
  }
};

// Departments
const updateDepartment = async (req, res, next) => {
  try {
    const dept = await adminService.updateDepartment(req.params.code, req.body);
    res.status(200).json({ success: true, data: dept });
  } catch (err) {
    next(err);
  }
};

// Categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await adminService.getCategories(true);
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const category = await adminService.createCategory(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await adminService.updateCategory(req.params.id, req.body);
    res.status(200).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

// Settings
const getSettings = async (req, res, next) => {
  try {
    const settings = await adminService.getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const settings = await adminService.updateSettings(req.body, req.user);
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

// Overview
const getOverview = async (req, res, next) => {
  try {
    const overview = await adminService.getOverview();
    res.status(200).json({ success: true, data: overview });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  createUser,
  suspendUser,
  reinstateUser,
  getAuditLogs,
  verifyAuditChain,
  getModeration,
  decideModeration,
  getWards,
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
