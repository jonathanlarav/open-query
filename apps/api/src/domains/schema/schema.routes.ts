import type { FastifyInstance } from 'fastify';
import { SchemaService } from './schema.service.js';
import { getDb } from '@open-query/db';

export async function schemaRoutes(fastify: FastifyInstance): Promise<void> {
  const getService = () => new SchemaService(getDb());

  // GET /api/v1/schema/:connectionId
  fastify.get<{ Params: { connectionId: string } }>(
    '/:connectionId',
    async (req, reply) => {
      const snapshot = getService().getSnapshot(req.params.connectionId);
      return reply.send({ data: snapshot });
    }
  );

  // POST /api/v1/schema/:connectionId/scan
  fastify.post<{ Params: { connectionId: string } }>(
    '/:connectionId/scan',
    async (req, reply) => {
      const result = await getService().scan(req.params.connectionId);
      return reply.status(202).send({ data: result });
    }
  );
}
