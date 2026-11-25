/**
 * src/modules/tickets/tickets.service.js
 * 
 * Purpose:
 * Business logic layer for Civic Tickets.
 * Handles ticket queries, filtering, pagination, and lookup by ticket number.
 */

const Ticket = require('./ticket.model');
const ApiError = require('../../utils/ApiError');

/**
 * Retrieves paginated tickets with filtering (newest first)
 * @param {Object} queryParams - Filters (currentStatus, ward, category, assignedOfficerId, page, limit)
 * @returns {Promise<{ items: Array, page: number, limit: number, total: number }>}
 */
const getTickets = async (queryParams) => {
  const { currentStatus, ward, category, assignedOfficerId, page: rawPage, limit: rawLimit } = queryParams;

  const parsedPage = parseInt(rawPage, 10);
  const parsedLimit = parseInt(rawLimit, 10);
  const page = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = !isNaN(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (currentStatus) filter.currentStatus = currentStatus;
  if (ward) filter.ward = ward;
  if (category) filter.category = category;
  if (assignedOfficerId) filter.assignedOfficerId = assignedOfficerId;

  const [items, total] = await Promise.all([
    Ticket.find(filter).sort({ submissionDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    Ticket.countDocuments(filter)
  ]);

  return {
    items,
    page,
    limit,
    total
  };
};

/**
 * Retrieves a single ticket by its unique ticket number (e.g. "CR-2026-9001")
 * @param {string} ticketNumber
 * @returns {Promise<Object>}
 */
const getTicketByNumber = async (ticketNumber) => {
  const ticket = await Ticket.findOne({ ticketNumber: ticketNumber.toUpperCase() });
  if (!ticket) {
    throw new ApiError(404, `Ticket with number '${ticketNumber}' not found`);
  }
  return ticket;
};

module.exports = {
  getTickets,
  getTicketByNumber
};

