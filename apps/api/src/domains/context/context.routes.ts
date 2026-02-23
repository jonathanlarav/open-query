import type { FastifyInstance } from 'fastify';
import { ContextService, UpdateContextSchema } from './context.service.js';
import { getDb } from '@open-query/db';

export async function contextRoutes(fastify: FastifyInstance): Promise<void> {
  const getService = () => new ContextService(getDb());

  // GET /api/v1/context/:connectionId
  fastify.get<{ Params: { connectionId: string } }>(
    '/:connectionId',
    async (req, reply) => {
      const context = getService().getContext(req.params.connectionId);
      return reply.send({ data: context });
    }
  );

  // PUT /api/v1/context/:connectionId
  fastify.put<{ Params: { connectionId: string } }>(
    '/:connectionId',
    async (req, reply) => {
      const body = UpdateContextSchema.parse(req.body);
      const context = getService().updateContext(req.params.connectionId, body);
      return reply.send({ data: context });
    }
  );

  // POST /api/v1/context/:connectionId/infer
  fastify.post<{ Params: { connectionId: string } }>(
    '/:connectionId/infer',
    async (req, reply) => {
      const context = await getService().inferContext(req.params.connectionId);
      return reply.send({ data: context });
    }
  );
}
