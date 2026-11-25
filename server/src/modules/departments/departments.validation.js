/**
 * src/modules/departments/departments.validation.js
 * 
 * Purpose:
 * Input validation schemas using Zod for the Departments API.
 */

const { z } = require('zod');

const createDepartmentSchema = z.object({
  name: z
    .string({ required_error: 'Department name is required' })
    .trim()
    .min(1, 'Department name cannot be empty'),

  code: z
    .string({ required_error: 'Department code is required' })
    .trim()
    .min(1, 'Department code cannot be empty')
    .transform((val) => val.toUpperCase()),

  nodalOfficer: z.string().trim().optional(),
  officerCount: z.number().int().min(0).optional().default(0),
  budgetAllocated: z.string().trim().optional(),
  contactEmail: z.string().trim().email('Invalid email address').optional().or(z.literal(''))
});

module.exports = {
  createDepartmentSchema
};

