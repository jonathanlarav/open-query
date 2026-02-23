'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Pin, Trash2, Pencil } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatReportTime } from '@/lib/format-time';
import { useReportSessions, useDeletePinSession, useRenameSession } from '@/hooks/useReports';
import type { ReportSession } from '@/hooks/useReports';

function SessionCard({ session }: { session: ReportSession }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.sessionTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutate: deleteSession, isPending: isDeleting } = useDeletePinSession();
  const { mutate: renameSession, isPending: isRenaming } = useRenameSession();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === session.sessionTitle) {
      setDraft(session.sessionTitle);
      setEditing(false);
      return;
    }
    renameSession(
      { sessionId: session.sessionId, title: trimmed },
      { onSettled: () => setEditing(false) }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      setDraft(session.sessionTitle);
      setEditing(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete all pins for "${session.sessionTitle}"?`)) {
      deleteSession(session.sessionId);
    }
  };

  return (
    <div
      onClick={() => !editing && router.push(`/reports/${session.sessionId}`)}
      className="group relative border border-[var(--color-border)] rounded-lg p-4 bg-white hover:border-[var(--brand-primary)] hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              disabled={isRenaming}
              className="w-full text-sm font-medium text-[var(--color-text-primary)] border border-[var(--brand-primary)] rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-1 disabled:opacity-60"
            />
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                {session.sessionTitle}
              </h3>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-opacity"
                title="Rename"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          <p className="text-label text-[var(--color-text-muted)] mt-1">
            {formatReportTime(session.lastSavedAt)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
            <Pin className="w-3 h-3 text-[var(--brand-primary)]" />
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              {session.pinCount}
            </span>
          </div>
          <button
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-opacity disabled:opacity-50"
            title="Delete all pins"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReportsList() {
  const { data, isLoading } = useReportSessions();
  const sessions = data ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]"
          />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="w-8 h-8" />}
        title="No pins yet"
        description="Pin query results from the chat to save them."
        action={{ label: 'Open Chat', href: '/chat' }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sessions.map((session) => (
        <SessionCard key={session.sessionId} session={session} />
      ))}
    </div>
  );
}
