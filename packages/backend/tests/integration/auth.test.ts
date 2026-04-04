import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../src/app';
import { db } from '../../src/db/client';
import { users } from '../../src/db/schema';
import type { FastifyInstance } from 'fastify';

const TEST_USERNAME = 'testuser_auth';
const TEST_PASSWORD = 'correct-horse-battery-staple';
let TEST_USER_ID: string;

describe('Auth endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Insert test user
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
    const [user] = await db
      .insert(users)
      .values({
        username: TEST_USERNAME,
        passwordHash,
        displayName: 'Test User',
      })
      .returning({ id: users.id });
    TEST_USER_ID = user.id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.username, TEST_USERNAME));
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/auth/login
  // ---------------------------------------------------------------------------

  describe('POST /api/v1/auth/login', () => {
    it('returns 200 and user object on valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(TEST_USER_ID);
      expect(body.username).toBe(TEST_USERNAME);
      expect(body.displayName).toBe('Test User');
      expect(body.passwordHash).toBeUndefined();
    });

    it('sets httpOnly token cookie on successful login', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });

      expect(response.statusCode).toBe(200);
      const setCookie = response.headers['set-cookie'] as string;
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('token=');
      expect(setCookie.toLowerCase()).toContain('httponly');
      expect(setCookie.toLowerCase()).toContain('samesite=strict');
    });

    it('returns 401 AUTHENTICATION_ERROR for wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME, password: 'wrong-password' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('returns 401 AUTHENTICATION_ERROR for unknown username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'nobody', password: TEST_PASSWORD },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('returns 422 for missing body fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/auth/me
  // ---------------------------------------------------------------------------

  describe('GET /api/v1/auth/me', () => {
    it('returns user object with valid JWT cookie', async () => {
      // Login first to get cookie
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });
      const cookie = loginRes.headers['set-cookie'] as string;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(TEST_USER_ID);
      expect(body.username).toBe(TEST_USERNAME);
    });

    it('returns 401 without JWT cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/auth/logout
  // ---------------------------------------------------------------------------

  describe('POST /api/v1/auth/logout', () => {
    it('returns 204 and clears token cookie', async () => {
      // Login first
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });
      const cookie = loginRes.headers['set-cookie'] as string;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(204);
      const setCookie = response.headers['set-cookie'] as string;
      // Cookie should be cleared (maxAge=0 or expires in the past)
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('token=;');
    });

    it('returns 401 without JWT cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Global auth middleware
  // ---------------------------------------------------------------------------

  describe('Global auth middleware', () => {
    it('GET /api/v1/health is public (no JWT needed)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('returns 401 on a protected route without JWT', async () => {
      // /api/v1/auth/me is protected and requires a JWT
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });
});
