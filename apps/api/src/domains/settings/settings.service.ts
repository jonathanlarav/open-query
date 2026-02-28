import { z } from 'zod';
import { findSettings, upsertSettings } from '@open-query/db';
import type { Database } from '@open-query/db';
import { encrypt } from '../../infrastructure/crypto/encryption.js';
import { getLanguageModel } from '../../infrastructure/llm/provider-factory.js';
import { generateText } from 'ai';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';
import { LLMProviderSchema } from '@open-query/shared';

export const TestLLMSchema = z.object({
  provider: LLMProviderSchema.optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
});

export type TestLLMInput = z.infer<typeof TestLLMSchema>;

export const UpdateSettingsSchema = z.object({
  provider: LLMProviderSchema.optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().optional(), // plaintext, will be encrypted
  ollamaBaseUrl: z.string().url().optional(),
  maxTokens: z.number().int().min(256).max(32000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  chatHistoryLimit: z.number().int().min(1).max(500).optional(),
});

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

export class SettingsService {
  constructor(private readonly db: Database) {}

  getSettings() {
    const settings = findSettings(this.db);
    if (!settings) return this.getDefaults();
    // Never expose the encrypted key
    const { encryptedApiKey: _key, ...rest } = settings;
    return { ...rest, hasApiKey: Boolean(settings.encryptedApiKey) };
  }

  updateSettings(input: UpdateSettingsInput) {
    const encryptedApiKey =
      input.apiKey ? encrypt(input.apiKey) : undefined;

    upsertSettings(this.db, {
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(encryptedApiKey ? { encryptedApiKey } : {}),
      ...(input.ollamaBaseUrl ? { ollamaBaseUrl: input.ollamaBaseUrl } : {}),
      ...(input.maxTokens ? { maxTokens: input.maxTokens } : {}),
      ...(input.temperature !== undefined
        ? { temperature: Math.round(input.temperature * 100) }
        : {}),
      ...(input.chatHistoryLimit ? { chatHistoryLimit: input.chatHistoryLimit } : {}),
    });

    return this.getSettings();
  }

  async testLLM(overrides?: TestLLMInput): Promise<{ model: string; provider: string }> {
    const saved = findSettings(this.db);

    const provider = overrides?.provider ?? saved?.provider;
    const model = overrides?.model ?? saved?.model;
    const ollamaBaseUrl = overrides?.ollamaBaseUrl ?? saved?.ollamaBaseUrl ?? 'http://localhost:11434';

    if (!provider || !model) {
      throw new AppError({
        code: ErrorCode.LLM_ERROR,
        message: 'No LLM settings configured. Add a provider and API key first.',
        statusCode: 400,
      });
    }

    // Use the override plaintext key (encrypt it), else fall back to saved encrypted key
    const encryptedApiKey = overrides?.apiKey
      ? encrypt(overrides.apiKey)
      : (saved?.encryptedApiKey ?? null);

    const effectiveSettings = {
      id: 'singleton',
      provider,
      model,
      encryptedApiKey,
      ollamaBaseUrl,
      maxTokens: saved?.maxTokens ?? 4096,
      temperature: saved?.temperature ?? 0,
      chatHistoryLimit: saved?.chatHistoryLimit ?? 20,
      updatedAt: new Date(),
    };

    try {
      const languageModel = getLanguageModel(effectiveSettings);
      await generateText({ model: languageModel, prompt: 'Reply with the single word: ok', maxTokens: 5 });
      return { model, provider };
    } catch (err) {
      throw new AppError({
        code: ErrorCode.LLM_ERROR,
        message: err instanceof Error ? err.message : 'LLM connection test failed',
        statusCode: 400,
        cause: err,
      });
    }
  }

  private getDefaults() {
    return {
      id: 'singleton',
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-6',
      ollamaBaseUrl: 'http://localhost:11434',
      maxTokens: 4096,
      temperature: 0,
      chatHistoryLimit: 20,
      hasApiKey: false,
    };
  }
}
