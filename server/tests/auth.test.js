/**
 * tests/auth.test.js
 * 
 * Automated test suite covering Authentication, RBAC, and Token Verification:
 * 1. User registration & login success
 * 2. Login rejection with invalid credentials
 * 3. Login rejection for suspended users
 * 4. Missing/invalid token returns 401
 * 5. Role authorization check: citizen accessing authority/admin routes returns 403
 */

const { app, request, createTestUser } = require('./helpers');
const User = require('../src/modules/users/user.model');

describe('Authentication & RBAC Automated Test Suite', () => {
  describe('POST /api/auth/register', () => {
    it('successfully registers a new citizen user', async () => {
      const payload = {
        name: 'Aarav Patel',
        email: 'aarav.patel@civicreflex.test',
        password: 'ValidPassword123!',
        phone: '+91 98765 12345',
        ward: 'Ward 14'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(payload.email.toLowerCase());
      expect(res.body.data.role).toBe('citizen');
      expect(res.body.data.userCode).toBeDefined();
    });

    it('rejects registration when email is already taken', async () => {
      await createTestUser('citizen', { email: 'duplicate@civicreflex.test' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: 'duplicate@civicreflex.test',
          password: 'Password123!'
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/already registered/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('successfully logs in with valid credentials', async () => {
      const { password } = await createTestUser('citizen', {
        email: 'login.citizen@civicreflex.test',
        password: 'ValidPassword123!'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login.citizen@civicreflex.test',
          password
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('rejects login with wrong password (401)', async () => {
      await createTestUser('citizen', {
        email: 'wrongpass@civicreflex.test',
        password: 'CorrectPassword123!'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrongpass@civicreflex.test',
          password: 'IncorrectPassword999!'
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/invalid/i);
    });

    it('rejects login when user is suspended (403)', async () => {
      const { password } = await createTestUser('citizen', {
        email: 'suspended@civicreflex.test',
        password: 'Password123!',
        accountStatus: 'Suspended'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'suspended@civicreflex.test',
          password
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/account suspended/i);
    });
  });

  describe('Authentication & RBAC Middleware', () => {
    it('rejects access to protected routes when authorization token is missing (401)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/missing or invalid authorization token/i);
    });

    it('rejects citizen access to authority/admin routes with 403 Forbidden', async () => {
      const { token } = await createTestUser('citizen');

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/forbidden/i);
    });
  });
});
