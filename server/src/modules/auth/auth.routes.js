/**
 * src/modules/auth/auth.routes.js
 * 
 * Purpose:
 * Express route definitions for authentication endpoints.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('./auth.controller');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema
} = require('./auth.validation');
const auth = require('../../middleware/auth');

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

// Rate limiter: 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many login attempts from this IP, please try again after 15 minutes'
    }
  }
});

router.post('/register', validateBody(registerSchema), authController.register);
router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);
router.post('/logout', auth, authController.logout);
router.get('/me', auth, authController.me);
router.post('/change-password', auth, validateBody(changePasswordSchema), authController.changePassword);

module.exports = router;
