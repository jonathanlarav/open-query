'use client';

import { useState } from 'react';
import { Lightbulb, Check } from 'lucide-react';
import { useUpdateContext } from '@/hooks/useContext';
import type { ContextBlock } from '@/lib/parse-context-blocks';

interface ContextConfirmCardProps {
  blocks: ContextBlock[];
  connectionId: string;
}

export function ContextConfirmCard({ blocks, connectionId }: ContextConfirmCardProps) {
  const [state, setState] = useState<'pending' | 'saved' | 'skipped'>('pending');
  const { mutate: updateContext, isPending } = useUpdateContext(connectionId);

  if (state === 'skipped') return null;

  if (state === 'saved') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-success)] mt-1">
        <Check className="w-3 h-3" />
        Saved to knowledge base
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
      <div className="flex items-center gap-1.5 mb-2 text-[var(--color-text-secondary)] font-medium">
        <Lightbulb className="w-3.5 h-3.5 shrink-0" />
        I noticed something about your data — want to save it?
      </div>

      <ul className="space-y-1 mb-3">
        {blocks.map((block, i) => (
          <li key={i} className="text-xs text-[var(--color-text-secondary)]">
            <span className="font-mono text-[var(--color-text-muted)]">
              {block.column ? `${block.table}.${block.column}` : block.table}
            </span>
            {' — '}
            {block.fact}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <button
          onClick={() => updateContext(blocks, { onSuccess: () => setState('saved') })}
          disabled={isPending}
          className="px-3 py-1 rounded-md text-xs font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {isPending ? 'Saving…' : 'Save to knowledge base'}
        </button>
        <button
          onClick={() => setState('skipped')}
          disabled={isPending}
          className="px-3 py-1 rounded-md text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
