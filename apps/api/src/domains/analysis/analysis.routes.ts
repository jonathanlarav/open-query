import type { FastifyInstance } from 'fastify';
import { AnalysisService } from './analysis.service.js';
import { getDb } from '@open-query/db';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

export async function analysisRoutes(fastify: FastifyInstance): Promise<void> {
  const getService = () => new AnalysisService(getDb());

  // GET /api/v1/analysis/:connectionId/status
  fastify.get<{ Params: { connectionId: string } }>(
    '/:connectionId/status',
    async (req, reply) => {
      const job = getService().getJobStatus(req.params.connectionId);
      return reply.send({ data: job });
    }
  );

  // POST /api/v1/analysis/:connectionId/trigger
  fastify.post<{ Params: { connectionId: string } }>(
    '/:connectionId/trigger',
    async (req, reply) => {
      const existing = getService().getJobStatus(req.params.connectionId);
      if (existing?.status === 'running' || existing?.status === 'pending') {
        throw new AppError({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Analysis is already in progress. Use /retrigger to restart.',
          statusCode: 409,
        });
      }
      const job = getService().triggerAnalysis(req.params.connectionId);
      return reply.status(202).send({ data: job });
    }
  );

  // POST /api/v1/analysis/:connectionId/retrigger
  fastify.post<{ Params: { connectionId: string } }>(
    '/:connectionId/retrigger',
    async (req, reply) => {
      const job = getService().retriggerAnalysis(req.params.connectionId);
      return reply.status(202).send({ data: job });
    }
  );
}
