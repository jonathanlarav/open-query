'use client';

import Link from 'next/link';
import { Database } from 'lucide-react';
import { useConnections, useDeleteConnection, useTestConnection } from '@/hooks/useConnections';
import { useAnalysis } from '@/hooks/useAnalysis';
import { ConnectionBadge } from '@/components/shared/ConnectionBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { parseApiError } from '@/lib/parse-api-error';
import { formatDistanceToNow } from 'date-fns';
import type { Connection, ConnectionType } from '@open-query/shared';
import { useState } from 'react';

function AnalysisStatusBadge({ connectionId }: { connectionId: string }) {
  const { data: job } = useAnalysis(connectionId);
  if (!job) return null;

  if (job.status === 'completed') {
    return (
      <span className="text-label text-[var(--color-success)]">Ready ✓</span>
    );
  }
  if (job.status === 'failed') {
    return (
      <span className="text-label text-[var(--color-error)]">Analysis failed</span>
    );
  }
  return (
    <span className="text-label text-[var(--color-text-muted)]">
      Analyzing {job.progressPercent}%
    </span>
  );
}

function ConnectionRow({ conn }: { conn: Connection }) {
  const { mutate: deleteConn } = useDeleteConnection();
  const { mutate: testConn } = useTestConnection();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = () => {
    setTestingId(conn.id);
    testConn(conn.id, {
      onSuccess: () => {
        setTestResult('success');
        setTestError(null);
        setTestingId(null);
      },
      onError: (err) => {
        setTestResult('error');
        setTestError(parseApiError(err).message);
        setTestingId(null);
      },
    });
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-4 bg-white flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <Database className="w-4 h-4 text-[var(--color-text-muted)]" />
        </div>
        <div>
          <p className="font-medium text-sm text-[var(--color-text-primary)]">{conn.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <ConnectionBadge type={conn.type as ConnectionType} />
            {conn.lastConnectedAt && (
              <span className="text-label text-[var(--color-text-muted)]">
                Connected {formatDistanceToNow(new Date(conn.lastConnectedAt))} ago
              </span>
            )}
            <AnalysisStatusBadge connectionId={conn.id} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {testResult === 'success' && (
          <span className="text-label text-[var(--color-success)]">✓ Connected</span>
        )}
        {testResult === 'error' && (
          <span
            className="text-label text-[var(--color-error)] max-w-[180px] truncate"
            title={testError ?? 'Connection failed'}
          >
            ✕ {testError ?? 'Connection failed'}
          </span>
        )}
        <button
          onClick={handleTest}
          disabled={testingId === conn.id}
          className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] disabled:opacity-50"
        >
          {testingId === conn.id ? 'Testing…' : 'Test'}
        </button>
        <Link
          href={`/connections/${conn.id}/knowledge`}
          className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
        >
          Knowledge
        </Link>
        <Link
          href={`/connections/${conn.id}/edit`}
          className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
        >
          Edit
        </Link>
        <button
          onClick={() => {
            if (confirm(`Delete connection "${conn.name}"?`)) {
              deleteConn(conn.id);
            }
          }}
          className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md text-[var(--color-error)] hover:bg-red-50"
        >
          Delete
        </button>
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
          <div key={i} className="h-20 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]" />
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
    <div className="space-y-3">
      {connections.map((conn) => (
        <ConnectionRow key={conn.id} conn={conn} />
      ))}
    </div>
  );
}
