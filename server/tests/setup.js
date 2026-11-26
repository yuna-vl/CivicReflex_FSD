/**
 * tests/setup.js
 * 
 * Purpose:
 * Global Jest setup and teardown for in-memory MongoDB database testing.
 * Provides airtight safety guarantees preventing automated tests from ever
 * contacting production or remote MongoDB Atlas instances.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Set testing environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_for_automated_testing_12345';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_for_automated_testing_67890';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// CRITICAL SAFETY CHECK: Immediately abort if MONGO_URI points to remote Atlas
if (process.env.MONGO_URI && process.env.MONGO_URI.toLowerCase().includes('mongodb.net')) {
  console.error('================================================================');
  console.error('[CRITICAL TEST SAFETY ERROR] Aborting test suite execution!');
  console.error('MONGO_URI is pointing to remote MongoDB Atlas (mongodb.net).');
  console.error('Automated tests must ONLY run against the in-memory database.');
  console.error('================================================================');
  process.exit(1);
}

beforeAll(async () => {
  // Start isolated in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Secondary verification of the memory URI
  if (uri.toLowerCase().includes('mongodb.net')) {
    console.error('[CRITICAL SAFETY ERROR] Generated URI matched mongodb.net!');
    process.exit(1);
  }

  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
});

afterEach(async () => {
  // Clear all collection data between tests to ensure complete test isolation
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});
