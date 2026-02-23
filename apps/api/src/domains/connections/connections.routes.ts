import type { FastifyInstance } from 'fastify';
import { ConnectionsService } from './connections.service.js';
import { CreateConnectionSchema, UpdateConnectionSchema } from './connections.schemas.js';
import { getDb } from '@open-query/db';

export async function connectionsRoutes(fastify: FastifyInstance): Promise<void> {
  const getService = () => new ConnectionsService(getDb());

  // GET /api/v1/connections
  fastify.get('/', async (_req, reply) => {
    const connections = getService().list();
    return reply.send({ data: connections });
  });

  // POST /api/v1/connections
  fastify.post('/', async (req, reply) => {
    const body = CreateConnectionSchema.parse(req.body);
    const connection = getService().create(body);
    return reply.status(201).send({ data: connection });
  });

  // GET /api/v1/connections/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const connection = getService().getById(req.params.id);
    return reply.send({ data: connection });
  });

  // PUT /api/v1/connections/:id
  fastify.put<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const body = UpdateConnectionSchema.parse(req.body);
    const connection = getService().update(req.params.id, body);
    return reply.send({ data: connection });
  });

  // DELETE /api/v1/connections/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    getService().delete(req.params.id);
    return reply.status(204).send();
  });

  // GET /api/v1/connections/:id/credentials  (decrypted, for edit form)
  fastify.get<{ Params: { id: string } }>('/:id/credentials', async (req, reply) => {
    const credentials = getService().getCredentials(req.params.id);
    return reply.send({ data: credentials });
  });

  // POST /api/v1/connections/:id/test  (no request body)
  fastify.post<{ Params: { id: string } }>('/:id/test', async (req, reply) => {
    await getService().testConnection(req.params.id);
    return reply.send({ data: { success: true } });
  });

  // POST /api/v1/connections/test-credentials  (test without saving)
  fastify.post('/test-credentials', async (req, reply) => {
    const body = CreateConnectionSchema.parse(req.body);
    await getService().testRawCredentials(body);
    return reply.send({ data: { success: true } });
  });
}
