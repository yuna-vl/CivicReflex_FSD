/**
 * src/modules/admin/admin.validation.js
 * 
 * Purpose:
 * Zod schemas for admin operations: user creation, suspension, moderation decisions,
 * ward and category management, and settings configuration.
 */

const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: z.enum(['citizen', 'authority', 'field_officer', 'admin']).optional(),
  designation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  ward: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  badgeNumber: z.string().trim().optional()
});

const suspendUserSchema = z.object({
  reason: z.string().trim().min(1, 'Suspension reason is required')
});

const moderationDecisionSchema = z.object({
  action: z.enum(['approve', 'reject', 'duplicate', 'clarify', 'escalate']),
  reason: z.string().trim().optional(),
  duplicateOf: z.string().trim().optional()
});

const wardSchema = z.object({
  wardNumber: z.string().trim().min(1, 'Ward number is required'),
  wardName: z.string().trim().min(1, 'Ward name is required'),
  zone: z.string().trim().min(1, 'Zone is required'),
  assignedAuthority: z.string().trim().optional(),
  fieldOfficers: z.array(z.string().trim()).optional(),
  status: z.enum(['Active', 'Inactive']).optional()
});

const updateWardSchema = z.object({
  wardName: z.string().trim().optional(),
  zone: z.string().trim().optional(),
  assignedAuthority: z.string().trim().optional(),
  fieldOfficers: z.array(z.string().trim()).optional(),
  status: z.enum(['Active', 'Inactive']).optional()
});

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required'),
  department: z.string().trim().min(1, 'Department is required'),
  defaultPriority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  defaultSlaHours: z.number().positive().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  description: z.string().trim().optional()
});

const updateCategorySchema = z.object({
  name: z.string().trim().optional(),
  department: z.string().trim().optional(),
  defaultPriority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  defaultSlaHours: z.number().positive().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  description: z.string().trim().optional()
});

const settingsSchema = z.object({
  portalName: z.string().trim().optional(),
  municipalCorporation: z.string().trim().optional(),
  helpline: z.string().trim().optional(),
  portalUrl: z.string().trim().optional(),
  highSlaHours: z.number().positive().optional(),
  mediumSlaHours: z.number().positive().optional(),
  lowSlaHours: z.number().positive().optional(),
  autoEscalationDays: z.number().nonnegative().optional(),
  duplicateGeoRadiusMeters: z.number().positive().optional(),
  autoQuarantineSpam: z.boolean().optional(),
  aiSpamSensitivity: z.string().trim().optional(),
  enableSmsAlerts: z.boolean().optional(),
  enableEmailAlerts: z.boolean().optional(),
  dailyDigestTime: z.string().trim().optional()
});

module.exports = {
  createUserSchema,
  suspendUserSchema,
  moderationDecisionSchema,
  wardSchema,
  updateWardSchema,
  categorySchema,
  updateCategorySchema,
  settingsSchema
};
