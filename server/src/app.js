/**
 * src/app.js
 * 
 * Purpose:
 * Configures the Express application instance, registers essential security and
 * utility middleware, sets up API routes, and attaches error handling.
 * 
 * Keeping `app.js` separate from `server.js` is an industry best practice:
 * it allows testing API routes (e.g. using Supertest) without starting the HTTP server
 * or connecting to external databases.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { clientUrl } = require('./config/env');
const ApiError = require('./utils/ApiError');
const errorHandler = require('./middleware/errorHandler');
const reportsRouter = require('./modules/reports/reports.routes');

const app = express();

// 1. Security Headers - Helmet sets various HTTP headers to protect against common web vulnerabilities
app.use(helmet());

// 2. CORS - Cross-Origin Resource Sharing enables the frontend client to communicate with this API
app.use(
  cors({
    origin: clientUrl,
    credentials: true
  })
);

// 3. Body Parser - Parses incoming JSON request bodies and makes them available under req.body
app.use(express.json());

// 4. Health Check Route - Used by monitoring tools, load balancers, and developers to verify API health
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok'
    }
  });
});

// 5. API Routes
app.use('/api/reports', reportsRouter);

// 6. 404 Handler - Catches any requests made to undefined routes and forwards an ApiError
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// 7. Central Error Handler - Formats and sends standard JSON error responses
app.use(errorHandler);

module.exports = app;
