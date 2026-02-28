'use client';

import { useState } from 'react';
import { X, AlertCircle, RefreshCw } from 'lucide-react';
import { useAnalysis, useRetriggerAnalysis } from '@/hooks/useAnalysis';

interface AnalysisBannerProps {
  connectionId: string;
}

export function AnalysisBanner({ connectionId }: AnalysisBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { data: job } = useAnalysis(connectionId);
  const { mutate: retrigger, isPending: retriggering } = useRetriggerAnalysis();

  if (!job || dismissed) return null;
  if (job.status === 'completed') return null;
  if (job.status !== 'running' && job.status !== 'pending' && job.status !== 'failed') return null;

  if (job.status === 'failed') {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border-b border-red-200 text-sm">
        <AlertCircle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
        <span className="text-[var(--color-error)] flex-1">
          Database analysis failed{job.error ? `: ${job.error}` : ''}. Context may be incomplete.
        </span>
        <button
          onClick={() => retrigger(connectionId)}
          disabled={retriggering}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-700 border border-red-300 hover:bg-red-100 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3 h-3 ${retriggering ? 'animate-spin' : ''}`} />
          Re-run
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)] text-sm">
      <div className="w-4 h-4 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-secondary)]">
            Analyzing database… {job.progressPercent}%
          </span>
          {job.currentStep && (
            <span className="text-[var(--color-text-muted)] truncate">{job.currentStep}</span>
          )}
        </div>
        <div className="mt-1 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-500"
            style={{ width: `${job.progressPercent}%` }}
          />
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
