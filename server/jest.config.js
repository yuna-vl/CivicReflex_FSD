/**
 * jest.config.js
 * 
 * Configuration for Jest automated test suite.
 * Strictly scopes test discovery to server/tests/**\/*.test.js so that
 * manual evaluation scripts are never executed during npm test.
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 60000,
  verbose: true,
  forceExit: true
};
