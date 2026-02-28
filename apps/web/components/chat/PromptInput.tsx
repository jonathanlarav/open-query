'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { Send, Info } from 'lucide-react';

interface PromptInputProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  connectionName?: string;
  llmProvider?: string;
  llmModel?: string;
}

export function PromptInput({ value, onChange, onSubmit, isLoading, connectionName, llmProvider, llmModel }: PromptInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      form?.requestSubmit();
    }
  };

  return (
    <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-background)]">
      <form onSubmit={onSubmit} className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3 border border-[var(--color-border)] rounded-xl p-3 focus-within:ring-2 focus-within:ring-[var(--brand-primary)] focus-within:border-[var(--brand-primary)]">
          <textarea
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your data… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none text-sm bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none max-h-40 overflow-y-auto disabled:opacity-50"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 disabled:opacity-40"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {(connectionName || llmModel) && (
          <p className="text-label text-[var(--color-text-muted)] mt-2 text-center">
            {connectionName && (
              <>Using <span className="text-[var(--color-text-secondary)]">{connectionName}</span> connection</>
            )}
            {connectionName && llmModel && <> · </>}
            {llmModel && (
              <><span className="text-[var(--color-text-secondary)]">{llmModel}</span> via {llmProvider}</>
            )}
          </p>
        )}
        <p className="flex items-center justify-center gap-1 text-label text-[var(--color-text-muted)] mt-1">
          <Info className="w-3 h-3 shrink-0" />
          You can ask questions or tell me facts about your data to improve the knowledge base
        </p>
      </form>
    </div>
  );
}
