'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useConnections } from '@/hooks/useConnections';

export function NoLLMBanner() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: connections, isLoading: connectionsLoading } = useConnections();

  if (settingsLoading || connectionsLoading) return null;
  if (!connections?.length) return null;
  if (settings?.hasApiKey) return null;

  return (
    <div className="flex items-start gap-3 p-4 mb-6 rounded-lg border border-amber-200 bg-amber-50">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">No AI model configured</p>
        <p className="text-sm text-amber-700 mt-0.5">
          Add an API key to unlock AI-generated descriptions in your knowledge base and enable the chat feature.
          After adding a key, re-run analysis on your connections to apply it.
        </p>
        <Link
          href="/settings?tab=llm"
          className="inline-block mt-2 text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
        >
          Configure AI Model →
        </Link>
      </div>
    </div>
  );
}
