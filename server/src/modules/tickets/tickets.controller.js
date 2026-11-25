/**
 * src/modules/tickets/tickets.controller.js
 * 
 * Purpose:
 * Controller layer for handling HTTP requests for Tickets.
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

module.exports = {
  getTickets,
  getTicketByNumber
};

