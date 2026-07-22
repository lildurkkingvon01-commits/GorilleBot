/**
 * Error handling middleware
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';
import { ZodError } from 'zod';
import { AppError, ErrorCodes } from '@/utils/errors';
import { ApiError } from '@/types';

export const setupErrorHandler = (fastify: FastifyInstance) => {
  fastify.setErrorHandler(async (error: any, request, reply) => {
    console.error('Error:', {
      url: request.url,
      method: request.method,
      error: error.message,
      stack: error.stack,
    });

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: ErrorCodes.INVALID_PARAMS,
          message: 'Validation error',
          details: error.errors,
        },
      } as ApiError);
    }

    // Handle AppError
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      } as ApiError);
    }

    // Default error response
    return reply.status(500).send({
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
    } as ApiError);
  });
};

/**
 * CORS middleware setup
 */
export const setupCors = (fastify: FastifyInstance) => {
  fastify.register(fastifyCors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      process.env.WEB_URL || 'http://localhost:3000',
    ],
    credentials: true,
  });
};

/**
 * Request logging middleware
 */
export const setupRequestLogging = (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request, reply) => {
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  });
};

/**
 * Response timing middleware
 */
export const setupResponseTiming = (fastify: FastifyInstance) => {
  fastify.addHook('onResponse', async (request, reply) => {
    const duration = reply.getResponseTime();
    console.log(
      `[${new Date().toISOString()}] ${request.method} ${request.url} - ${reply.statusCode} (${duration.toFixed(2)}ms)`
    );
  });
};

/**
 * Request validation middleware factory
 */
export const validateQuery = (schema: any) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = await schema.parseAsync(request.query);
      (request as any).validatedQuery = validated;
    } catch (error: any) {
      reply.status(400).send({
        error: {
          code: ErrorCodes.INVALID_PARAMS,
          message: 'Invalid query parameters',
          details: error.errors || error.message,
        },
      });
    }
  };
};

/**
 * Request validation middleware factory
 */
export const validateParams = (schema: any) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = await schema.parseAsync(request.params);
      (request as any).validatedParams = validated;
    } catch (error: any) {
      reply.status(400).send({
        error: {
          code: ErrorCodes.INVALID_PARAMS,
          message: 'Invalid parameters',
          details: error.errors || error.message,
        },
      });
    }
  };
};

/**
 * Request body validation middleware factory
 */
export const validateBody = (schema: any) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = await schema.parseAsync(request.body);
      (request as any).validatedBody = validated;
    } catch (error: any) {
      reply.status(400).send({
        error: {
          code: ErrorCodes.INVALID_PARAMS,
          message: 'Invalid request body',
          details: error.errors || error.message,
        },
      });
    }
  };
};
