/**
 * src/modules/tickets/tickets.validation.js
 * 
 * Purpose:
 * Input validation schemas using Zod for Ticket operations:
 * - Status transition requests
 * - Authority officer assignment
 * - Field officer inspection actions
 * - Citizen resolution confirmation / dispute
 */

const { z } = require('zod');
const { REPORT_STATUSES } = require('../../constants/statuses');

// Schema for PATCH /api/tickets/:ticketNumber/status
const updateStatusSchema = z.object({
  status: z.enum(REPORT_STATUSES, { required_error: 'Status is required' }),
  note: z.string().trim().optional()
});

// Schema for POST /api/tickets/:ticketNumber/assign
const assignTicketSchema = z.object({
  department: z
    .string({ required_error: 'Department is required' })
    .trim()
    .min(1, 'Department cannot be empty'),

  officerId: z
    .string({ required_error: 'Officer ID is required' })
    .trim()
    .min(1, 'Officer ID cannot be empty'),

  officerName: z
    .string({ required_error: 'Officer name is required' })
    .trim()
    .min(1, 'Officer name cannot be empty'),

  designation: z.string().trim().optional(),
  contact: z.string().trim().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  directives: z.string().trim().optional()
});

// Schema for POST /api/tickets/:ticketNumber/inspection
const inspectionActionSchema = z.object({
  action: z.enum(
    [
      'start_inspection',
      'submit_remarks',
      'mark_in_progress',
      'upload_before_photo',
      'upload_after_photo',
      'submit_completion'
    ],
    { required_error: 'Action is required' }
  ),
  remarks: z.string().trim().optional(),
  photoUrl: z.string().trim().optional(),
  note: z.string().trim().optional()
});

// Schema for POST /api/tickets/:ticketNumber/confirm
const confirmTicketSchema = z.object({
  decision: z.enum(['confirm', 'dispute'], {
    required_error: 'Decision is required (must be confirm or dispute)'
  }),
  comment: z.string().trim().optional()
});

module.exports = {
  updateStatusSchema,
  assignTicketSchema,
  inspectionActionSchema,
  confirmTicketSchema
};

