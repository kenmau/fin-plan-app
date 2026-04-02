/**
 * Fastify app factory — exported for testing with supertest.
 */

import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import authPlugin from './plugins/auth';
import errorHandlerPlugin from './plugins/errorHandler';
import healthRoutes from './routes/health';
import { config } from './config';

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

  // Routes
  await app.register(healthRoutes, { prefix: '/api/v1' });

  return app;
}
