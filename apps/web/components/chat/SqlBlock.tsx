'use client';

import { Copy, Play } from 'lucide-react';
import { useState } from 'react';

interface SqlBlockProps {
  sql: string;
  label?: string;
  onRun: () => void;
  isRunning: boolean;
}

export function SqlBlock({ sql, label = 'SQL', onRun, isRunning }: SqlBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <span className="text-label font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-label rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={onRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-2.5 py-1 text-label font-medium rounded text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <Play className="w-3 h-3" />
            {isRunning ? 'Running…' : 'Run Query'}
          </button>
        </div>
      </div>
      <pre className="p-4 text-sm font-mono overflow-x-auto bg-white text-[var(--color-text-primary)] tabular-nums">
        <code>{sql}</code>
      </pre>
    </div>
  );
}
