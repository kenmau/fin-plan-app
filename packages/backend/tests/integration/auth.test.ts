import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';
import { db } from '../../src/db/client';
import { users } from '../../src/db/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

const TEST_USERNAME = 'testuser_auth_fin36';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_DISPLAY_NAME = 'Test Auth User';

describe('Auth endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
    await db
      .insert(users)
      .values({ username: TEST_USERNAME, passwordHash, displayName: TEST_DISPLAY_NAME })
      .onConflictDoNothing();

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.username, TEST_USERNAME));
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/auth/login
  // ---------------------------------------------------------------------------

  describe('POST /api/v1/auth/login', () => {
    it('returns 200 with user object and sets httpOnly cookie on valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.username).toBe(TEST_USERNAME);
      expect(body.displayName).toBe(TEST_DISPLAY_NAME);

      const tokenCookie = response.cookies.find((c) => c.name === 'token');
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie?.httpOnly).toBe(true);
      expect(tokenCookie?.sameSite).toBe('Strict');
      expect(tokenCookie?.path).toBe('/');
    });

    it('returns 401 AUTHENTICATION_ERROR with wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME, password: 'wrongpassword' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('returns 401 AUTHENTICATION_ERROR with unknown username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'nonexistent_user_xyz', password: TEST_PASSWORD },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('returns 422 when required fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/auth/me
  // ---------------------------------------------------------------------------

  describe('GET /api/v1/auth/me', () => {
    it('returns 200 with user object when valid JWT cookie is present', async () => {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });
      const tokenCookie = loginResponse.cookies.find((c) => c.name === 'token');

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: { token: tokenCookie!.value },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.username).toBe(TEST_USERNAME);
      expect(body.displayName).toBe(TEST_DISPLAY_NAME);
    });

    it('returns 401 AUTHENTICATION_ERROR without JWT cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('returns 401 AUTHENTICATION_ERROR with invalid JWT cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: { token: 'invalid.jwt.token' },
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
    it('returns 204 and clears the token cookie', async () => {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });
      const tokenCookie = loginResponse.cookies.find((c) => c.name === 'token');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        cookies: { token: tokenCookie!.value },
      });

      expect(response.statusCode).toBe(204);
      const clearedCookie = response.cookies.find((c) => c.name === 'token');
      expect(clearedCookie?.value).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // Global auth guard
  // ---------------------------------------------------------------------------

  describe('Auth guard on protected routes', () => {
    it('returns 401 on an arbitrary protected route without JWT', async () => {
      // /api/v1/auth/logout is protected (not in PUBLIC_ROUTES)
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
