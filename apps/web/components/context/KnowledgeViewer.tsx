'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchema } from '@/hooks/useSchema';
import { useAnalysis, useTriggerAnalysis, useRetriggerAnalysis } from '@/hooks/useAnalysis';
import type { TableInfo } from '@open-query/shared';

interface TableCtx {
  tableName: string;
  description: string | null;
  businessPurpose: string | null;
}

interface ColCtx {
  tableName: string;
  columnName: string;
  description: string | null;
  exampleValues: string | null;
  dataProfileJson: string | null;
}

interface ContextData {
  tableContexts: TableCtx[];
  columnContexts: ColCtx[];
}

interface ColProfile {
  sampleValues?: string[];
  distinctCount?: number | null;
  nullRate?: number | null;
  minValue?: string | null;
  maxValue?: string | null;
}

function ColumnRow({ col, ctx }: { col: TableInfo['columns'][0]; ctx?: ColCtx }) {
  let samples: string[] = [];
  let stats = '';

  if (ctx?.dataProfileJson) {
    try {
      const p = JSON.parse(ctx.dataProfileJson) as ColProfile;
      samples = p.sampleValues?.slice(0, 8) ?? [];
      const parts: string[] = [];
      if (p.distinctCount != null) parts.push(`${p.distinctCount} distinct`);
      if (p.nullRate != null) parts.push(`${(p.nullRate * 100).toFixed(1)}% null`);
      if (p.minValue != null) parts.push(`${p.minValue} – ${p.maxValue}`);
      stats = parts.join(' · ');
    } catch { /**/ }
  } else if (ctx?.exampleValues) {
    try { samples = JSON.parse(ctx.exampleValues) as string[]; } catch { /**/ }
  }

  return (
    <div className="flex items-start gap-3 py-2 border-t border-[var(--color-border)] first:border-t-0">
      <div className="w-44 shrink-0">
        <span className="text-sm font-mono text-[var(--color-text-primary)]">{col.name}</span>
        <span className="ml-1.5 text-label text-[var(--color-text-muted)]">{col.dataType}</span>
      </div>
      <div className="flex-1 min-w-0">
        {ctx?.description && (
          <p className="text-sm text-[var(--color-text-secondary)]">{ctx.description}</p>
        )}
        {samples.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {samples.map((v, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-label bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
              >
                {v}
              </span>
            ))}
          </div>
        )}
        {stats && <p className="text-label text-[var(--color-text-muted)] mt-1">{stats}</p>}
      </div>
    </div>
  );
}

function TableAccordion({
  table,
  tableCtx,
  colContexts,
}: {
  table: TableInfo;
  tableCtx?: TableCtx;
  colContexts: ColCtx[];
}) {
  const [open, setOpen] = useState(false);
  const missingDesc = !tableCtx?.description;

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-[var(--color-surface)] text-left"
      >
        {open
          ? <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]" />
          : <ChevronRight className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]" />}
        <span className="font-medium text-sm text-[var(--color-text-primary)] flex-1">{table.name}</span>
        {table.rowCount != null && (
          <span className="text-label text-[var(--color-text-muted)] mr-3">
            ~{table.rowCount.toLocaleString()} rows
          </span>
        )}
        {missingDesc && (
          <span className="flex items-center gap-1 text-label text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" />
            Missing description
          </span>
        )}
      </button>
      {open && (
        <div className="px-4 py-3 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
          {tableCtx?.description && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">{tableCtx.description}</p>
          )}
          {tableCtx?.businessPurpose && (
            <p className="text-label text-[var(--color-text-muted)] mb-3">
              Purpose: {tableCtx.businessPurpose}
            </p>
          )}
          <div>
            {table.columns.map((col) => (
              <ColumnRow
                key={col.name}
                col={col}
                ctx={colContexts.find((c) => c.columnName === col.name)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function KnowledgeViewer({ connectionId }: { connectionId: string }) {
  const qc = useQueryClient();
  const { data: schema, isLoading: schemaLoading } = useSchema(connectionId);
  const { data: contextData, isLoading: ctxLoading } = useQuery({
    queryKey: ['context', connectionId],
    queryFn: () => apiClient.get<ContextData>(`/context/${connectionId}`),
    enabled: Boolean(connectionId),
  });
  const { data: job } = useAnalysis(connectionId);
  const { mutate: trigger, isPending: triggering } = useTriggerAnalysis();
  const { mutate: retrigger, isPending: retriggering } = useRetriggerAnalysis();

  // When the job transitions to completed, refresh schema + context automatically
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (job?.status === 'completed' && prevStatus.current !== 'completed') {
      void qc.invalidateQueries({ queryKey: ['schema', connectionId] });
      void qc.invalidateQueries({ queryKey: ['context', connectionId] });
    }
    prevStatus.current = job?.status;
  }, [job?.status, connectionId, qc]);

  const isRunning = job?.status === 'running' || job?.status === 'pending';
  const isBusy = triggering || retriggering || isRunning;

  const handleAnalyze = () => {
    if (job) {
      retrigger(connectionId, {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: ['schema', connectionId] });
          void qc.invalidateQueries({ queryKey: ['context', connectionId] });
        },
      });
    } else {
      trigger(connectionId, {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: ['schema', connectionId] });
          void qc.invalidateQueries({ queryKey: ['context', connectionId] });
        },
      });
    }
  };

  if (schemaLoading || ctxLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]" />
        ))}
      </div>
    );
  }

  const tables = schema?.tables ?? [];
  const tableContexts = contextData?.tableContexts ?? [];
  const colContexts = contextData?.columnContexts ?? [];
  const missingCount = tables.filter(
    (t) => !tableContexts.find((tc) => tc.tableName === t.name)?.description
  ).length;

  return (
    <div className="space-y-4">
      {/* Analysis progress */}
      {isRunning && (
        <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface)]">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[var(--color-text-secondary)]">
              Analyzing… {job?.progressPercent ?? 0}%
            </span>
            {job?.currentStep && (
              <span className="text-[var(--color-text-muted)] text-label">{job.currentStep}</span>
            )}
          </div>
          <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-500"
              style={{ width: `${job?.progressPercent ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Failed banner — always visible, even when schema is empty */}
      {job?.status === 'failed' && (
        <div className="flex items-center gap-3 border border-red-200 rounded-lg p-3 bg-red-50">
          <AlertTriangle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
          <p className="text-sm text-[var(--color-error)] flex-1">
            Analysis failed{job.error ? `: ${job.error}` : ''}. Check your connection and try again.
          </p>
        </div>
      )}

      {/* Empty state — no schema yet and not currently running */}
      {tables.length === 0 && !isRunning && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-4">
            <Database className="w-6 h-6 text-[var(--color-text-muted)]" />
          </div>
          <h3 className="font-medium text-[var(--color-text-primary)] mb-1">No knowledge base yet</h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-xs mb-6">
            Run an analysis to scan the database schema, profile your data, and generate business context with AI.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={isBusy}
            className="px-4 py-2 bg-[var(--brand-primary)] text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {isBusy ? 'Starting…' : 'Analyze Database'}
          </button>
        </div>
      )}

      {/* Summary + re-run button */}
      {tables.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-text-muted)]">
            {tables.length} table{tables.length !== 1 ? 's' : ''}
            {missingCount > 0
              ? ` · ${missingCount} missing description${missingCount !== 1 ? 's' : ''}`
              : ' · all described'}
          </p>
          {!isRunning && (
            <button
              onClick={handleAnalyze}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              {isBusy ? 'Starting…' : 'Re-run Analysis'}
            </button>
          )}
        </div>
      )}

      {tables.map((table) => (
        <TableAccordion
          key={table.name}
          table={table}
          tableCtx={tableContexts.find((tc) => tc.tableName === table.name)}
          colContexts={colContexts.filter((cc) => cc.tableName === table.name)}
        />
      ))}
    </div>
  );
}
