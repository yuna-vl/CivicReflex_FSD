/**
 * src/config/env.js
 * 
 * Purpose:
 * Centralizes all environment variable loading and validation.
 * Instead of calling `process.env.VARIABLE_NAME` across multiple files,
 * we import variables from this single module. This makes the codebase
 * cleaner, easier to maintain, and provides fallback default values.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the .env file in the server root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  // Port number on which the Express HTTP server will listen
  port: process.env.PORT || 5000,

  // MongoDB connection connection string (URI)
  mongoUri: process.env.MONGO_URI,

  // Allowed frontend client URL for Cross-Origin Resource Sharing (CORS)
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Current runtime environment ('development', 'production', or 'test')
  nodeEnv: process.env.NODE_ENV || 'development',

  // JWT Configuration
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key-change-in-prod',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-change-in-prod',
  accessTtl: process.env.ACCESS_TTL || '15m',
  refreshTtl: process.env.REFRESH_TTL || '7d'
};

