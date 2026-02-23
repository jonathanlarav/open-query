import { ApiError } from './api-client';

export interface ParsedError {
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

const ERROR_CODE_MAP: Record<string, Omit<ParsedError, 'message'> & { defaultMessage: string }> = {
  LLM_ERROR: {
    defaultMessage: 'LLM provider is not configured.',
    action: { label: 'Go to Settings', href: '/settings' },
  },
  CONNECTION_FAILED: {
    defaultMessage: 'Could not connect to the database.',
    action: { label: 'Edit Connection', href: '/connections' },
  },
  NOT_FOUND: {
    defaultMessage: 'The requested resource was not found.',
  },
  VALIDATION_ERROR: {
    defaultMessage: 'The request was invalid.',
  },
  READONLY_VIOLATION: {
    defaultMessage: 'Only SELECT queries are allowed.',
  },
  SCHEMA_SCAN_FAILED: {
    defaultMessage: 'Failed to scan the database schema.',
  },
  ENCRYPTION_ERROR: {
    defaultMessage: 'Credential encryption failed. Check your MASTER_KEY.',
  },
};

/**
 * Parses any thrown error (ApiError, streaming error string, or generic Error)
 * into a user-friendly message + optional CTA action.
 */
export function parseApiError(err: unknown): ParsedError {
  // Structured ApiError from our api-client
  if (err instanceof ApiError) {
    const mapping = ERROR_CODE_MAP[err.code];
    return {
      message: err.message || mapping?.defaultMessage || 'An unexpected error occurred.',
      action: mapping?.action,
    };
  }

  // Streaming errors — useChat serialises the response body as the error message
  if (err instanceof Error) {
    // Try to parse JSON from the error message (AI SDK streaming errors)
    try {
      const parsed = JSON.parse(err.message) as {
        error?: { code?: string; message?: string };
      };
      if (parsed.error) {
        const code = parsed.error.code ?? '';
        const mapping = ERROR_CODE_MAP[code];
        return {
          message: parsed.error.message || mapping?.defaultMessage || 'An unexpected error occurred.',
          action: mapping?.action,
        };
      }
    } catch {
      // Not JSON — use raw message
    }

    // Check message text for known patterns — including LLM provider errors
    const msg = err.message.toLowerCase();

    const isLLMError =
      msg.includes('api key') ||
      msg.includes('apikey') ||
      msg.includes('not configured') ||
      msg.includes('invalid key') ||
      msg.includes('unauthorized') ||
      msg.includes('authentication') ||
      msg.includes('quota') ||
      msg.includes('rate limit') ||
      msg.includes('billing') ||
      msg.includes('insufficient_quota') ||
      msg.includes('invalid_api_key') ||
      msg.includes('model not found') ||
      msg.includes('no such model') ||
      msg.includes('does not exist') ||
      msg.includes('llm') ||
      msg.includes('provider') ||
      msg.includes('openai') ||
      msg.includes('anthropic') ||
      msg.includes('ollama');

    if (isLLMError) {
      return {
        message: err.message,
        action: { label: 'Go to Settings', href: '/settings' },
      };
    }

    if (msg.includes('connection') && (msg.includes('fail') || msg.includes('refused') || msg.includes('timeout'))) {
      return {
        message: err.message,
        action: { label: 'Manage Connections', href: '/connections' },
      };
    }

    return { message: err.message || 'An unexpected error occurred.' };
  }

  return { message: 'An unexpected error occurred.' };
}
