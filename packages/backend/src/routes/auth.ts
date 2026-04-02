import { FastifyPluginAsync } from 'fastify';
import type { LoginRequest, UserResponse } from '@finplan/shared';
import { verifyCredentials, getUserById } from '../services/auth';
import { config } from '../config';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

const userResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    displayName: { type: 'string' },
  },
  required: ['id', 'username', 'displayName'],
};

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/auth/login
  fastify.post<{ Body: LoginRequest }>(
    '/login',
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
      const user: UserResponse | null = await verifyCredentials(username, password);
      if (!user) {
        return reply.code(401).send({
          error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid credentials' },
        });
      }

      const token = fastify.jwt.sign(
        { sub: user.id, username: user.username },
        { expiresIn: config.jwt.expiresIn },
      );

      reply.setCookie(config.jwt.cookieName, token, {
        httpOnly: true,
        secure: config.node.env === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: THIRTY_DAYS_SECONDS,
      });

      return reply.code(200).send(user);
    },
  );

  // POST /api/v1/auth/logout
  fastify.post(
    '/logout',
    {
      schema: {
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (_request, reply) => {
      reply.clearCookie(config.jwt.cookieName, { path: '/' });
      return reply.code(204).send();
    },
  );

  // GET /api/v1/auth/me
  fastify.get(
    '/me',
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
      return reply.code(200).send(user);
    },
  );
};

export default authRoutes;
