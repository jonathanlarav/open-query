'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSettings, useUpdateSettings, useTestLLM } from '@/hooks/useSettings';
import { parseApiError } from '@/lib/parse-api-error';
import { LLMProviderSchema, LLM_PROVIDER_LABELS } from '@open-query/shared';

const FormSchema = z.object({
  provider: LLMProviderSchema,
  model: z.string().min(1),
  apiKey: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
  maxTokens: z.number().int().min(256).max(32000),
  temperature: z.number().min(0).max(2),
});

type FormValues = z.infer<typeof FormSchema>;

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'o1', label: 'o1' },
    { value: 'o3-mini', label: 'o3-mini' },
  ],
  google: [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (Recommended)' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  ollama: [
    { value: 'llama3.2', label: 'Llama 3.2 (Recommended)' },
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'codellama', label: 'Code Llama' },
    { value: 'deepseek-r1', label: 'DeepSeek R1' },
    { value: 'qwen2.5-coder', label: 'Qwen 2.5 Coder' },
    { value: 'phi3', label: 'Phi-3' },
  ],
};

const MODEL_DEFAULTS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  google: 'gemini-3.1-pro-preview',
  ollama: 'llama3.2',
};

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

interface LLMProviderFormProps {
  onSaveSuccess?: () => void | Promise<void>;
}

export function LLMProviderForm({ onSaveSuccess }: LLMProviderFormProps = {}) {
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSettings, isPending, isSuccess } = useUpdateSettings();
  const { mutate: testLLM } = useTestLLM();
  const [testStatus, setTestStatus] = React.useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = React.useState<string | null>(null);

  const initialized = React.useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      apiKey: '',
      ollamaBaseUrl: 'http://localhost:11434',
      maxTokens: 4096,
      temperature: 0,
    },
  });

  // Pre-fill once on first load — never again so typed API keys aren't wiped
  React.useEffect(() => {
    if (settings && !initialized.current) {
      form.reset({
        provider: settings.provider as FormValues['provider'],
        model: settings.model,
        apiKey: '',
        ollamaBaseUrl: settings.ollamaBaseUrl,
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
      });
      initialized.current = true;
    }
  }, [settings, form]);

  const provider = form.watch('provider');

  const onSubmit = (values: FormValues) => {
    updateSettings(
      {
        ...values,
        ...(values.apiKey ? { apiKey: values.apiKey } : {}),
      },
      { onSuccess: () => void onSaveSuccess?.() },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-[var(--color-surface)] rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="border border-[var(--color-border)] rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-[var(--color-text-primary)]">LLM Provider</h2>

        <div>
          <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
            Provider
          </label>
          <select
            {...form.register('provider')}
            onChange={(e) => {
              const newProvider = e.target.value as FormValues['provider'];
              form.setValue('provider', newProvider);
              form.setValue('model', MODEL_DEFAULTS[newProvider] ?? MODEL_OPTIONS[newProvider]?.[0]?.value ?? '');
            }}
            className="w-full max-w-2xl border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-white text-[var(--color-text-primary)] focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          >
            {Object.entries(LLM_PROVIDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
            Model
          </label>
          <select
            {...form.register('model')}
            className="w-full max-w-2xl border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-white text-[var(--color-text-primary)] focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          >
            {(MODEL_OPTIONS[provider] ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {provider !== 'ollama' && (
          <div>
            <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
              API Key {settings?.hasApiKey && <span className="text-[var(--color-success)] ml-1">✓ Saved</span>}
            </label>
            <input
              {...form.register('apiKey')}
              type="password"
              placeholder={settings?.hasApiKey ? '••••••••••••••• (leave blank to keep existing)' : 'sk-...'}
              className="w-full max-w-2xl border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
            />
          </div>
        )}

        {provider === 'ollama' && (
          <div>
            <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
              Ollama Base URL
            </label>
            <input
              {...form.register('ollamaBaseUrl')}
              placeholder="http://localhost:11434"
              className="w-full max-w-2xl border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
            />
          </div>
        )}

        <div className="pt-2">
          <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
            Max Tokens
          </label>
          <input
            {...form.register('maxTokens', { valueAsNumber: true })}
            type="number"
            min={256}
            max={32000}
            className="w-48 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          />
        </div>
      </div>

      {testStatus === 'success' && testMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
          <span className="text-sm text-green-700 font-medium">✓ {testMessage}</span>
        </div>
      )}
      {testStatus === 'error' && testMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-[var(--color-error)]">{testMessage}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {isPending ? 'Saving…' : 'Save Settings'}
        </button>
        <button
          type="button"
          disabled={testStatus === 'testing'}
          onClick={() => {
            const values = form.getValues();
            setTestStatus('testing');
            setTestMessage(null);
            testLLM(
              {
                provider: values.provider,
                model: values.model,
                apiKey: values.apiKey || undefined,
                ollamaBaseUrl: values.ollamaBaseUrl || undefined,
              },
              {
                onSuccess: (result) => {
                  setTestStatus('success');
                  setTestMessage(`Connected to ${result.model} via ${result.provider}`);
                },
                onError: (err) => {
                  setTestStatus('error');
                  setTestMessage(parseApiError(err).message);
                },
              },
            );
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] disabled:opacity-50"
        >
          {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
        </button>
        {isSuccess && (
          <span className="text-sm text-[var(--color-success)]">Settings saved</span>
        )}
      </div>
    </form>
  );
}
