import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}

// Routes that do not require authentication
const PUBLIC_ROUTES = new Set([
  'POST /api/v1/auth/login',
  'GET /api/v1/health',
]);

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJwt, {
    secret: config.jwt.secret,
    cookie: {
      cookieName: config.jwt.cookieName,
      signed: false,
    },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as { sub: string };
      request.userId = payload.sub;
    } catch {
      reply.code(401).send({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
    }
  });

  fastify.addHook('onRequest', async (request, reply) => {
    const urlWithoutQuery = request.url.split('?')[0];
    const routeKey = `${request.method} ${urlWithoutQuery}`;
    if (PUBLIC_ROUTES.has(routeKey)) return;
    await fastify.authenticate(request, reply);
  });
};

export default fp(authPlugin, { name: 'auth' });
