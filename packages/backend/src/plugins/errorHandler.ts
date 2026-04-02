import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyError } from 'fastify';

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.validation.map((v) => ({
            field: v.instancePath || v.params?.missingProperty || 'unknown',
            issue: v.message ?? 'Invalid value',
          })),
        },
      });
    }

    const statusCode = error.statusCode ?? 500;

    if (statusCode === 401) {
      return reply.code(401).send({
        error: { code: 'AUTHENTICATION_ERROR', message: error.message || 'Unauthorized' },
      });
    }

    if (statusCode === 404) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: error.message || 'Not found' },
      });
    }

    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });
};

export default fp(errorHandlerPlugin, { name: 'errorHandler' });
