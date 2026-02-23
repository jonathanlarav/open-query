'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Trash2, Plus } from 'lucide-react';
import { useChatSessions, useDeleteSession } from '@/hooks/useChat';
import { useConnections } from '@/hooks/useConnections';
import { EmptyState } from '@/components/shared/EmptyState';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { formatReportTime } from '@/lib/format-time';
import type { Connection } from '@open-query/shared';

const TYPE_BADGE_CLASSES: Record<string, string> = {
  postgres: 'bg-blue-50 text-blue-700 border-blue-200',
  mysql: 'bg-orange-50 text-orange-700 border-orange-200',
  sqlite: 'bg-green-50 text-green-700 border-green-200',
  mongodb: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function typeBadgeClass(type: string): string {
  return TYPE_BADGE_CLASSES[type] ?? 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)]';
}

export default function ChatPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: sessions, isLoading: sessionsLoading } = useChatSessions();
  const { data: connectionsData } = useConnections();
  const { mutate: deleteSession } = useDeleteSession();

  const connectionsById = (connectionsData ?? []).reduce<Record<string, Connection>>(
    (acc, c) => { acc[c.id] = c; return acc; },
    {}
  );

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      deleteSession(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[1.875rem] font-semibold text-[var(--color-text-primary)]">Chat</h1>
          <p className="mt-1 text-body text-[var(--color-text-secondary)]">
            Resume a conversation or start a new one
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {sessionsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[var(--color-surface)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !sessions?.length ? (
        <EmptyState
          icon={<MessageSquare className="w-8 h-8" />}
          title="No conversations yet"
          description="Start a new chat to ask questions about your data."
          action={{ label: 'New Chat', onClick: () => setDialogOpen(true) }}
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const conn = connectionsById[session.connectionId];
            return (
              <div
                key={session.id}
                className="group relative flex items-center gap-4 p-4 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                onClick={() => router.push(`/chat/${session.id}`)}
              >
                <MessageSquare className="w-5 h-5 shrink-0 text-[var(--color-text-muted)]" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[var(--color-text-primary)] truncate">
                      {session.title || 'New Chat'}
                    </span>
                    {conn && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeBadgeClass(conn.type)}`}
                      >
                        {conn.name} · {conn.type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatReportTime(session.updatedAt)}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {session.messageCount} {session.messageCount === 1 ? 'message' : 'messages'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                  className={`shrink-0 p-1.5 rounded-md transition-colors ${
                    deleteConfirm === session.id
                      ? 'text-red-600 bg-red-50'
                      : 'text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-surface)]'
                  }`}
                  title={deleteConfirm === session.id ? 'Click again to confirm delete' : 'Delete session'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {dialogOpen && <NewChatDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
