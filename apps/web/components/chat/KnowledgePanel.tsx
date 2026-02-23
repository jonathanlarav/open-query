'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PanelRightClose, ArrowLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchema } from '@/hooks/useSchema';
import { useAnalysis } from '@/hooks/useAnalysis';
import type { TableInfo } from '@open-query/shared';

interface TableCtx { tableName: string; description: string | null; businessPurpose: string | null; }
interface ColCtx { tableName: string; columnName: string; description: string | null; dataProfileJson: string | null; }
interface ContextData { tableContexts: TableCtx[]; columnContexts: ColCtx[]; }

const MIN_WIDTH = 240;
const MAX_WIDTH = 1365;
const DEFAULT_WIDTH = 624;

function TableList({ tables, contexts, onSelect, onClose, progressBar }: {
  tables: TableInfo[];
  contexts: TableCtx[];
  onSelect: (t: TableInfo) => void;
  onClose: () => void;
  progressBar: React.ReactNode;
}) {
  const described = tables.filter(t => contexts.find(c => c.tableName === t.name)?.description).length;

  return (
    <>
      <div className="flex items-start justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Knowledge Base</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {tables.length} tables · {described}/{tables.length} described
          </p>
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] p-0.5 rounded hover:bg-[var(--color-surface)]">
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {progressBar}

      <div className="flex-1 overflow-y-auto">
        {tables.map((table) => {
          const ctx = contexts.find((c) => c.tableName === table.name);
          return (
            <button
              key={table.name}
              onClick={() => onSelect(table)}
              className="w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] flex items-start gap-3 group"
            >
              <span className={`mt-[5px] w-1.5 h-1.5 rounded-full shrink-0 ${ctx?.description ? 'bg-[var(--color-success)]' : 'bg-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{table.name}</span>
                  {table.rowCount != null && (
                    <span className="text-xs text-[var(--color-text-muted)] shrink-0 tabular-nums">
                      {table.rowCount.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 line-clamp-2 ${ctx?.description ? 'text-[var(--color-text-muted)]' : 'text-amber-500'}`}>
                  {ctx?.description ?? 'No description yet'}
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}

        {tables.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-10 px-4">
            No schema data. Run analysis from the Knowledge Base page.
          </p>
        )}
      </div>
    </>
  );
}

function TableDetail({ table, tableCtx, colContexts, onBack, onClose }: {
  table: TableInfo;
  tableCtx?: TableCtx;
  colContexts: ColCtx[];
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--color-border)] shrink-0">
        <button onClick={onBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] p-0.5 rounded hover:bg-[var(--color-surface)]">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{table.name}</h2>
          {table.rowCount != null && (
            <p className="text-xs text-[var(--color-text-muted)]">~{table.rowCount.toLocaleString()} rows</p>
          )}
        </div>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] p-0.5 rounded hover:bg-[var(--color-surface)]">
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          {tableCtx?.description
            ? <p className="text-sm text-[var(--color-text-secondary)]">{tableCtx.description}</p>
            : <p className="text-xs text-amber-500">No description generated yet.</p>}
          {tableCtx?.businessPurpose && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Purpose: {tableCtx.businessPurpose}</p>
          )}
        </div>

        <div className="divide-y divide-[var(--color-border)]">
          {table.columns.map((col) => {
            const ctx = colContexts.find((c) => c.columnName === col.name);
            let samples: string[] = [];
            let rangeText: string | null = null;
            if (ctx?.dataProfileJson) {
              try {
                const p = JSON.parse(ctx.dataProfileJson) as { sampleValues?: string[]; minValue?: string | null; maxValue?: string | null };
                samples = p.sampleValues?.slice(0, 6) ?? [];
                if (!samples.length && p.minValue != null) rangeText = `${p.minValue} – ${p.maxValue}`;
              } catch { /**/ }
            }
            const flags = [col.isPrimaryKey && 'PK', col.isForeignKey && `FK→${col.foreignKeyTable}`].filter(Boolean) as string[];

            return (
              <div key={col.name} className="px-4 py-2.5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-sm font-mono font-medium text-[var(--color-text-primary)]">{col.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{col.dataType}</span>
                  {flags.map((f) => <span key={f} className="text-xs text-[var(--brand-primary)] font-medium">{f}</span>)}
                </div>
                {ctx?.description && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{ctx.description}</p>}
                {samples.length > 0 && <p className="text-xs text-[var(--color-text-muted)] mt-1">{samples.join(' · ')}</p>}
                {rangeText && <p className="text-xs text-[var(--color-text-muted)] mt-1">{rangeText}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function KnowledgePanel({ connectionId, onClose }: { connectionId: string; onClose: () => void }) {
  const [selected, setSelected] = useState<TableInfo | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const { data: schema } = useSchema(connectionId);
  const { data: ctxData } = useQuery({
    queryKey: ['context', connectionId],
    queryFn: () => apiClient.get<ContextData>(`/context/${connectionId}`),
    enabled: Boolean(connectionId),
  });
  const { data: job } = useAnalysis(connectionId);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const delta = dragState.current.startX - e.clientX;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragState.current.startWidth + delta)));
    };
    const onUp = () => {
      dragState.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [width]);

  const tables = schema?.tables ?? [];
  const tableContexts = ctxData?.tableContexts ?? [];
  const colContexts = ctxData?.columnContexts ?? [];
  const isRunning = job?.status === 'running' || job?.status === 'pending';

  const progressBar = isRunning ? (
    <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
      <div className="flex justify-between text-xs mb-1 text-[var(--color-text-muted)]">
        <span>Analyzing… {job?.progressPercent ?? 0}%</span>
        {job?.currentStep && <span className="truncate ml-2">{job.currentStep}</span>}
      </div>
      <div className="h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--brand-primary)] transition-all duration-500" style={{ width: `${job?.progressPercent ?? 0}%` }} />
      </div>
    </div>
  ) : null;

  return (
    <div style={{ width }} className="shrink-0 relative border-l border-[var(--color-border)] flex flex-col bg-white overflow-hidden">
      {/* Drag handle — left edge */}
      <div
        onMouseDown={handleDragStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-[var(--brand-primary)] transition-colors opacity-0 hover:opacity-40"
      />

      {selected ? (
        <TableDetail
          table={selected}
          tableCtx={tableContexts.find((c) => c.tableName === selected.name)}
          colContexts={colContexts.filter((c) => c.tableName === selected.name)}
          onBack={() => setSelected(null)}
          onClose={onClose}
        />
      ) : (
        <TableList
          tables={tables}
          contexts={tableContexts}
          onSelect={setSelected}
          onClose={onClose}
          progressBar={progressBar}
        />
      )}
    </div>
  );
}
