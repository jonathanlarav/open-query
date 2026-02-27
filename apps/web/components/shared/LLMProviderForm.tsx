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

const MODEL_DEFAULTS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
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
              form.setValue('provider', e.target.value as FormValues['provider']);
              const model = MODEL_DEFAULTS[e.target.value];
              if (model) form.setValue('model', model);
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
          <input
            {...form.register('model')}
            placeholder="e.g. claude-sonnet-4-6"
            className="w-full max-w-2xl border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          />
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
            setTestStatus('testing');
            setTestMessage(null);
            testLLM(undefined, {
              onSuccess: (result) => {
                setTestStatus('success');
                setTestMessage(`Connected to ${result.model} via ${result.provider}`);
              },
              onError: (err) => {
                setTestStatus('error');
                setTestMessage(parseApiError(err).message);
              },
            });
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
