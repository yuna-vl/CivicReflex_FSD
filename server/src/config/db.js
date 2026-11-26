/**
 * src/config/db.js
 * 
 * Purpose:
 * Manages the MongoDB database connection using the Mongoose ODM (Object Data Modeling) library.
 * It ensures a connection string exists before attempting to connect,
 * logs successful connections, and properly handles connection failures.
 */

const mongoose = require('mongoose');
const { mongoUri } = require('./env');

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  // Validate that a connection URI has been provided
  if (!mongoUri || mongoUri.trim() === '') {
    throw new Error(
      'MONGO_URI is missing or empty. Please define MONGO_URI in your server/.env file.'
    );
  }

  try {
    // Attempt connecting to MongoDB using Mongoose
    const conn = await mongoose.connect(mongoUri);
    console.log(`[Database] MongoDB Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    // Re-throw so the server entry point can decide how to handle the failure
    throw error;
  }
};

module.exports = connectDB;

