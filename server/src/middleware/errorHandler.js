/**
 * src/middleware/errorHandler.js
 * 
 * Purpose:
 * Central error-handling middleware for Express.
 * Formats errors into a consistent structure:
 * {
 *   "success": false,
 *   "error": {
 *     "message": "Readable error message"
 *   }
 * }
 * 
 * Specific status mappings:
 * - Bad inputs (Zod errors, Mongoose Validation errors, Cast errors): 400
 * - Duplicate unique keys (MongoDB code 11000): 409
 * - Custom ApiError: err.statusCode
 * - Unexpected errors: 500
 */

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // 1. Zod input validation errors -> 400 Bad Request
  if (err.name === 'ZodError') {
    statusCode = 400;
    if (Array.isArray(err.issues) && err.issues.length > 0) {
      message = err.issues
        .map((issue) => {
          const path = issue.path.join('.');
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join(', ');
    } else {
      message = 'Invalid input data';
    }
  }

  // 2. Mongoose schema validation errors -> 400 Bad Request
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  // 3. Mongoose Cast errors (e.g. invalid ObjectId or number format) -> 400 Bad Request
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}: ${err.value}`;
  }

  // 4. MongoDB duplicate key errors (code 11000) -> 409 Conflict
  else if (err.code === 11000) {
    statusCode = 409;
    const duplicatedFields = Object.keys(err.keyValue || {}).join(', ');
    message = duplicatedFields
      ? `Duplicate value provided for unique field: ${duplicatedFields}`
      : 'Duplicate resource already exists';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message
    }
  });
};

module.exports = errorHandler;
