import type { FastifyInstance } from 'fastify';
import { generateObject } from 'ai';
import { z } from 'zod';
import { ReportsService, CreateReportSchema } from './reports.service.js';
import { getDb, findSettings } from '@open-query/db';
import { getLanguageModel } from '../../infrastructure/llm/provider-factory.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

export async function reportsRoutes(fastify: FastifyInstance): Promise<void> {
  const getService = () => new ReportsService(getDb());

  // POST /api/v1/reports/suggest-pin
  fastify.post('/suggest-pin', async (req, reply) => {
    const { sql, userMessage } = z
      .object({ sql: z.string().min(1), userMessage: z.string().min(1) })
      .parse(req.body);

    const settings = findSettings(getDb());
    if (!settings) {
      throw new AppError({
        code: ErrorCode.LLM_ERROR,
        message: 'LLM settings not configured',
        statusCode: 400,
      });
    }

    const model = getLanguageModel(settings);
    const { object } = await generateObject({
      model,
      schema: z.object({
        title: z.string().describe('4–7 word noun phrase, no question words, no trailing punctuation'),
        description: z.string().describe('One sentence describing what the query answers'),
      }),
      prompt: [
        'Generate a pin title and description for a saved SQL query.',
        '',
        'Rules:',
        '- Title: 4–7 words, noun phrase, describes the query PURPOSE (e.g. "Revenue by product category"). No "can you", no question marks, no trailing punctuation.',
        '- Description: one sentence, slightly more detailed than the title, states what the query answers.',
        '',
        `User request: ${userMessage}`,
        `SQL: ${sql}`,
      ].join('\n'),
    });

    return reply.send({ data: object });
  });

  // GET /api/v1/reports/sessions
  fastify.get('/sessions', async (_req, reply) => {
    const sessions = getService().listSessionsWithPins();
    return reply.send({ data: sessions });
  });

  // GET /api/v1/reports/sessions/:sessionId
  fastify.get<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId',
    async (req, reply) => {
      const pins = getService().listBySession(req.params.sessionId);
      return reply.send({ data: pins });
    }
  );

  // DELETE /api/v1/reports/sessions/:sessionId — delete all pins for a session
  fastify.delete<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId',
    async (req, reply) => {
      getService().deleteBySession(req.params.sessionId);
      return reply.status(204).send();
    }
  );

  // GET /api/v1/reports
  fastify.get<{ Querystring: { connectionId?: string } }>('/', async (req, reply) => {
    const reports = getService().list(req.query.connectionId);
    return reply.send({ data: reports });
  });

  // POST /api/v1/reports
  fastify.post('/', async (req, reply) => {
    const body = CreateReportSchema.parse(req.body);
    const report = getService().create(body);
    return reply.status(201).send({ data: report });
  });

  // GET /api/v1/reports/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const report = getService().getById(req.params.id);
    return reply.send({ data: report });
  });

  // DELETE /api/v1/reports/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    getService().delete(req.params.id);
    return reply.status(204).send();
  });

  // GET /api/v1/reports/:id/export
  fastify.get<{
    Params: { id: string };
    Querystring: { format?: 'csv' | 'json' };
  }>('/:id/export', async (req, reply) => {
    const report = getService().getById(req.params.id);
    const format = req.query.format ?? 'csv';

    if (format === 'json') {
      return reply
        .header('Content-Disposition', `attachment; filename="${report.title}.json"`)
        .header('Content-Type', 'application/json')
        .send(JSON.stringify({ report }, null, 2));
    }

    // CSV export with the report metadata as header comment
    const csvContent = `# Report: ${report.title}\n# SQL: ${report.sql}\n`;
    return reply
      .header('Content-Disposition', `attachment; filename="${report.title}.csv"`)
      .header('Content-Type', 'text/csv')
      .send(csvContent);
  });
}
