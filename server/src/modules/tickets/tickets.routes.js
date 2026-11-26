/**
 * src/modules/tickets/tickets.routes.js
 * 
 * Purpose:
 * Express route definitions for the Tickets API.
 * Maps endpoints to JWT auth middleware, RBAC checks, Zod payload validators, and controller functions.
 */

const express = require('express');
const ticketsController = require('./tickets.controller');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
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

// Authority/admin see all, field_officer sees only assigned, citizen gets 403
router.get('/', auth, ticketsController.getTickets);

// Public tracking by ticket number (e.g. CR-2026-9001)
router.get('/:ticketNumber', ticketsController.getTicketByNumber);

// Status update via state transition table
router.patch(
  '/:ticketNumber/status',
  auth,
  validateBody(updateStatusSchema),
  ticketsController.updateStatus
);

// Department & officer assignment (authority / admin only)
router.post(
  '/:ticketNumber/assign',
  auth,
  requireRole('authority', 'admin'),
  validateBody(assignTicketSchema),
  ticketsController.assignTicket
);

// Field officer inspection actions (start, remarks, mark in progress, photos, completion)
router.post(
  '/:ticketNumber/inspection',
  auth,
  requireRole('field_officer'),
  validateBody(inspectionActionSchema),
  ticketsController.inspectionAction
);

// Citizen verification confirmation or dispute
router.post(
  '/:ticketNumber/confirm',
  auth,
  requireRole('citizen'),
  validateBody(confirmTicketSchema),
  ticketsController.confirmTicket
);

module.exports = router;
