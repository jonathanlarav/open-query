import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { initDatabase } from '@open-query/db';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root is 3 levels up from apps/api/src/
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');

/** Resolve file: URIs with relative paths against the project root */
function resolveDbUrl(url: string): string {
  if (url.startsWith('file:./') || url.startsWith('file:../')) {
    return `file:${resolve(PROJECT_ROOT, url.slice('file:'.length))}`;
  }
  return url;
}
import { initMasterKey } from './infrastructure/crypto/key-manager.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { connectionsRoutes } from './domains/connections/connections.routes.js';
import { schemaRoutes } from './domains/schema/schema.routes.js';
import { contextRoutes } from './domains/context/context.routes.js';
import { chatRoutes } from './domains/chat/chat.routes.js';
import { queryRoutes } from './domains/query/query.routes.js';
import { reportsRoutes } from './domains/reports/reports.routes.js';
import { settingsRoutes } from './domains/settings/settings.routes.js';
import { analysisRoutes } from './domains/analysis/analysis.routes.js';

// Fail fast if required env vars are missing
function validateEnvironment(): void {
  if (!process.env['MASTER_KEY']) {
    console.error('FATAL: MASTER_KEY environment variable is required');
    process.exit(1);
  }
}

async function buildServer() {
  validateEnvironment();
  initMasterKey(process.env['MASTER_KEY']!);

  const databaseUrl = resolveDbUrl(process.env['DATABASE_URL'] ?? 'file:./data/openquery.db');
  await initDatabase(databaseUrl);

  const fastify = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'info',
    },
  });

  // Plugins
  await fastify.register(cors, {
    origin: process.env['NODE_ENV'] === 'production' ? false : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Managed by Next.js in production
  });

  // Error handler
  fastify.setErrorHandler(errorHandler);

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // API routes
  const prefix = '/api/v1';
  await fastify.register(connectionsRoutes, { prefix: `${prefix}/connections` });
  await fastify.register(schemaRoutes, { prefix: `${prefix}/schema` });
  await fastify.register(contextRoutes, { prefix: `${prefix}/context` });
  await fastify.register(chatRoutes, { prefix: `${prefix}/chat` });
  await fastify.register(queryRoutes, { prefix: `${prefix}/query` });
  await fastify.register(reportsRoutes, { prefix: `${prefix}/reports` });
  await fastify.register(settingsRoutes, { prefix: `${prefix}/settings` });
  await fastify.register(analysisRoutes, { prefix: `${prefix}/analysis` });

  return fastify;
}

async function start() {
  const fastify = await buildServer();
  const port = parseInt(process.env['API_PORT'] ?? '3001', 10);

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.warn(`API server running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

void start();

export { buildServer };
