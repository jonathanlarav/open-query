'use client';

import Link from 'next/link';
import { Database, BookOpen, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useConnections, useDeleteConnection, useTestConnection } from '@/hooks/useConnections';
import { useAnalysis, useTriggerAnalysis, useRetriggerAnalysis } from '@/hooks/useAnalysis';
import { ConnectionBadge } from '@/components/shared/ConnectionBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { parseApiError } from '@/lib/parse-api-error';
import { formatDistanceToNow } from 'date-fns';
import type { Connection, ConnectionType } from '@open-query/shared';
import { useState } from 'react';

function AnalysisRow({ connectionId }: { connectionId: string }) {
  const { data: job } = useAnalysis(connectionId);
  const { mutate: trigger, isPending: triggering } = useTriggerAnalysis();
  const { mutate: retrigger, isPending: retriggering } = useRetriggerAnalysis();

  const isRunning = job?.status === 'pending' || job?.status === 'running';
  const isBusy = isRunning || triggering || retriggering;

  const handleReanalyze = () => {
    if (job) retrigger(connectionId);
    else trigger(connectionId);
  };

  let statusLabel: React.ReactNode;
  if (!job) statusLabel = <span className="text-[var(--color-text-muted)]">Not yet analyzed</span>;
  else if (isRunning) statusLabel = <span className="text-[var(--color-text-muted)]">Analyzing… {job.progressPercent ?? 0}%</span>;
  else if (job.status === 'completed') statusLabel = <span className="text-[var(--color-success)]">Ready ✓</span>;
  else if (job.status === 'failed') statusLabel = <span className="text-[var(--color-error)]">Failed — context may be incomplete</span>;

  return (
    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[var(--color-border)]">
      <div className="flex items-center gap-1.5">
        <RefreshCw className={`w-3 h-3 text-[var(--color-text-muted)] shrink-0 ${isBusy ? 'animate-spin' : ''}`} />
        <span className="text-xs">
          <span className="text-[var(--color-text-muted)] mr-1">Schema analysis</span>
          {statusLabel}
        </span>
      </div>
      <button
        onClick={handleReanalyze}
        disabled={isBusy}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary-light)] transition-colors disabled:opacity-40"
      >
        {isBusy ? 'Running…' : job ? 'Re-run' : 'Run Analysis'}
      </button>
    </div>
  );
}

function ConnectionCard({ conn }: { conn: Connection }) {
  const { mutate: deleteConn } = useDeleteConnection();
  const { mutate: testConn } = useTestConnection();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    testConn(conn.id, {
      onSuccess: () => { setTestResult('success'); setTestError(null); setTesting(false); },
      onError: (err) => { setTestResult('error'); setTestError(parseApiError(err).message); setTesting(false); },
    });
  };

  const handleDelete = () => {
    if (confirm(`Delete connection "${conn.name}"?`)) deleteConn(conn.id);
  };

  return (
    <div className="flex items-start gap-4 p-4 border border-[var(--color-border)] rounded-lg bg-white">
      {/* DB icon */}
      <div className="mt-0.5 w-9 h-9 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
        <Database className="w-4 h-4 text-[var(--color-text-muted)]" />
      </div>

      {/* Info — grows to fill space */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--color-text-primary)] leading-snug">
          {conn.name}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <ConnectionBadge type={conn.type as ConnectionType} />
          {conn.lastConnectedAt && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Connected {formatDistanceToNow(new Date(conn.lastConnectedAt))} ago
            </span>
          )}
        </div>
        {/* Inline test feedback — below badges, not beside buttons */}
        {testResult === 'success' && (
          <p className="mt-1.5 text-xs text-[var(--color-success)]">✓ Connection successful</p>
        )}
        {testResult === 'error' && (
          <p className="mt-1.5 text-xs text-[var(--color-error)]">
            ✕ {testError ?? 'Connection failed'}
          </p>
        )}
        <AnalysisRow connectionId={conn.id} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] disabled:opacity-50 transition-colors"
        >
          {testing ? 'Testing…' : 'Test'}
        </button>

        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/connections/${conn.id}/knowledge`}
              className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <BookOpen className="w-4 h-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">Knowledge base</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/connections/${conn.id}/edit`}
              className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">Edit</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function ConnectionList() {
  const { data, isLoading } = useConnections();
  const connections: Connection[] = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]" />
        ))}
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <EmptyState
        icon={<Database className="w-8 h-8" />}
        title="No connections yet"
        description="Add your first database connection to start exploring data."
        action={{ label: 'Add Connection', href: '/connections/new' }}
      />
    );
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="space-y-3">
        {connections.map((conn) => (
          <ConnectionCard key={conn.id} conn={conn} />
        ))}
      </div>
    </TooltipProvider>
  );
}
