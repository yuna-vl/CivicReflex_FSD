/**
 * src/modules/tickets/tickets.routes.js
 * 
 * Purpose:
 * Express route definitions for the Tickets API.
 * Maps endpoints to actor validation middleware, Zod payload validators, and controller functions.
 */

const express = require('express');
const ticketsController = require('./tickets.controller');
const actorMiddleware = require('../../middleware/actor');
const {
  updateStatusSchema,
  assignTicketSchema,
  inspectionActionSchema,
  confirmTicketSchema
} = require('./tickets.validation');

const router = express.Router();

/**
 * Middleware for validating request body against a Zod schema
 */
const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

// TODO: authority/admin only; field officers see only their own tickets (feature/auth-admin)
router.get('/', ticketsController.getTickets);

// Public tracking by ticket number (e.g. CR-2026-9001)
router.get('/:ticketNumber', ticketsController.getTicketByNumber);

// Status update via state transition table
router.patch(
  '/:ticketNumber/status',
  actorMiddleware,
  validateBody(updateStatusSchema),
  ticketsController.updateStatus
);

// Department & officer assignment (authority / admin)
router.post(
  '/:ticketNumber/assign',
  actorMiddleware,
  validateBody(assignTicketSchema),
  ticketsController.assignTicket
);

// Field officer inspection actions (start, remarks, mark in progress, photos, completion)
router.post(
  '/:ticketNumber/inspection',
  actorMiddleware,
  validateBody(inspectionActionSchema),
  ticketsController.inspectionAction
);

// Citizen verification confirmation or dispute
router.post(
  '/:ticketNumber/confirm',
  actorMiddleware,
  validateBody(confirmTicketSchema),
  ticketsController.confirmTicket
);

module.exports = router;
