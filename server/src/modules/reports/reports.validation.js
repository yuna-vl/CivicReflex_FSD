/**
 * src/modules/reports/reports.validation.js
 * 
 * Purpose:
 * Input validation schemas using Zod for incoming HTTP requests.
 * Accepts ONLY client-controllable fields and strips all system-controlled fields
 * (status, upvotes, verifiedCount, actionsTaken, etc.) to prevent tampering.
 */

const { z } = require('zod');

// Validation schema for creating a new civic report
// ONLY accepts client-submittable fields; system-controlled fields are ignored
const createReportSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title cannot be empty'),

  category: z
    .string({ required_error: 'Category is required' })
    .trim()
    .min(1, 'Category cannot be empty'),

  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(1, 'Description cannot be empty'),

  wardNumber: z
    .string({ required_error: 'Ward number is required' })
    .trim()
    .min(1, 'Ward number cannot be empty'),

  type: z.enum(['issue', 'experience']).optional(),
  subcategory: z.string().trim().optional(),
  location: z.string().trim().optional(),
  zone: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  photoUrl: z.string().trim().optional(),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  timeOfDay: z.string().trim().optional(),
  isAnonymous: z.boolean().optional(),

  // Location coordinates (latitude: -90 to 90, longitude: -180 to 180)
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

// Validation schema for citizen report verification
const verifyReportSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .trim()
    .min(1, 'userId cannot be empty')
});

module.exports = {
  createReportSchema,
  verifyReportSchema
};
