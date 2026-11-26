/**
 * src/modules/tickets/tickets.controller.js
 * 
 * Purpose:
 * Controller layer for handling HTTP requests for Tickets.
 * Extracts caller identity from authenticated req.user and enforces role scope.
 */

const ticketsService = require('./tickets.service');
const ApiError = require('../../utils/ApiError');

/**
 * GET /api/tickets
 * Retrieves tickets with RBAC filtering:
 * - Authority/Admin: see all tickets
 * - Field Officer: see only tickets assigned to them
 * - Citizen: 403 Forbidden
 */
const getTickets = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    if (req.user.role === 'citizen') {
      throw new ApiError(403, 'Citizens are not permitted to query operational ticket lists');
    }

    const queryParams = { ...req.query };

    // Field officers only see tickets assigned to their userCode
    if (req.user.role === 'field_officer') {
      queryParams.assignedOfficerId = req.user.userCode;
    }

    const result = await ticketsService.getTickets(queryParams);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/:ticketNumber
 * Public ticket tracking lookup by ticket number.
 */
const getTicketByNumber = async (req, res, next) => {
  try {
    const ticket = await ticketsService.getTicketByNumber(req.params.ticketNumber);

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/tickets/:ticketNumber/status
 * Updates ticket status according to the state machine transition table.
 */
const updateStatus = async (req, res, next) => {
  try {
    const actor = {
      id: req.user.userCode,
      role: req.user.role,
      name: req.user.name,
      isAuthority: req.user.role === 'authority' || req.user.role === 'admin'
    };

    const { status, note } = req.body;
    const ticket = await ticketsService.applyStatusChange(
      req.params.ticketNumber,
      status,
      actor,
      note
    );

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:ticketNumber/assign
 * Assigns or reassigns ticket to an officer and department.
 */
const assignTicket = async (req, res, next) => {
  try {
    const actor = {
      id: req.user.userCode,
      role: req.user.role,
      name: req.user.name,
      isAuthority: true
    };

    const ticket = await ticketsService.assignTicket(
      req.params.ticketNumber,
      req.body,
      actor
    );

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:ticketNumber/inspection
 * Field officer inspection lifecycle actions (start, remarks, mark in progress, photos, completion).
 */
const inspectionAction = async (req, res, next) => {
  try {
    const actor = {
      id: req.user.userCode,
      role: req.user.role,
      name: req.user.name
    };

    const ticket = await ticketsService.performInspectionAction(
      req.params.ticketNumber,
      req.body,
      actor
    );

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:ticketNumber/confirm
 * Citizen confirmation or dispute of a resolved ticket.
 */
const confirmTicket = async (req, res, next) => {
  try {
    const actor = {
      id: req.user.userCode,
      role: req.user.role,
      name: req.user.name
    };

    const ticket = await ticketsService.confirmTicket(
      req.params.ticketNumber,
      req.body,
      actor
    );

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTickets,
  getTicketByNumber,
  updateStatus,
  assignTicket,
  inspectionAction,
  confirmTicket
};
