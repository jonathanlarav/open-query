import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ChatService } from './chat.service.js';
import { CreateChatSessionSchema } from '@open-query/shared';
import { getDb } from '@open-query/db';

// Shape that useChat sends: full message history + our extra body fields
const StreamChatSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  sessionId: z.string(),
  connectionId: z.string(),
});

export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  const getService = () => new ChatService(getDb());

  // GET /api/v1/chat/sessions
  fastify.get('/sessions', async (_req, reply) => {
    const sessions = getService().listSessionsSummary();
    return reply.send({ data: sessions });
  });

  // DELETE /api/v1/chat/sessions/:id
  fastify.delete<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    getService().deleteSession(req.params.id);
    return reply.status(204).send();
  });

  // POST /api/v1/chat/sessions
  fastify.post('/sessions', async (req, reply) => {
    const body = CreateChatSessionSchema.parse(req.body);
    const session = getService().createSession(body);
    return reply.status(201).send({ data: session });
  });

  // GET /api/v1/chat/sessions/:id
  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const session = getService().getSession(req.params.id);
    return reply.send({ data: session });
  });

  // PUT /api/v1/chat/sessions/:id
  fastify.put<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const { title } = z.object({ title: z.string().min(1).max(200) }).parse(req.body);
    getService().renameSession(req.params.id, title);
    return reply.status(204).send();
  });

  // GET /api/v1/chat/sessions/:id/messages
  fastify.get<{ Params: { id: string } }>(
    '/sessions/:id/messages',
    async (req, reply) => {
      const messages = getService().getMessages(req.params.id);
      return reply.send({ data: messages });
    }
  );

  // POST /api/v1/chat — streaming endpoint (Vercel AI SDK useChat format)
  fastify.post('/', async (req, reply) => {
    const body = StreamChatSchema.parse(req.body);
    const service = getService();
    const streamResult = await service.streamChat(body);

    // Pipe Vercel AI SDK stream to Fastify response
    // Forward real LLM errors instead of the SDK's generic "An error occurred."
    const response = streamResult.toDataStreamResponse({
      getErrorMessage: (error) => {
        if (error instanceof Error) return error.message;
        return String(error);
      },
    });
    const reader = response.body?.getReader();

    if (!reader) {
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Stream unavailable' } });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Transfer-Encoding', 'chunked');

    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(decoder.decode(value));
      }
    } finally {
      reply.raw.end();
    }
  });
}
