'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Play, Trash2 } from 'lucide-react';
import { formatReportTime } from '@/lib/format-time';
import { usePinsBySession, useDeleteReport, type Report } from '@/hooks/useReports';
import { useChatSession } from '@/hooks/useChat';
import { useQueryExecution } from '@/hooks/useQueryExecution';
import { ResultsPanel } from '@/components/chat/ResultsPanel';
import type { QueryResult } from '@open-query/shared';

interface ReportDetailViewProps {
  sessionId: string;
}

export function ReportDetailView({ sessionId }: ReportDetailViewProps) {
  const { data: pins, isLoading } = usePinsBySession(sessionId);
  const { data: session } = useChatSession(sessionId);
  const { mutateAsync: executeQuery, isPending: isExecuting } = useQueryExecution();
  const { mutate: deletePin } = useDeleteReport();

  const [activeResult, setActiveResult] = useState<QueryResult | null>(null);
  const [activePin, setActivePin] = useState<Report | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const connectionId = session?.connectionId ?? '';

  const handleRun = async (pin: Report) => {
    setRunError(null);
    try {
      const result = await executeQuery({ sql: pin.sql, connectionId, limit: 1000 });
      setActiveResult(result);
      setActivePin(pin);
    } catch {
      setRunError('Failed to run query. Check the connection and try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-[var(--color-surface)] rounded" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]"
          />
        ))}
      </div>
    );
  }

  const pinsData: Report[] = pins ?? [];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <Link
                href="/reports"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-3"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Pins
              </Link>
              <h1 className="text-[1.875rem] font-semibold text-[var(--color-text-primary)]">
                {session?.title ?? 'Chat Session'}
              </h1>
              <p className="mt-1 text-body text-[var(--color-text-secondary)]">
                {pinsData.length} pinned {pinsData.length === 1 ? 'query' : 'queries'}
              </p>
            </div>
            {session && (
              <Link
                href={`/chat/${sessionId}`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Edit on Chat
              </Link>
            )}
          </div>

          {/* Run error */}
          {runError && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {runError}
            </div>
          )}

          {/* Pin cards */}
          <div className="space-y-4">
            {pinsData.map((pin) => (
              <div
                key={pin.id}
                className={`border rounded-lg p-4 bg-white transition-colors ${
                  activePin?.id === pin.id
                    ? 'border-[var(--brand-primary)]'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-[var(--color-text-primary)]">
                      {pin.title}
                    </h3>
                    {pin.description && (
                      <p className="text-label text-[var(--color-text-secondary)] mt-0.5">
                        {pin.description}
                      </p>
                    )}
                    <p className="text-label text-[var(--color-text-muted)] mt-1">
                      {formatReportTime(pin.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => void handleRun(pin)}
                      disabled={isExecuting}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      Run
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete pin "${pin.title}"?`)) {
                          deletePin(pin.id);
                          if (activePin?.id === pin.id) {
                            setActiveResult(null);
                            setActivePin(null);
                          }
                        }
                      }}
                      className="p-1.5 rounded hover:bg-red-50 text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                      title="Delete pin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <pre className="mt-3 text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-surface)] rounded px-2 py-1.5 truncate">
                  {pin.sql.slice(0, 120)}{pin.sql.length > 120 ? '…' : ''}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Results panel — no sessionId so no re-pin button */}
      {activeResult && connectionId && (
        <ResultsPanel
          result={activeResult}
          connectionId={connectionId}
          onClose={() => { setActiveResult(null); setActivePin(null); }}
        />
      )}
    </div>
  );
}
