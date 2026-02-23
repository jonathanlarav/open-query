'use client';

import { useState } from 'react';
import { X, Pin, Loader2 } from 'lucide-react';
import type { QueryResult } from '@open-query/shared';
import { QueryResultsTable } from './QueryResultsTable';
import { ChartBuilder } from '@/components/charts/ChartBuilder';
import { PinDialog } from '@/components/reports/PinDialog';
import { apiClient } from '@/lib/api-client';

interface ResultsPanelProps {
  result: QueryResult;
  connectionId: string;
  onClose: () => void;
  query?: string;
  sessionId?: string;
  lastUserMessage?: string;
}

type ViewMode = 'table' | 'chart';

interface PinSuggestion {
  title: string;
  description: string;
}

export function ResultsPanel({
  result,
  connectionId,
  onClose,
  query,
  sessionId,
  lastUserMessage,
}: ResultsPanelProps) {
  const [view, setView] = useState<ViewMode>('table');
  const [pinSuggestion, setPinSuggestion] = useState<PinSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const handlePinClick = async () => {
    if (!query || !lastUserMessage) {
      setPinSuggestion({ title: '', description: '' });
      return;
    }
    setSuggesting(true);
    try {
      const suggestion = await apiClient.post<PinSuggestion>('/reports/suggest-pin', {
        sql: query,
        userMessage: lastUserMessage,
      });
      setPinSuggestion(suggestion);
    } catch {
      // Open dialog with empty fields if suggestion fails
      setPinSuggestion({ title: '', description: '' });
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <>
      <div className="border-t border-[var(--color-border)] bg-[var(--color-background)] h-80 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-4">
            <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
              {(['table', 'chart'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={`px-3 py-1 text-sm capitalize transition-colors ${
                    view === mode
                      ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <span className="text-label text-[var(--color-text-muted)] tabular-nums">
              {result.rowCount.toLocaleString()} rows · {result.executionTimeMs}ms
            </span>
          </div>
          <div className="flex items-center gap-1">
            {sessionId && query && (
              <button
                onClick={() => void handlePinClick()}
                disabled={suggesting}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--brand-primary)] disabled:opacity-60 disabled:cursor-not-allowed"
                title="Pin"
              >
                {suggesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Pin className="w-3.5 h-3.5" />
                )}
                {suggesting ? 'Generating…' : 'Pin'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'table' ? (
            <QueryResultsTable result={result} />
          ) : (
            <ChartBuilder result={result} connectionId={connectionId} />
          )}
        </div>
      </div>

      {pinSuggestion && sessionId && query && (
        <PinDialog
          connectionId={connectionId}
          sessionId={sessionId}
          sql={query}
          initialTitle={pinSuggestion.title}
          initialDescription={pinSuggestion.description}
          onClose={() => setPinSuggestion(null)}
        />
      )}
    </>
  );
}
