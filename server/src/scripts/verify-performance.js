/**
 * src/scripts/verify-performance.js
 * 
 * Purpose:
 * Validates index utilization via MongoDB .explain("executionStats") on:
 * 1. Report queries filtered by ward and status
 * 2. Ticket queries filtered by currentStatus and ward
 * Measures before and after query response times on the seeded dataset.
 */

const mongoose = require('mongoose');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const connectDB = require('../config/db');
const Report = require('../modules/reports/report.model');
const Ticket = require('../modules/tickets/ticket.model');
const seedDatabase = require('../seed/seed');

// Helper to locate the IXSCAN stage anywhere in the winning plan tree
const findIndexScan = (stage) => {
  if (!stage) return null;
  if (stage.stage === 'IXSCAN') return stage;
  if (stage.inputStage) return findIndexScan(stage.inputStage);
  if (Array.isArray(stage.inputStages)) {
    for (const sub of stage.inputStages) {
      const res = findIndexScan(sub);
      if (res) return res;
    }
  }
  return null;
};

const runPerformanceVerification = async () => {
  console.log('================================================================');
  console.log('PART 3: PERFORMANCE, INDEX EXPLAIN & RESPONSE TIME BENCHMARK');
  console.log('================================================================\n');

  let memoryServer = null;
  try {
    console.log('[Performance] Connecting to configured database...');
    await connectDB();
  } catch (connErr) {
    console.log(`[Performance] Remote MongoDB connection failed (${connErr.message}).`);
    console.log('[Performance] Falling back to high-performance in-memory MongoDB with seeded dataset...');
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri();
    process.env.MONGO_URI = uri;
    await mongoose.connect(uri);
    await seedDatabase();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
  }

  // Ensure Mongoose schema indexes are fully initialized in the database
  await Promise.all([Report.init(), Ticket.init()]);

  // 1. Explain Query on Reports by Ward and Status
  console.log('--- 1. Report Query Index Explain (.explain("executionStats")) ---');
  const reportFilter = { wardNumber: 'Ward 14', status: 'Reported' };
  const reportSort = { reportedAt: -1, _id: -1 };

  const reportExplain = await Report.find(reportFilter)
    .sort(reportSort)
    .limit(20)
    .explain('executionStats');

  const reportStats = reportExplain.executionStats;
  const reportWinningPlan = reportExplain.queryPlanner.winningPlan;
  const reportIxScan = findIndexScan(reportWinningPlan);

  const reportIndexName = reportIxScan ? reportIxScan.indexName : 'COLLSCAN';
  const reportStage = reportIxScan ? reportIxScan.stage : reportWinningPlan.stage;

  console.log(`Query: { wardNumber: 'Ward 14', status: 'Reported' } sort: { reportedAt: -1, _id: -1 }`);
  console.log(`Execution Stage:       ${reportStage}`);
  console.log(`Index Name:            ${reportIndexName}`);
  console.log(`Documents Returned:    ${reportStats.nReturned}`);
  console.log(`Documents Examined:    ${reportStats.totalDocsExamined}`);
  console.log(`Keys Examined:         ${reportStats.totalKeysExamined}`);
  console.log(`Execution Time:        ${reportStats.executionTimeMillis} ms`);
  console.log(`Index Utilized:        ${reportIxScan ? 'YES (IXSCAN)' : 'NO'}\n`);

  // 2. Explain Query on Tickets by CurrentStatus and Ward
  console.log('--- 2. Ticket Query Index Explain (.explain("executionStats")) ---');
  const ticketFilter = { currentStatus: 'Assigned', ward: 'Ward 14' };
  const ticketSort = { submissionDate: -1, _id: -1 };

  const ticketExplain = await Ticket.find(ticketFilter)
    .sort(ticketSort)
    .limit(20)
    .explain('executionStats');

  const ticketStats = ticketExplain.executionStats;
  const ticketWinningPlan = ticketExplain.queryPlanner.winningPlan;
  const ticketIxScan = findIndexScan(ticketWinningPlan);

  const ticketIndexName = ticketIxScan ? ticketIxScan.indexName : 'COLLSCAN';
  const ticketStage = ticketIxScan ? ticketIxScan.stage : ticketWinningPlan.stage;

  console.log(`Query: { currentStatus: 'Assigned', ward: 'Ward 14' } sort: { submissionDate: -1, _id: -1 }`);
  console.log(`Execution Stage:       ${ticketStage}`);
  console.log(`Index Name:            ${ticketIndexName}`);
  console.log(`Documents Returned:    ${ticketStats.nReturned}`);
  console.log(`Documents Examined:    ${ticketStats.totalDocsExamined}`);
  console.log(`Keys Examined:         ${ticketStats.totalKeysExamined}`);
  console.log(`Execution Time:        ${ticketStats.executionTimeMillis} ms`);
  console.log(`Index Utilized:        ${ticketIxScan ? 'YES (IXSCAN)' : 'NO'}\n`);

  // 3. Response Time Benchmark: Unoptimized vs Optimized (.lean() + projections)
  console.log('--- 3. Response Time Benchmark on Seeded Dataset (GET /api/reports) ---');
  const iterations = 50;

  // Unoptimized: Full Mongoose hydration without projections
  const unoptimizedTimes = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    await Report.find({ wardNumber: 'Ward 14' }).sort({ reportedAt: -1 }).limit(20);
    const t1 = process.hrtime.bigint();
    unoptimizedTimes.push(Number(t1 - t0) / 1e6); // convert to ms
  }
  const avgUnoptimized = unoptimizedTimes.reduce((a, b) => a + b, 0) / iterations;

  // Optimized: Lean projection with indexed compound sort
  const REPORT_LIST_PROJECTION = {
    reportId: 1,
    ticketNumber: 1,
    type: 1,
    title: 1,
    category: 1,
    subcategory: 1,
    location: 1,
    zone: 1,
    wardNumber: 1,
    landmark: 1,
    geo: 1,
    photoUrl: 1,
    status: 1,
    severity: 1,
    upvotes: 1,
    verifiedCount: 1,
    isAnonymous: 1,
    timeOfDay: 1,
    reportedAt: 1,
    assignedDepartment: 1,
    assignedOfficer: 1,
    slaTargetDate: 1,
    createdBy: 1,
    isFlagged: 1,
    moderationStatus: 1
  };

  const optimizedTimes = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    await Report.find({ wardNumber: 'Ward 14' })
      .select(REPORT_LIST_PROJECTION)
      .sort({ reportedAt: -1, _id: -1 })
      .limit(20)
      .lean();
    const t1 = process.hrtime.bigint();
    optimizedTimes.push(Number(t1 - t0) / 1e6);
  }
  const avgOptimized = optimizedTimes.reduce((a, b) => a + b, 0) / iterations;

  const speedup = (((avgUnoptimized - avgOptimized) / avgUnoptimized) * 100).toFixed(1);

  console.log(`Iterations:                   ${iterations}`);
  console.log(`Before (Unprojected Hydrated): ${avgUnoptimized.toFixed(2)} ms (avg)`);
  console.log(`After (.lean() + Projections): ${avgOptimized.toFixed(2)} ms (avg)`);
  console.log(`Latency Reduction:            ${speedup}% faster`);
  console.log('================================================================\n');

  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
};

if (require.main === module) {
  runPerformanceVerification().catch((err) => {
    console.error('Verification failed:', err);
    if (mongoose.connection.readyState !== 0) mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = runPerformanceVerification;
