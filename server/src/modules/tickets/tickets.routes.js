/**
 * src/modules/tickets/tickets.routes.js
 * 
 * Purpose:
 * Express route definitions for the Tickets API.
 * Tickets are created automatically through report registration and can only be read here.
 */

const express = require('express');
const ticketsController = require('./tickets.controller');

const router = express.Router();

// TODO: authority/admin only; field officers see only their own tickets (feature/auth-admin)
router.get('/', ticketsController.getTickets);

// Public tracking by ticket number (e.g. CR-2026-9001)
router.get('/:ticketNumber', ticketsController.getTicketByNumber);

module.exports = router;

