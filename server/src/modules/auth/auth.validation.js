/**
 * src/modules/auth/auth.validation.js
 * 
 * Purpose:
 * Zod validation schemas for registration, login, token refresh, and password change.
 */

const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().trim().optional(),
  ward: z.string().trim().optional()
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'refreshToken is required')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long')
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema
};
