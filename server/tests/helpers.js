/**
 * tests/helpers.js
 * 
 * Purpose:
 * Common testing fixtures and authentication helpers for Jest automated tests.
 */

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const { hashPassword, signAccessToken } = require('../src/utils/token');
const { nextSequence } = require('../src/utils/counter');

let userCounter = 1;

/**
 * Creates a test user in the test database and returns the user and a valid JWT bearer token.
 * 
 * @param {string} role - 'citizen' | 'authority' | 'field_officer' | 'admin'
 * @param {object} overrides - Custom attributes
 * @returns {Promise<{ user: object, token: string, userCode: string }>}
 */
const createTestUser = async (role = 'citizen', overrides = {}) => {
  const num = userCounter++;
  const userCode = overrides.userCode || `USR-TEST-${num}`;
  const password = overrides.password || 'password123';
  const passwordHash = await hashPassword(password);

  const user = await User.create({
    userCode,
    name: overrides.name || `Test ${role} ${num}`,
    email: overrides.email || `test.${role}.${num}@civicreflex.test`,
    passwordHash,
    role,
    accountStatus: overrides.accountStatus || 'Active',
    ward: overrides.ward || 'Ward 14',
    department: overrides.department || (role === 'field_officer' ? 'Roads and Infrastructure' : undefined),
    designation: overrides.designation || `Designation ${role}`,
    ...overrides
  });

  const token = signAccessToken(user);

  return { user, token, userCode, password };
};

module.exports = {
  app,
  request,
  createTestUser
};
