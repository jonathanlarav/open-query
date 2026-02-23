'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';

const FormSchema = z.object({
  chatHistoryLimit: z.number().int().min(1).max(500),
});

type FormValues = z.infer<typeof FormSchema>;

export function GeneralSettingsForm() {
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSettings, isPending, isSuccess } = useUpdateSettings();
  const initialized = React.useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { chatHistoryLimit: 20 },
  });

  React.useEffect(() => {
    if (settings && !initialized.current) {
      form.reset({ chatHistoryLimit: settings.chatHistoryLimit });
      initialized.current = true;
    }
  }, [settings, form]);

  const onSubmit = (values: FormValues) => updateSettings(values);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-[var(--color-surface)] rounded-lg" />
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="border border-[var(--color-border)] rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-[var(--color-text-primary)]">Chat</h3>

        <div>
          <label className="text-label font-medium text-[var(--color-text-primary)] block mb-1.5">
            Chat History Limit
          </label>
          <input
            {...form.register('chatHistoryLimit', { valueAsNumber: true })}
            type="number"
            min={1}
            max={500}
            className="w-32 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[var(--brand-primary)]"
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Number of past messages loaded when resuming a conversation
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        {isSuccess && (
          <span className="text-sm text-[var(--color-success)]">Saved</span>
        )}
      </div>
    </form>
  );
}
