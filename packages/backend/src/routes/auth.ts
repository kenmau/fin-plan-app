import { FastifyPluginAsync } from 'fastify';
import { login, getUserById } from '../services/auth';
import type { LoginRequest, UserResponse } from '@finplan/shared';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const userResponseSchema = {
  type: 'object',
  required: ['id', 'username', 'displayName'],
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    displayName: { type: 'string' },
  },
};

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/auth/login
  fastify.post<{ Body: LoginRequest }>(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 1, maxLength: 50 },
            password: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
        response: {
          200: userResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { username, password } = request.body;

      let user: UserResponse;
      try {
        user = await login(username, password);
      } catch {
        return reply.code(401).send({
          error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid username or password' },
        });
      }

      const token = fastify.jwt.sign(
        { sub: user.id, username: user.username },
        { expiresIn: '30d' },
      );

      reply.setCookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: COOKIE_MAX_AGE_SECONDS,
      });

      return reply.code(200).send(user);
    },
  );

  // POST /api/v1/auth/logout
  fastify.post(
    '/auth/logout',
    {
      schema: {
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (_request, reply) => {
      reply.clearCookie('token', { path: '/' });
      return reply.code(204).send();
    },
  );

  // GET /api/v1/auth/me
  fastify.get(
    '/auth/me',
    {
      schema: {
        response: {
          200: userResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await getUserById(request.userId);
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTHENTICATION_ERROR', message: 'User not found' },
        });
      }
      return reply.send(user);
    },
  );
};

export default authRoutes;
