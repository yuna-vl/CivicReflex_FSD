/**
 * src/server.js
 * 
 * Purpose:
 * Main entry point for the backend server.
 * Connects to MongoDB first, and once the connection is established (or handled),
 * begins listening for incoming HTTP connections on the configured PORT.
 */

const app = require('./app');
const { port } = require('./config/env');
const connectDB = require('./config/db');
require('./events/logListeners').registerLogListeners(); // prints event lines in the terminal


/**
 * Initialize services and start HTTP server
 */
const startServer = async () => {
  try {
    // 1. Connect to MongoDB database
    console.log('[Server] Connecting to MongoDB...');
    await connectDB();

    // 2. Start listening on the specified port
    app.listen(port, () => {
      console.log(`[Server] CivicReflex backend listening on port ${port} (http://localhost:${port})`);
      console.log(`[Server] Health check endpoint: http://localhost:${port}/health`);
    });
  } catch (error) {
    console.error(`[Server Error] Server failed to start: ${error.message}`);
    // Exit process with failure code if unable to start
    process.exit(1);
  }
};

startServer();

