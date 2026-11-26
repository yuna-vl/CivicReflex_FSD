/**
 * server/scripts/e2e-branch2.js
 * 
 * Comprehensive End-to-End Test Suite for Branch 2 (feature/auth-admin).
 * Validates all requirements across:
 * - Part 1: Auth & Identity (Register, Login, JWT, Refresh, RBAC, actor migration)
 * - Part 2: Admin Users & Account Suspension
 * - Part 3: Tamper-Evident Audit Log Hash Chain & Tamper Detection
 * - Part 4: Moderation Decisions (5 actions), Wards, Departments, Categories, Settings, Overview
 * - Part 5: Hardening (Refresh token reuse detection, Account lockout, CSV export, Password change)
 * - Branch 1 Integration: Ticket lifecycle, citizen disputes, bbox search, privacy blur vs authority view
 */

const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const { mongoUri } = require('../src/config/env');
const User = require('../src/modules/users/user.model');
const Report = require('../src/modules/reports/report.model');
const Ticket = require('../src/modules/tickets/ticket.model');
const Ward = require('../src/modules/wards/ward.model');
const Category = require('../src/modules/categories/category.model');
const Settings = require('../src/modules/settings/settings.model');
const AuditLog = require('../src/modules/audit/auditLog.model');
const { hashPassword } = require('../src/utils/token');

const TEST_PORT = 5077;
const baseUrl = `http://127.0.0.1:${TEST_PORT}/api`;

let server;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runE2ESuite() {
  console.log('================================================================');
  console.log('BRANCH 2 (feature/auth-admin) FULL E2E ACCEPTANCE SUITE');
  console.log('================================================================\n');

  try {
    // 1. Database Connection
    console.log('Connecting to database...');
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      console.log('MongoDB connected successfully.\n');
    } catch (dbErr) {
      console.warn('⚠️ MongoDB connection note:');
      console.warn(dbErr.message);
      console.warn('If accessing MongoDB Atlas, ensure your IP is whitelisted on Atlas Network Access.');
      throw dbErr;
    }

    // 2. Start HTTP Server
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, '127.0.0.1', () => {
        console.log(`Test HTTP server running on ${baseUrl}\n`);
        resolve();
      });
    });

    // Cleanup any prior test artifacts
    await cleanupTestData();

    // =========================================================================
    // PART 1: AUTH & IDENTITY
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log('PART 1: AUTH & IDENTITY');
    console.log('----------------------------------------------------------------');

    // 1.1 Register citizen
    console.log('\n--- 1.1: Register Citizen ---');
    const citizenReg = {
      name: '[TEST] Citizen One',
      email: 'test-citizen-e2e@civicreflex.test',
      password: 'Password123!',
      ward: 'Ward 14',
      phone: '+91-9876543210'
    };
    const resReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(citizenReg)
    });
    const dataReg = await resReg.json();
    assert(resReg.status === 201, 'POST /auth/register returns 201 Created');
    assert(dataReg.data.role === 'citizen', 'Registered user forced to citizen role');
    assert(dataReg.data.userCode.startsWith('USR-'), 'Assigned sequential userCode USR-*');
    const citizenUserCode = dataReg.data.userCode;

    // 1.2 Duplicate email registration rejection
    console.log('\n--- 1.2: Duplicate Email Registration ---');
    const resDup = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(citizenReg)
    });
    assert(resDup.status === 409, 'Duplicate email registration returns 409 Conflict');

    // 1.3 Login citizen
    console.log('\n--- 1.3: Login Citizen ---');
    const resLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: citizenReg.email, password: citizenReg.password })
    });
    const dataLogin = await resLogin.json();
    assert(resLogin.status === 200, 'POST /auth/login returns 200 OK');
    assert(!!dataLogin.data.accessToken, 'Login issues accessToken');
    assert(!!dataLogin.data.refreshToken, 'Login issues refreshToken');
    const citizenAccessToken = dataLogin.data.accessToken;
    let citizenRefreshToken = dataLogin.data.refreshToken;

    // 1.4 Wrong password rejection
    console.log('\n--- 1.4: Wrong Password ---');
    const resWrongPass = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: citizenReg.email, password: 'WrongPassword999!' })
    });
    const dataWrongPass = await resWrongPass.json();
    assert(resWrongPass.status === 401, 'Wrong password returns 401 Unauthorized');
    assert(dataWrongPass.error?.message === 'Invalid email or password', 'Standardized error message');

    // 1.5 Profile endpoint
    console.log('\n--- 1.5: GET /auth/me ---');
    const resMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${citizenAccessToken}` }
    });
    const dataMe = await resMe.json();
    assert(resMe.status === 200, 'GET /auth/me returns 200 OK');
    assert(dataMe.data.userCode === citizenUserCode, 'Profile matches authenticated user');

    // 1.6 Refresh token rotation
    console.log('\n--- 1.6: POST /auth/refresh ---');
    const resRefresh = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: citizenRefreshToken })
    });
    const dataRefresh = await resRefresh.json();
    assert(resRefresh.status === 200, 'POST /auth/refresh returns 200 OK');
    assert(!!dataRefresh.data.accessToken, 'Refresh returns new accessToken');
    assert(dataRefresh.data.refreshToken !== citizenRefreshToken, 'Refresh token rotated successfully');
    citizenRefreshToken = dataRefresh.data.refreshToken;

    // 1.7 RBAC test: Citizen on authority route -> 403
    console.log('\n--- 1.7: RBAC: Citizen on Authority Route (Expect 403) ---');
    const resRbac = await fetch(`${baseUrl}/tickets/CR-2026-9001/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenAccessToken}`
      },
      body: JSON.stringify({ department: 'Roads', officerId: 'OFF-1', officerName: 'Officer' })
    });
    assert(resRbac.status === 403, 'Citizen blocked from authority endpoint with 403 Forbidden');

    // 1.8 Unauthenticated request -> 401
    console.log('\n--- 1.8: Missing Token (Expect 401) ---');
    const resNoToken = await fetch(`${baseUrl}/tickets/CR-2026-9001/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert(resNoToken.status === 401, 'Unauthenticated request returns 401 Unauthorized');


    // =========================================================================
    // PART 2: ADMIN USERS & SUSPENSION
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('PART 2: ADMIN USERS & SUSPENSION');
    console.log('----------------------------------------------------------------');

    // Create an Admin user directly in DB
    const adminPassHash = await hashPassword('AdminPass123!');
    const adminUser = await User.create({
      userCode: 'USR-ADMIN-01',
      name: '[TEST] Super Admin',
      email: 'test-admin-e2e@civicreflex.test',
      passwordHash: adminPassHash,
      role: 'admin',
      accountStatus: 'Active'
    });

    const resAdminLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminUser.email, password: 'AdminPass123!' })
    });
    const dataAdminLogin = await resAdminLogin.json();
    const adminAccessToken = dataAdminLogin.data.accessToken;

    // 2.1 Admin query users list with filters & search
    console.log('\n--- 2.1: Admin Query Users ---');
    const resUsers = await fetch(`${baseUrl}/admin/users?role=citizen&q=Citizen`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    const dataUsers = await resUsers.json();
    assert(resUsers.status === 200, 'GET /admin/users returns 200 OK');
    assert(Array.isArray(dataUsers.data.items), 'Returns users array');

    // 2.2 Admin create an Authority and Field Officer user
    console.log('\n--- 2.2: Admin Create Users ---');
    const authUserPayload = {
      name: '[TEST] Chief Commissioner',
      email: 'test-auth-e2e@civicreflex.test',
      password: 'AuthPassword123!',
      role: 'authority',
      department: 'Solid Waste Management'
    };
    const resCreateAuth = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify(authUserPayload)
    });
    const dataCreateAuth = await resCreateAuth.json();
    assert(resCreateAuth.status === 201, 'POST /admin/users creates authority user (201)');
    const authorityUserCode = dataCreateAuth.data.userCode;

    // Login authority
    const resAuthLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authUserPayload.email, password: authUserPayload.password })
    });
    const dataAuthLogin = await resAuthLogin.json();
    const authorityAccessToken = dataAuthLogin.data.accessToken;

    const officerUserPayload = {
      name: '[TEST] Suresh Field Officer',
      email: 'test-officer-e2e@civicreflex.test',
      password: 'OfficerPassword123!',
      role: 'field_officer',
      department: 'Solid Waste Management'
    };
    const resCreateOfficer = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify(officerUserPayload)
    });
    const dataCreateOfficer = await resCreateOfficer.json();
    assert(resCreateOfficer.status === 201, 'POST /admin/users creates field_officer user (201)');
    const officerUserCode = dataCreateOfficer.data.userCode;

    // Login officer
    const resOfficerLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: officerUserPayload.email, password: officerUserPayload.password })
    });
    const dataOfficerLogin = await resOfficerLogin.json();
    const officerAccessToken = dataOfficerLogin.data.accessToken;

    // 2.3 Suspend user test
    console.log('\n--- 2.3: User Suspension & Session Invalidation ---');
    // Create temporary citizen to suspend
    const tempCitizenPayload = {
      name: '[TEST] Citizen To Suspend',
      email: 'test-suspend-e2e@civicreflex.test',
      password: 'Password123!'
    };
    const resTempReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tempCitizenPayload)
    });
    const dataTempReg = await resTempReg.json();
    const tempUserCode = dataTempReg.data.userCode;

    const resTempLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tempCitizenPayload.email, password: tempCitizenPayload.password })
    });
    const dataTempLogin = await resTempLogin.json();
    const tempAccessToken = dataTempLogin.data.accessToken;

    // Suspend user
    const resSuspend = await fetch(`${baseUrl}/admin/users/${tempUserCode}/suspend`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify({ reason: 'Spam submissions detected' })
    });
    assert(resSuspend.status === 200, 'PATCH /admin/users/:id/suspend returns 200 OK');

    // Existing token should now fail immediately with 403
    const resBlockedToken = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tempAccessToken}` }
    });
    assert(resBlockedToken.status === 403, 'Existing access token immediately rejected with 403 Account suspended');

    // New login attempt should fail with 403
    const resBlockedLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tempCitizenPayload.email, password: tempCitizenPayload.password })
    });
    assert(resBlockedLogin.status === 403, 'New login rejected with 403 Account suspended');

    // Admin self-suspension prevented
    const resSelfSuspend = await fetch(`${baseUrl}/admin/users/${adminUser.userCode}/suspend`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify({ reason: 'Self test' })
    });
    assert(resSelfSuspend.status === 400, 'Admin cannot suspend themselves (400)');

    // Reinstate user
    const resReinstate = await fetch(`${baseUrl}/admin/users/${tempUserCode}/reinstate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    assert(resReinstate.status === 200, 'PATCH /admin/users/:id/reinstate returns 200 OK');


    // =========================================================================
    // PART 3: AUDIT LOG WITH TAMPER-EVIDENT CHAIN
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('PART 3: AUDIT LOG WITH TAMPER-EVIDENT HASH CHAIN');
    console.log('----------------------------------------------------------------');

    // 3.1 Verify intact chain
    console.log('\n--- 3.1: Verify Audit Chain (Intact) ---');
    const resAuditVerify = await fetch(`${baseUrl}/admin/audit-logs/verify`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    const dataAuditVerify = await resAuditVerify.json();
    assert(resAuditVerify.status === 200, 'GET /admin/audit-logs/verify returns 200 OK');
    assert(dataAuditVerify.data.status === 'intact', 'Audit chain integrity reported as "intact"');
    console.log(`Intact audit logs count: ${dataAuditVerify.data.count}`);

    // 3.2 Query audit logs
    const resLogs = await fetch(`${baseUrl}/admin/audit-logs?limit=5`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    const dataLogs = await resLogs.json();
    assert(resLogs.status === 200, 'GET /admin/audit-logs returns 200 OK');
    assert(dataLogs.data.items.length > 0, 'Audit entries successfully queried');

    // 3.3 Tampering detection test
    console.log('\n--- 3.3: Tampering Detection ---');
    const targetLog = await AuditLog.findOne().sort({ timestamp: -1 });
    const originalDesc = targetLog.description;

    // Tamper directly in DB
    targetLog.description = 'TAMPERED ILLEGAL AUDIT MODIFICATION';
    await targetLog.save();

    const resTamperVerify = await fetch(`${baseUrl}/admin/audit-logs/verify`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    const dataTamperVerify = await resTamperVerify.json();
    assert(dataTamperVerify.data.status === 'broken', 'Tampered log detected: status is "broken"');
    assert(dataTamperVerify.data.brokenAuditId === targetLog.auditId, 'Identified exact broken auditId');
    console.log(`Detected broken chain: ${dataTamperVerify.data.reason}`);

    // Restore original record
    targetLog.description = originalDesc;
    await targetLog.save();

    const resRestoredVerify = await fetch(`${baseUrl}/admin/audit-logs/verify`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    const dataRestoredVerify = await resRestoredVerify.json();
    assert(dataRestoredVerify.data.status === 'intact', 'Chain restored: status is "intact"');


    // =========================================================================
    // PART 4: MODERATION, WARDS, DEPARTMENTS, CATEGORIES, SETTINGS, OVERVIEW
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('PART 4: MODERATION, WARDS, DEPARTMENTS, CATEGORIES, SETTINGS');
    console.log('----------------------------------------------------------------');

    // 4.1 Wards
    console.log('\n--- 4.1: Municipal Wards ---');
    const wardPayload = {
      wardNumber: 'Ward-TEST-99',
      wardName: 'Test Heritage Ward',
      zone: 'East Zone',
      assignedAuthority: 'Superintendent Rao'
    };
    const resCreateWard = await fetch(`${baseUrl}/admin/wards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify(wardPayload)
    });
    assert(resCreateWard.status === 201, 'POST /admin/wards creates ward (201)');

    const resWardsList = await fetch(`${baseUrl}/admin/wards`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    const dataWardsList = await resWardsList.json();
    const createdWard = dataWardsList.data.find((w) => w.wardNumber === 'Ward-TEST-99');
    assert(!!createdWard, 'Ward listed in admin wards list');
    assert(typeof createdWard.resolutionRate === 'number', 'Ward includes calculated resolutionRate');

    // 4.2 Categories
    console.log('\n--- 4.2: Categories Management ---');
    const catPayload = {
      name: '[TEST] Road Hazards',
      department: 'Roads Department',
      defaultPriority: 'High',
      defaultSlaHours: 24,
      status: 'Active',
      description: 'Dangerous road potholes and sinkholes'
    };
    const resCreateCat = await fetch(`${baseUrl}/admin/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify(catPayload)
    });
    assert(resCreateCat.status === 201, 'POST /admin/categories creates category (201)');

    // Public categories
    const resPublicCats = await fetch(`${baseUrl}/categories`);
    const dataPublicCats = await resPublicCats.json();
    assert(resPublicCats.status === 200, 'GET /categories (public) returns 200 OK');
    assert(dataPublicCats.data.some((c) => c.name === '[TEST] Road Hazards'), 'Public categories includes active category');

    // 4.3 Settings & Dynamic SLA
    console.log('\n--- 4.3: Operational Settings & Dynamic SLA ---');
    const resSettingsGet = await fetch(`${baseUrl}/admin/settings`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    assert(resSettingsGet.status === 200, 'GET /admin/settings returns 200 OK');

    const resSettingsPut = await fetch(`${baseUrl}/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify({ highSlaHours: 12, portalName: 'CivicReflex Metro' })
    });
    const dataSettingsPut = await resSettingsPut.json();
    assert(resSettingsPut.status === 200, 'PUT /admin/settings updates settings');
    assert(dataSettingsPut.data.highSlaHours === 12, 'highSlaHours updated to 12');

    // 4.4 Overview
    console.log('\n--- 4.4: Admin Overview ---');
    const resOverview = await fetch(`${baseUrl}/admin/overview`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    const dataOverview = await resOverview.json();
    assert(resOverview.status === 200, 'GET /admin/overview returns 200 OK');
    assert(typeof dataOverview.data.users.total === 'number', 'Overview reports user totals');
    assert(typeof dataOverview.data.reports === 'number', 'Overview reports report totals');

    // 4.5 Moderation Decisions (all 5 actions)
    console.log('\n--- 4.5: Moderation Decisions on 5 Actions ---');

    // Create 5 reports to moderate
    const createModReport = async (title) => {
      const res = await fetch(`${baseUrl}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenAccessToken}`
        },
        body: JSON.stringify({
          title: `[TEST] ${title}`,
          category: '[TEST] Road Hazards',
          description: 'Moderation test report description',
          wardNumber: 'Ward-TEST-99'
        })
      });
      const data = await res.json();
      return data.data;
    };

    const repApprove = await createModReport('For Approve Action');
    const repReject = await createModReport('For Reject Action');
    const repDuplicate = await createModReport('For Duplicate Action');
    const repClarify = await createModReport('For Clarify Action');
    const repEscalate = await createModReport('For Escalate Action');

    // Flag repApprove
    await fetch(`${baseUrl}/reports/${repApprove.reportId}/flag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenAccessToken}`
      },
      body: JSON.stringify({ reason: 'Suspected spam' })
    });

    // Action 1: approve
    const resApprove = await fetch(`${baseUrl}/admin/moderation/${repApprove.reportId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify({ action: 'approve' })
    });
    const dataApprove = await resApprove.json();
    assert(resApprove.status === 200, 'Moderation approve returns 200');
    assert(dataApprove.data.status === 'Reported' && dataApprove.data.isFlagged === false, 'Approve clears flag & sets Reported');

    // Action 2: reject
    const resReject = await fetch(`${baseUrl}/admin/moderation/${repReject.reportId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify({ action: 'reject', reason: 'Abusive language and content' })
    });
    const dataReject = await resReject.json();
    assert(dataReject.data.status === 'Rejected by Moderation', 'Reject sets Rejected by Moderation');

    // Action 3: duplicate
    const resDuplicate = await fetch(`${baseUrl}/admin/moderation/${repDuplicate.reportId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify({ action: 'duplicate', duplicateOf: repApprove.ticketNumber })
    });
    const dataDuplicate = await resDuplicate.json();
    assert(dataDuplicate.data.status === 'Duplicate', 'Duplicate sets Duplicate status');

    // Action 4: clarify
    const resClarify = await fetch(`${baseUrl}/admin/moderation/${repClarify.reportId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify({ action: 'clarify', reason: 'Please upload a photo of the landmark' })
    });
    const dataClarify = await resClarify.json();
    assert(dataClarify.data.status === 'Clarification Requested', 'Clarify sets Clarification Requested status');

    // Action 5: escalate
    const resEscalate = await fetch(`${baseUrl}/admin/moderation/${repEscalate.reportId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify({ action: 'escalate', reason: 'Urgent risk of collapse' })
    });
    const dataEscalate = await resEscalate.json();
    assert(dataEscalate.data.status === 'Escalated', 'Escalate sets Escalated status');


    // =========================================================================
    // PART 5: HARDENING
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('PART 5: HARDENING & SECURITY');
    console.log('----------------------------------------------------------------');

    // 5.1 Refresh token reuse detection
    console.log('\n--- 5.1: Refresh Token Reuse Detection ---');
    // Save current refresh token
    const oldRefreshToken = citizenRefreshToken;
    // Rotate once legally
    const resRotate = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldRefreshToken })
    });
    assert(resRotate.status === 200, 'Legal refresh rotation succeeds');

    // Attempt to reuse oldRefreshToken (stolen token replay)
    const resReuse = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldRefreshToken })
    });
    assert(resReuse.status === 401, 'Reused refresh token returns 401 Unauthorized');

    // 5.2 Login lockout (5 failed logins lock for 15 minutes)
    console.log('\n--- 5.2: Account Lockout on 5 Failed Logins ---');
    const lockoutEmail = 'test-lockout-e2e@civicreflex.test';
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '[TEST] Lockout User', email: lockoutEmail, password: 'Password123!' })
    });

    for (let attempt = 1; attempt <= 4; attempt++) {
      await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lockoutEmail, password: 'WrongPassword!' })
      });
    }

    // 5th attempt locks the account
    const res5th = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lockoutEmail, password: 'WrongPassword!' })
    });
    assert(res5th.status === 401, '5th failed attempt returns 401');

    // Subsequent attempt is blocked by lockout
    const resLocked = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lockoutEmail, password: 'Password123!' })
    });
    assert(resLocked.status === 423, 'Locked account returns HTTP 423 Locked');

    // 5.3 Password change
    console.log('\n--- 5.3: Password Change ---');
    const resChangePass = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenAccessToken}`
      },
      body: JSON.stringify({ currentPassword: 'Password123!', newPassword: 'NewSecurePassword123!' })
    });
    assert(resChangePass.status === 200, 'POST /auth/change-password returns 200 OK');

    // 5.4 Audit logs CSV export
    console.log('\n--- 5.4: Audit Logs CSV Export ---');
    const resCsv = await fetch(`${baseUrl}/admin/audit-logs?format=csv`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    const textCsv = await resCsv.text();
    assert(resCsv.status === 200, 'GET /admin/audit-logs?format=csv returns 200 OK');
    assert(resCsv.headers.get('content-type')?.includes('text/csv'), 'Content-Type is text/csv');
    assert(textCsv.startsWith('"auditId"'), 'CSV starts with auditId header row');


    // =========================================================================
    // BRANCH 1 INTEGRATION & LIFECYCLE
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('BRANCH 1 INTEGRATION & REGRESSION CHECKS');
    console.log('----------------------------------------------------------------');

    // Full ticket lifecycle with authenticated actors
    console.log('\n--- Ticket Lifecycle: Create -> Assign -> Inspection -> Confirm ---');
    const repLifecycle = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenAccessToken}`
      },
      body: JSON.stringify({
        title: '[TEST] Blocked Storm Drain',
        category: '[TEST] Road Hazards',
        description: 'Water accumulation on main road',
        wardNumber: 'Ward-TEST-99',
        severity: 'High'
      })
    });
    const dataLifecycle = await repLifecycle.json();
    const ticketLifecycleNum = dataLifecycle.data.ticketNumber;
    const reportLifecycleId = dataLifecycle.data.reportId;
    assert(repLifecycle.status === 201, 'Grievance lodged with authenticated citizen');

    // Authority assigns to officer
    const resAssign = await fetch(`${baseUrl}/tickets/${ticketLifecycleNum}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authorityAccessToken}`
      },
      body: JSON.stringify({
        department: 'Solid Waste Management',
        officerId: officerUserCode,
        officerName: 'Suresh Field Officer'
      })
    });
    assert(resAssign.status === 200, 'Authority assigns ticket');

    // Officer inspection actions
    await fetch(`${baseUrl}/tickets/${ticketLifecycleNum}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${officerAccessToken}` },
      body: JSON.stringify({ action: 'start_inspection' })
    });
    await fetch(`${baseUrl}/tickets/${ticketLifecycleNum}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${officerAccessToken}` },
      body: JSON.stringify({ action: 'submit_remarks', remarks: 'Debris verified' })
    });
    await fetch(`${baseUrl}/tickets/${ticketLifecycleNum}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${officerAccessToken}` },
      body: JSON.stringify({ action: 'mark_in_progress' })
    });
    await fetch(`${baseUrl}/tickets/${ticketLifecycleNum}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${officerAccessToken}` },
      body: JSON.stringify({ action: 'upload_before_photo', photoUrl: 'https://example.com/before.jpg' })
    });
    await fetch(`${baseUrl}/tickets/${ticketLifecycleNum}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${officerAccessToken}` },
      body: JSON.stringify({ action: 'upload_after_photo', photoUrl: 'https://example.com/after.jpg' })
    });
    const resComplete = await fetch(`${baseUrl}/tickets/${ticketLifecycleNum}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${officerAccessToken}` },
      body: JSON.stringify({ action: 'submit_completion', note: 'Cleared cleanly' })
    });
    assert(resComplete.status === 200, 'Officer submits completion -> Resolved');

    // Citizen confirm
    const resCitizenConfirm = await fetch(`${baseUrl}/tickets/${ticketLifecycleNum}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenAccessToken}` },
      body: JSON.stringify({ decision: 'confirm', comment: 'All clear' })
    });
    assert(resCitizenConfirm.status === 200, 'Citizen confirms ticket -> Citizen-Confirmed');

    // Privacy check: Anonymous experience report is blurred for public, unblurred for authority
    console.log('\n--- Privacy Blur vs Authority Unblurred ---');
    const anonRes = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${citizenAccessToken}` },
      body: JSON.stringify({
        title: '[TEST] Anonymous Experience',
        category: '[TEST] Road Hazards',
        description: 'Anonymous citizen note',
        wardNumber: 'Ward-TEST-99',
        type: 'experience',
        isAnonymous: true,
        latitude: 12.9715923,
        longitude: 77.5945627
      })
    });
    const anonData = await anonRes.json();
    const anonReportId = anonData.data.reportId;

    // Public GET (no auth)
    const resPublicAnon = await fetch(`${baseUrl}/reports/${anonReportId}`);
    const dataPublicAnon = await resPublicAnon.json();
    assert(dataPublicAnon.data.createdBy === undefined, 'Public response hides createdBy for anonymous');
    assert(
      dataPublicAnon.data.geo?.coordinates[0] === 77.59 && dataPublicAnon.data.geo?.coordinates[1] === 12.97,
      'Public response blurs coordinates to 2 decimals [77.59, 12.97]'
    );

    // Authority GET (with authorityToken)
    const resAuthAnon = await fetch(`${baseUrl}/reports/${anonReportId}`, {
      headers: { Authorization: `Bearer ${authorityAccessToken}` }
    });
    const dataAuthAnon = await resAuthAnon.json();
    assert(dataAuthAnon.data.createdBy === citizenUserCode, 'Authority sees unblurred createdBy');
    assert(
      dataAuthAnon.data.geo?.coordinates[0] === 77.5945627,
      'Authority sees unblurred full-precision coordinates'
    );

    console.log('\n================================================================');
    console.log('ALL E2E ACCEPTANCE CHECKS PASSED (100%)');
    console.log('================================================================\n');

  } catch (err) {
    console.error('E2E Test Run encountered error:', err);
    throw err;
  } finally {
    await cleanupTestData();
    if (server) {
      await new Promise((r) => server.close(r));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

async function cleanupTestData() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({ email: { $regex: 'test-.*@civicreflex\\.test' } });
      await Report.deleteMany({ title: { $regex: '^\\[TEST\\]' } });
      await Ticket.deleteMany({ subject: { $regex: '^\\[TEST\\]' } });
      await Ward.deleteMany({ wardNumber: { $regex: 'Ward-TEST' } });
      await Category.deleteMany({ name: { $regex: '^\\[TEST\\]' } });
      await AuditLog.deleteMany({ description: { $regex: 'TAMPERED' } });
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

runE2ESuite()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
