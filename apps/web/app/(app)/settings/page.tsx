'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ConnectionList } from '@/components/connections/ConnectionList';
import { LLMProviderForm } from '@/components/shared/LLMProviderForm';
import { GeneralSettingsForm } from '@/components/shared/GeneralSettingsForm';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'general' as const, label: 'General' },
  { id: 'connections' as const, label: 'Connections' },
  { id: 'llm' as const, label: 'AI Model' },
];

type TabId = (typeof TABS)[number]['id'];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId | null) ?? 'general';
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some(t => t.id === initialTab) ? initialTab : 'general'
  );

  useEffect(() => {
    const tab = searchParams.get('tab') as TabId | null;
    if (tab && TABS.some(t => t.id === tab)) setActiveTab(tab);
  }, [searchParams]);

  return (
    <div className="flex flex-col h-full">
      {/* Header + horizontal tab bar */}
      <div className="border-b border-[var(--color-border)] px-8 pt-8 pb-0 shrink-0">
        <h1 className="text-[1.875rem] font-semibold text-[var(--color-text-primary)] mb-6">
          Settings
        </h1>
        <nav className="flex -mb-px">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]'
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'general' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">General</h2>
              <p className="mt-1 text-body text-[var(--color-text-secondary)]">
                Application preferences and defaults
              </p>
            </div>
            <GeneralSettingsForm />
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Connections</h2>
                <p className="mt-1 text-body text-[var(--color-text-secondary)]">
                  Connect to your databases to start exploring data
                </p>
              </div>
              <Link
                href="/connections/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                + New Connection
              </Link>
            </div>
            <ConnectionList />
          </div>
        )}

        {activeTab === 'llm' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">AI Model</h2>
              <p className="mt-1 text-body text-[var(--color-text-secondary)]">
                Configure your LLM provider and API keys
              </p>
            </div>
            <LLMProviderForm />
          </div>
        )}
      </div>
    </div>
  );
}
