'use client';

import { useEffect, useState } from 'react';
import { X, ChevronRight } from 'lucide-react';

interface JsonModalProps {
  value: unknown;
  onClose: () => void;
}

function typeLabel(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return `array[${(val as unknown[]).length}]`;
  return typeof val;
}

function valuePreview(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return `[${(val as unknown[]).length} items]`;
  if (typeof val === 'object') return `{${Object.keys(val as object).length} keys}`;
  if (typeof val === 'string') {
    const s = val as string;
    return s.length > 80 ? `"${s.slice(0, 80)}…"` : `"${s}"`;
  }
  return String(val);
}

function isNested(val: unknown): boolean {
  return val !== null && typeof val === 'object';
}

function resolveValue(root: unknown, path: (string | number)[]): unknown {
  return path.reduce((cur: unknown, key) => {
    if (cur === null || typeof cur !== 'object') return undefined;
    return (cur as Record<string | number, unknown>)[key];
  }, root);
}

export function JsonModal({ value, onClose }: JsonModalProps) {
  const [path, setPath] = useState<(string | number)[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const current = resolveValue(value, path);
  const entries: [string | number, unknown][] = Array.isArray(current)
    ? (current as unknown[]).map((v, i) => [i, v])
    : Object.entries((current ?? {}) as Record<string, unknown>);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-[var(--color-border)] w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — breadcrumb + close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0 min-w-0">
          <div className="flex items-center gap-1 text-sm font-mono flex-wrap min-w-0">
            <button
              onClick={() => setPath([])}
              className="text-[var(--brand-primary)] hover:underline shrink-0"
            >
              root
            </button>
            {path.map((key, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
                <button
                  onClick={() => setPath(path.slice(0, i + 1))}
                  className="text-[var(--brand-primary)] hover:underline truncate max-w-[120px]"
                  title={String(key)}
                >
                  {String(key)}
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] p-0.5 rounded hover:bg-[var(--color-surface)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {entries.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] px-4 py-6 text-center italic">
              {Array.isArray(current) ? 'Empty array' : 'Empty object'}
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-[var(--color-surface)] z-10">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)] border-b border-[var(--color-border)] w-[30%]">
                    {Array.isArray(current) ? 'Index' : 'Key'}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)] border-b border-[var(--color-border)] w-[20%]">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, val], i) => {
                  const nested = isNested(val);
                  return (
                    <tr
                      key={String(key)}
                      className={`${i % 2 === 0 ? 'bg-white' : 'bg-[var(--color-surface)]'} ${
                        nested ? 'cursor-pointer hover:bg-indigo-50' : ''
                      }`}
                      onClick={() => nested && setPath([...path, key])}
                    >
                      <td className="px-4 py-2 font-mono text-[var(--color-text-primary)] border-b border-[var(--color-border)] align-top">
                        {String(key)}
                      </td>
                      <td className="px-4 py-2 text-[var(--color-text-muted)] border-b border-[var(--color-border)] align-top whitespace-nowrap text-xs">
                        {typeLabel(val)}
                      </td>
                      <td className="px-4 py-2 border-b border-[var(--color-border)] align-top">
                        {nested ? (
                          <span className="flex items-center gap-1 text-[var(--brand-primary)] text-xs font-medium">
                            {valuePreview(val)}
                            <ChevronRight className="w-3 h-3 shrink-0" />
                          </span>
                        ) : (
                          <span
                            className={`font-mono text-xs break-all ${
                              val === null
                                ? 'text-[var(--color-text-muted)] italic'
                                : 'text-[var(--color-text-primary)]'
                            }`}
                          >
                            {val === null ? 'null' : typeof val === 'string' ? `"${val}"` : String(val)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
