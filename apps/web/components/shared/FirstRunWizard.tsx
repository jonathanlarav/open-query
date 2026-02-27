'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useSettings } from '@/hooks/useSettings';
import { LLMProviderForm } from './LLMProviderForm';

export function FirstRunWizard() {
  const [open, setOpen] = React.useState(false);
  const { data: settings, isLoading } = useSettings();

  // Only show in Electron and only when no LLM provider is configured
  React.useEffect(() => {
    if (!isLoading && typeof window !== 'undefined' && window.electronAPI) {
      const hasProvider = settings?.hasApiKey || settings?.provider === 'ollama';
      if (!hasProvider) {
        setOpen(true);
      }
    }
  }, [isLoading, settings]);

  if (!open) return null;

  async function handleComplete() {
    await window.electronAPI?.markFirstRunComplete();
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={() => void 0}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Welcome to Open Query
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--color-text-secondary)] mb-6">
            Configure your LLM provider to start using natural-language queries.
          </Dialog.Description>
          <LLMProviderForm onSaveSuccess={handleComplete} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
