/**
 * tests/reports.test.js
 * 
 * Automated test suite covering citizen Reports API:
 * 1. Report creation ignores client-provided status/upvotes (enforces server-controlled fields)
 * 2. Idempotency-Key header returns the existing report and prevents duplicate records
 * 3. Citizen verification increments count and duplicate verification by same user returns 409
 */

const { app, request, createTestUser } = require('./helpers');
const Report = require('../src/modules/reports/report.model');

describe('Reports API Automated Test Suite', () => {
  let citizen;

  beforeEach(async () => {
    citizen = await createTestUser('citizen');
  });

  describe('POST /api/reports', () => {
    it('creates a report ignoring client-sent system fields (status, upvotes)', async () => {
      const payload = {
        title: 'Deep road crater near junction',
        category: 'Road Damage / Potholes',
        description: 'Large pothole obstructing commuter traffic.',
        wardNumber: 'Ward 14',
        status: 'Resolved', // Should be stripped & ignored
        upvotes: 999        // Should be stripped & ignored
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${citizen.token}`)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.reportId).toBeDefined();
      expect(res.body.data.status).toBe('Reported');
      expect(res.body.data.upvotes).toBe(0);

      // Verify in DB directly
      const savedReport = await Report.findOne({ reportId: res.body.data.reportId });
      expect(savedReport.status).toBe('Reported');
      expect(savedReport.upvotes).toBe(0);
    });

    it('returns the same report when re-submitted with the same Idempotency-Key without creating duplicates', async () => {
      const idempotencyKey = 'idem-unique-key-12345';
      const payload = {
        title: 'Broken streetlight on lane 4',
        category: 'Streetlight Issues',
        description: 'Sodium lamp dark for three days.',
        wardNumber: 'Ward 08'
      };

      // First submission
      const res1 = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${citizen.token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload)
        .expect(201);

      const reportId1 = res1.body.data.reportId;
      expect(reportId1).toBeDefined();

      // Second submission with exact same idempotency key
      const res2 = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${citizen.token}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect([200, 201]).toContain(res2.status);
      expect(res2.body.data.reportId).toBe(reportId1);

      // Confirm only 1 document exists in the collection
      const count = await Report.countDocuments({ idempotencyKey });
      expect(count).toBe(1);
    });
  });

  describe('POST /api/reports/:id/verify', () => {
    it('allows a citizen to verify a report, and rejects duplicate verification by the same user with 409', async () => {
      // 1. Create a base report
      const createRes = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${citizen.token}`)
        .send({
          title: 'Accumulated garbage near park',
          category: 'Garbage and Waste Management',
          description: 'Garbage bins overflowing across footpath.',
          wardNumber: 'Ward 11'
        })
        .expect(201);

      const reportId = createRes.body.data.reportId;

      // 2. Second citizen verifies the report
      const verifyingCitizen = await createTestUser('citizen', {
        email: 'verifier.citizen@civicreflex.test'
      });

      const verifyRes1 = await request(app)
        .post(`/api/reports/${reportId}/verify`)
        .set('Authorization', `Bearer ${verifyingCitizen.token}`)
        .send({})
        .expect(200);

      expect(verifyRes1.body.success).toBe(true);
      expect(verifyRes1.body.data.verifiedCount).toBe(1);

      // 3. Same citizen attempts to verify again -> 409 Conflict
      const verifyRes2 = await request(app)
        .post(`/api/reports/${reportId}/verify`)
        .set('Authorization', `Bearer ${verifyingCitizen.token}`)
        .send({})
        .expect(409);

      expect(verifyRes2.body.success).toBe(false);
      expect(verifyRes2.body.error.message).toMatch(/already verified/i);
    });
  });

  describe('GET /api/reports (Cursor Pagination & Lean Projections)', () => {
    it('supports cursor pagination returning items and nextCursor', async () => {
      // Create 3 reports
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/reports')
          .set('Authorization', `Bearer ${citizen.token}`)
          .send({
            title: `Report number ${i}`,
            category: 'Road Damage / Potholes',
            description: `Description for report ${i}`,
            wardNumber: 'Ward 14'
          })
          .expect(201);
      }

      // Query page 1 with limit 2
      const resPage1 = await request(app)
        .get('/api/reports?limit=2')
        .expect(200);

      expect(resPage1.body.success).toBe(true);
      expect(resPage1.body.data.items).toHaveLength(2);
      expect(resPage1.body.data.nextCursor).toBeDefined();
      expect(resPage1.body.data.nextCursor).not.toBeNull();

      // Query page 2 using nextCursor
      const resPage2 = await request(app)
        .get(`/api/reports?limit=2&cursor=${resPage1.body.data.nextCursor}`)
        .expect(200);

      expect(resPage2.body.success).toBe(true);
      expect(resPage2.body.data.items).toHaveLength(1);
      expect(resPage2.body.data.items[0].reportId).not.toBe(resPage1.body.data.items[0].reportId);
    });
  });
});
