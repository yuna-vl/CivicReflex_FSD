/**
 * src/modules/tickets/tickets.controller.js
 * 
 * Purpose:
 * Controller layer for handling HTTP requests for Tickets.
 * Enforces uniform JSON response envelope: { success: true, data: ... }
 */

const ticketsService = require('./tickets.service');

/**
 * GET /api/tickets
 * Retrieves all tickets with filtering and pagination.
 */
const getTickets = async (req, res, next) => {
  try {
    const result = await ticketsService.getTickets(req.query);

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
    const { status, note } = req.body;
    const ticket = await ticketsService.applyStatusChange(
      req.params.ticketNumber,
      status,
      req.actor,
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
    const ticket = await ticketsService.assignTicket(
      req.params.ticketNumber,
      req.body,
      req.actor
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
    const ticket = await ticketsService.performInspectionAction(
      req.params.ticketNumber,
      req.body,
      req.actor
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
    const ticket = await ticketsService.confirmTicket(
      req.params.ticketNumber,
      req.body,
      req.actor
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
