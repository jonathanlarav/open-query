'use client';

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { useState, useMemo } from 'react';
import type { QueryResult } from '@open-query/shared';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { JsonModal } from './JsonModal';

interface QueryResultsTableProps {
  result: QueryResult;
}

function NestedBadge({ value, onOpen }: { value: unknown; onOpen: (v: unknown) => void }) {
  const label = Array.isArray(value)
    ? `[${(value as unknown[]).length}]`
    : `{${Object.keys(value as object).length}}`;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(value); }}
      className="px-1.5 py-0.5 text-xs font-mono rounded border border-[var(--color-border)] text-[var(--brand-primary)] bg-[var(--color-surface)] hover:bg-indigo-50 hover:border-[var(--brand-primary)] transition-colors"
    >
      {label}
    </button>
  );
}

export function QueryResultsTable({ result }: QueryResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [exploredValue, setExploredValue] = useState<unknown>(null);

  const columns = useMemo(
    () =>
      result.columns.map((col) => ({
        accessorKey: col.name,
        header: col.name,
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const val = getValue();

          if (val === null || val === undefined) {
            return <span className="text-[var(--color-text-muted)] italic">null</span>;
          }

          if (typeof val === 'object') {
            return <NestedBadge value={val} onOpen={setExploredValue} />;
          }

          return <span className="tabular-nums">{String(val)}</span>;
        },
      })),
    [result.columns]
  );

  const table = useReactTable({
    data: result.rows as Record<string, unknown>[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-[var(--color-surface)] z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-3 py-2 text-left text-label font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)] cursor-pointer select-none hover:text-[var(--color-text-primary)] whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-3 h-3" />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3 h-3" />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-[var(--color-surface)]'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-1.5 text-[var(--color-text-primary)] border-b border-[var(--color-border)] whitespace-nowrap max-w-xs truncate"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {exploredValue !== null && (
        <JsonModal value={exploredValue} onClose={() => setExploredValue(null)} />
      )}
    </>
  );
}
