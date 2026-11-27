/**
 * src/app.js
 * 
 * Purpose:
 * Configures the Express application instance, registers essential security and
 * utility middleware, sets up API routes, and attaches error handling.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { clientUrl } = require('./config/env');
const ApiError = require('./utils/ApiError');
const errorHandler = require('./middleware/errorHandler');
const authRouter = require('./modules/auth/auth.routes');
const adminRouter = require('./modules/admin/admin.routes');
const categoriesRouter = require('./modules/categories/categories.routes');
const reportsRouter = require('./modules/reports/reports.routes');
const departmentsRouter = require('./modules/departments/departments.routes');
const ticketsRouter = require('./modules/tickets/tickets.routes');
const { registerLogListeners } = require('./events/logListeners');

// Register terminal event logging listeners
registerLogListeners();

const app = express();

// 1. Response Compression - Compress HTTP response payloads for network efficiency
app.use(compression());

// 2. General Rate Limiter - 200 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again after 15 minutes'
    }
  }
});
app.use(generalLimiter);

// 3. Security Headers - Helmet sets various HTTP headers to protect against common web vulnerabilities
app.use(helmet());

// 4. CORS - Cross-Origin Resource Sharing enables the frontend client to communicate with this API
app.use(
  cors({
    origin: clientUrl,
    credentials: true
  })
);

// 5. Body Parser - Parses incoming JSON request bodies and makes them available under req.body
app.use(express.json());

// 6. Health Check Route - Used by monitoring tools, load balancers, and developers to verify API health
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok'
    }
  });
});

// 5. API Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/tickets', ticketsRouter);

// 6. 404 Handler - Catches any requests made to undefined routes and forwards an ApiError
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// 7. Central Error Handler - Formats and sends standard JSON error responses
app.use(errorHandler);

module.exports = app;
