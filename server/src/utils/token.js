/**
 * src/utils/token.js
 * 
 * Purpose:
 * Cryptographic helpers for password hashing (bcryptjs) and JWT issuance/verification.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  jwtAccessSecret,
  jwtRefreshSecret,
  accessTtl,
  refreshTtl
} = require('../config/env');

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compares plaintext password against a bcrypt hash
 */
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Signs a short-lived access JWT
 */
const signAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.userCode,
      email: user.email,
      role: user.role
    },
    jwtAccessSecret,
    { expiresIn: accessTtl }
  );
};

/**
 * Signs a longer-lived refresh JWT
 */
const signRefreshToken = (user) => {
  return jwt.sign(
    {
      sub: user.userCode,
      tokenType: 'refresh'
    },
    jwtRefreshSecret,
    { expiresIn: refreshTtl }
  );
};

/**
 * Verifies and decodes an access token
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, jwtAccessSecret);
};

/**
 * Verifies and decodes a refresh token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtRefreshSecret);
};

/**
 * Produces a SHA-256 digest of a refresh token to safely store in DB
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken
};
