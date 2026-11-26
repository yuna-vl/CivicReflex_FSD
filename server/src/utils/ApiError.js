/**
 * src/utils/ApiError.js
 * 
 * Purpose:
 * A custom Error class for representing HTTP operational errors across the API.
 * By extending JavaScript's built-in Error class, ApiError allows controllers and
 * middleware to pass along an HTTP status code (e.g. 400 Bad Request, 404 Not Found)
 * together with an error message to the central error handling middleware.
 */

class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (e.g. 400, 401, 404, 500)
   * @param {string} message - Descriptive error message
   */
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.success = false;

    // Capture standard V8 stack trace excluding this constructor call
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;

