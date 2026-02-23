'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Database } from 'lucide-react';
import { useConnections } from '@/hooks/useConnections';
import { apiClient } from '@/lib/api-client';
import type { ChatSession } from '@open-query/shared';

interface NewChatDialogProps {
  onClose: () => void;
}

export function NewChatDialog({ onClose }: NewChatDialogProps) {
  const router = useRouter();
  const { data: connections, isLoading } = useConnections();
  const [creating, setCreating] = React.useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSelect = async (connectionId: string) => {
    setCreating(connectionId);
    try {
      const session = await apiClient.post<ChatSession>('/chat/sessions', {
        connectionId,
        title: 'New Chat',
      });
      router.push(`/chat/${session.id}`);
    } catch {
      setCreating(null);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white border border-[var(--color-border)] rounded-xl shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold text-[var(--color-text-primary)]">New Chat</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Select a connection to start a new conversation.
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-[var(--color-surface)] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !connections?.length ? (
            <p className="text-sm text-center text-[var(--color-text-muted)] py-4">
              No connections available.{' '}
              <a href="/connections/new" className="text-[var(--brand-primary)] hover:underline">
                Add one first.
              </a>
            </p>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => void handleSelect(conn.id)}
                  disabled={creating !== null}
                  className="w-full flex items-center gap-3 p-3 text-left border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] disabled:opacity-60 transition-colors"
                >
                  <Database className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                      {conn.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{conn.type}</p>
                  </div>
                  {creating === conn.id && (
                    <span className="ml-auto text-xs text-[var(--color-text-muted)]">Creating…</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
