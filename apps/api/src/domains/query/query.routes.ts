import type { FastifyInstance } from 'fastify';
import { QueryService } from './query.service.js';
import { ExecuteQueryInputSchema } from '@open-query/shared';
import { getDb } from '@open-query/db';

export async function queryRoutes(fastify: FastifyInstance): Promise<void> {
  const getService = () => new QueryService(getDb());

  // POST /api/v1/query
  fastify.post('/', async (req, reply) => {
    const body = ExecuteQueryInputSchema.parse(req.body);
    const result = await getService().executeQuery(body);
    return reply.send({ data: result });
  });
}
