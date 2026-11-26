/**
 * tests/admin-moderation-audit.test.js
 * 
 * Automated test suite covering Content Moderation and Tamper-Evident Audit Log:
 * 1. Moderation reject decision without a reason is rejected with 400 Bad Request
 * 2. Moderation reject decision with a reason succeeds (200 OK)
 * 3. Audit trail chain verifies as intact on valid append-only sequence
 * 4. Audit trail chain detects tampered historical entry and identifies broken block
 */

const { app, request, createTestUser } = require('./helpers');
const Report = require('../src/modules/reports/report.model');
const AuditLog = require('../src/modules/audit/auditLog.model');
const { logAudit } = require('../src/modules/audit/audit.service');

describe('Admin Moderation & Tamper-Evident Audit Automated Test Suite', () => {
  let admin;
  let citizen;

  beforeEach(async () => {
    admin = await createTestUser('admin');
    citizen = await createTestUser('citizen');
  });

  describe('Report Moderation Decisions', () => {
    it('rejects a moderation reject action without a reason with 400 Bad Request', async () => {
      // Create a flagged report
      const createRes = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${citizen.token}`)
        .send({
          title: 'Suspicious commercial advertisement',
          category: 'Public Safety',
          description: 'Spam banner attached to electrical pole.',
          wardNumber: 'Ward 14'
        })
        .expect(201);

      const reportId = createRes.body.data.reportId;

      // Admin tries to reject without providing a reason
      const res = await request(app)
        .post(`/api/admin/moderation/${reportId}/decision`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          action: 'reject'
          // reason is intentionally missing
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/reason is required for moderation action 'reject'/i);
    });

    it('successfully processes moderation reject when reason is provided (200 OK)', async () => {
      const createRes = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${citizen.token}`)
        .send({
          title: 'Commercial spam coaching banner',
          category: 'Public Safety',
          description: 'Advertisement not related to civic infrastructure.',
          wardNumber: 'Ward 08'
        })
        .expect(201);

      const reportId = createRes.body.data.reportId;

      const res = await request(app)
        .post(`/api/admin/moderation/${reportId}/decision`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          action: 'reject',
          reason: 'Commercial spam advertisement violating civic guidelines'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.moderationStatus).toBe('Rejected');
    });
  });

  describe('Tamper-Evident SHA-256 Audit Trail Verification', () => {
    it('verifies that an untampered audit chain is intact, and detects any historical tampering', async () => {
      // 1. Generate legitimate chronological audit entries
      await logAudit({
        action: 'user_created',
        relatedRecord: 'USR-TEST-1',
        user: admin.userCode,
        role: 'admin',
        description: 'Test admin initialized'
      });

      await logAudit({
        action: 'report_lodged',
        relatedRecord: 'REP-2026-1001',
        user: citizen.userCode,
        role: 'citizen',
        description: 'Citizen filed grievance'
      });

      await logAudit({
        action: 'ticket_assigned',
        relatedRecord: 'CR-2026-9001',
        user: admin.userCode,
        role: 'admin',
        description: 'Ticket assigned to field officer'
      });

      // 2. Verify untampered chain -> Status should be 'intact'
      const verifyRes1 = await request(app)
        .get('/api/admin/audit-logs/verify')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(verifyRes1.body.success).toBe(true);
      expect(verifyRes1.body.data.status).toBe('intact');
      expect(verifyRes1.body.data.count).toBeGreaterThanOrEqual(3);

      // 3. Simulate unauthorized database tampering on an earlier record
      const firstEntry = await AuditLog.findOne({ action: 'user_created' });
      expect(firstEntry).toBeDefined();

      await AuditLog.updateOne(
        { _id: firstEntry._id },
        { $set: { description: 'Tampered description injected via unauthorized direct DB access' } }
      );

      // 4. Verify chain again -> Status must detect break ('broken')
      const verifyRes2 = await request(app)
        .get('/api/admin/audit-logs/verify')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(verifyRes2.body.success).toBe(true);
      expect(verifyRes2.body.data.status).toBe('broken');
      expect(verifyRes2.body.data.brokenAuditId).toBe(firstEntry.auditId);
    });
  });
});
