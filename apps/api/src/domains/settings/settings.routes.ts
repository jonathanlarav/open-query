import type { FastifyInstance } from 'fastify';
import { SettingsService, UpdateSettingsSchema, TestLLMSchema } from './settings.service.js';
import { getDb } from '@open-query/db';

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  const getService = () => new SettingsService(getDb());

  // GET /api/v1/settings
  fastify.get('/', async (_req, reply) => {
    const settings = getService().getSettings();
    return reply.send({ data: settings });
  });

  // PUT /api/v1/settings
  fastify.put('/', async (req, reply) => {
    const body = UpdateSettingsSchema.parse(req.body);
    const settings = getService().updateSettings(body);
    return reply.send({ data: settings });
  });

  // POST /api/v1/settings/test
  // Accepts optional body to test unsaved form values before saving
  fastify.post('/test', async (req, reply) => {
    const overrides = req.body ? TestLLMSchema.parse(req.body) : undefined;
    const result = await getService().testLLM(overrides);
    return reply.send({ data: result });
  });
}
