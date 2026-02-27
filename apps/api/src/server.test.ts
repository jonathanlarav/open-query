import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';

// Set required env vars before buildServer() is called
process.env['MASTER_KEY'] = 'test-master-key-for-vitest-tests-32chars';
process.env['DATABASE_URL'] = ':memory:';

let fastify: FastifyInstance;
let createdConnectionId: string;

beforeAll(async () => {
  fastify = await buildServer();

  // Create a connection so we can test query execution
  const res = await fastify.inject({
    method: 'POST',
    url: '/api/v1/connections',
    payload: {
      name: 'Test SQLite',
      type: 'sqlite',
      credentials: { filePath: '/tmp/test.db' },
    },
  });
  const body = JSON.parse(res.body) as { data: { id: string } };
  createdConnectionId = body.data.id;
});

afterAll(async () => {
  await fastify.close();
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { status: string };
    expect(body.status).toBe('ok');
  });
});

describe('GET /api/v1/connections', () => {
  it('returns 200 with data array', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/v1/connections' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('POST /api/v1/connections', () => {
  it('returns 400 VALIDATION_ERROR for invalid body', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/v1/connections',
      payload: { name: '', type: 'invalid-type' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/query', () => {
  it('returns 400 READONLY_VIOLATION for DELETE statement', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/v1/query',
      payload: {
        sql: 'DELETE FROM users',
        connectionId: createdConnectionId,
        limit: 100,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('READONLY_VIOLATION');
  });
});
