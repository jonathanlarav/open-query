'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect, useState, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { PromptInput } from './PromptInput';
import { ResultsPanel } from './ResultsPanel';
import { AnalysisBanner } from './AnalysisBanner';
import { KnowledgePanel } from './KnowledgePanel';
import { useQueryExecution } from '@/hooks/useQueryExecution';
import { useChatSession, useChatMessages } from '@/hooks/useChat';
import { useConnection } from '@/hooks/useConnections';
import { useSettings } from '@/hooks/useSettings';
import { ActionableError } from '@/components/shared/ActionableError';
import { parseApiError } from '@/lib/parse-api-error';
import type { QueryResult } from '@open-query/shared';

interface ChatInterfaceProps {
  sessionId: string;
}

export function ChatInterface({ sessionId }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeResult, setActiveResult] = useState<QueryResult | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [knowledgePanelOpen, setKnowledgePanelOpen] = useState(true);

  const { data: session, isLoading: sessionLoading } = useChatSession(sessionId);
  const connectionId = session?.connectionId ?? '';
  const { data: connection } = useConnection(connectionId);
  const { data: settings } = useSettings();
  const { mutateAsync: executeQuery, isPending: isExecuting } = useQueryExecution();

  const { data: savedMessages } = useChatMessages(sessionId);
  const historyLimit = settings?.chatHistoryLimit ?? 20;

  // Compute initial messages once — when savedMessages transitions from undefined to loaded
  const initialMessages = useMemo(
    () =>
      (savedMessages ?? [])
        .slice(-historyLimit)
        .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Boolean(savedMessages)]
  );

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: `/api/v1/chat`,
    body: { sessionId, connectionId },
    id: sessionId,
    initialMessages,
  });

  const chatError = error ? parseApiError(error) : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content;

  const handleRunQuery = async (sql: string) => {
    setQueryError(null);
    try {
      const result = await executeQuery({ sql, connectionId, limit: 1000 });
      setActiveResult(result);
      setActiveQuery(sql);
    } catch (err) {
      const parsed = parseApiError(err);
      setQueryError(parsed.message);
    }
  };

  if (sessionLoading || savedMessages === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-sm text-[var(--color-text-muted)]">Loading session…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left: Chat column ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Analysis progress banner */}
        {connectionId && <AnalysisBanner connectionId={connectionId} />}

        {/* Chat header — only shown when panel is closed */}
        {!knowledgePanelOpen && (
          <div className="flex items-center justify-end px-4 py-2 border-b border-[var(--color-border)] shrink-0">
            <button
              onClick={() => setKnowledgePanelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Knowledge Base
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="font-semibold text-[var(--color-text-primary)]">Ask anything about your data</p>
                <p className="text-body text-[var(--color-text-secondary)] mt-1">
                  I&apos;ll generate SQL queries and help you explore your database.
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRunQuery={handleRunQuery}
              isExecuting={isExecuting}
            />
          ))}

          {/* Typing indicator — shown while the model is generating */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {chatError && (
            <div className="flex justify-start">
              <div className="max-w-xl w-full">
                <ActionableError message={chatError.message} action={chatError.action} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Query execution error */}
        {queryError && (
          <div className="px-6 py-2 border-t border-[var(--color-border)]">
            <ActionableError message={queryError} />
          </div>
        )}

        {/* Results panel */}
        {activeResult && (
          <ResultsPanel
            result={activeResult}
            connectionId={connectionId}
            onClose={() => { setActiveResult(null); setActiveQuery(null); }}
            query={activeQuery ?? undefined}
            sessionId={sessionId}
            lastUserMessage={lastUserMessage}
          />
        )}

        {/* Input */}
        <PromptInput
          value={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          connectionName={connection?.name}
          llmProvider={settings?.provider}
          llmModel={settings?.model}
        />
      </div>

      {/* ── Right: Knowledge panel ── */}
      {knowledgePanelOpen && connectionId && (
        <KnowledgePanel
          connectionId={connectionId}
          onClose={() => setKnowledgePanelOpen(false)}
        />
      )}
    </div>
  );
}
