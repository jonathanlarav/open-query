import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider';
import type { LanguageModel } from 'ai';
import { decrypt } from '../crypto/encryption.js';
import type { SelectLLMSettings } from '@open-query/db';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

export function getLanguageModel(settings: SelectLLMSettings): LanguageModel {
  switch (settings.provider) {
    case 'anthropic': {
      if (!settings.encryptedApiKey) {
        throw new AppError({
          code: ErrorCode.LLM_ERROR,
          message: 'Anthropic API key is not configured',
          statusCode: 400,
        });
      }
      const apiKey = decrypt(settings.encryptedApiKey);
      return createAnthropic({ apiKey })(settings.model) as unknown as LanguageModel;
    }

    case 'openai': {
      if (!settings.encryptedApiKey) {
        throw new AppError({
          code: ErrorCode.LLM_ERROR,
          message: 'OpenAI API key is not configured',
          statusCode: 400,
        });
      }
      const apiKey = decrypt(settings.encryptedApiKey);
      return createOpenAI({ apiKey })(settings.model) as unknown as LanguageModel;
    }

    case 'google': {
      if (!settings.encryptedApiKey) {
        throw new AppError({
          code: ErrorCode.LLM_ERROR,
          message: 'Google API key is not configured',
          statusCode: 400,
        });
      }
      const apiKey = decrypt(settings.encryptedApiKey);
      return createGoogleGenerativeAI({ apiKey })(settings.model) as unknown as LanguageModel;
    }

    case 'ollama': {
      const baseURL = settings.ollamaBaseUrl ?? 'http://localhost:11434';
      const ollamaProvider = createOllama({ baseURL });
      return ollamaProvider(settings.model) as unknown as LanguageModel;
    }

    default:
      throw new AppError({
        code: ErrorCode.LLM_ERROR,
        message: `Unsupported LLM provider: ${String(settings.provider)}`,
        statusCode: 400,
      });
  }
}
