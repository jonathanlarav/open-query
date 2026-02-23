import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { isAppError } from '../errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

export function errorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  // Zod validation errors
  if (error instanceof ZodError) {
    void reply.status(400).send({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // Application errors
  if (isAppError(error)) {
    void reply.status(error.statusCode).send(error.toJSON());
    return;
  }

  // Fastify validation errors (from schema)
  if ('validation' in error && error.validation) {
    void reply.status(400).send({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: error.message,
      },
    });
    return;
  }

  // Unhandled errors
  console.error('[unhandled error]', error);
  void reply.status(500).send({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    },
  });
}
