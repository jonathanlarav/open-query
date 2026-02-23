import { z } from 'zod';

export const ConnectionTypeSchema = z.enum(['postgres', 'mysql', 'sqlite', 'mongodb']);

export type ConnectionType = z.infer<typeof ConnectionTypeSchema>;

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL / MariaDB',
  sqlite: 'SQLite',
  mongodb: 'MongoDB',
};

export const LLMProviderSchema = z.enum(['anthropic', 'openai', 'ollama']);

export type LLMProvider = z.infer<typeof LLMProviderSchema>;

export const LLM_PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  ollama: 'Ollama (local)',
};
