/**
 * Fastify app factory — exported for testing with supertest.
 */

import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import authPlugin from './plugins/auth';
import errorHandlerPlugin from './plugins/errorHandler';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import { config } from './config';

// Routes that do NOT require a valid JWT
const PUBLIC_ROUTES: Array<{ method: string; url: string }> = [
  { method: 'POST', url: '/api/v1/auth/login' },
  { method: 'GET', url: '/api/v1/health' },
];

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.node.env !== 'test',
  });

  // CORS
  await app.register(fastifyCors, {
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // Plugins
  await app.register(authPlugin);
  await app.register(errorHandlerPlugin);

  // Global JWT auth — all routes except the public list require a valid token
  app.addHook('onRequest', async (request, reply) => {
    const isPublic = PUBLIC_ROUTES.some(
      (r) => r.method === request.method && r.url === request.url,
    );
    if (!isPublic) {
      try {
        await request.jwtVerify();
        const payload = request.user as { sub: string; username: string };
        request.userId = payload.sub;
      } catch {
        return reply.code(401).send({
          error: { code: 'AUTHENTICATION_ERROR', message: 'Authentication required' },
        });
      }
    }
  });

  // Routes
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });

  return app;
}
