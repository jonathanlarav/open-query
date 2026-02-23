'use client';

import type { Message } from 'ai';
import { SqlBlock } from './SqlBlock';

interface MessageBubbleProps {
  message: Message;
  onRunQuery: (sql: string) => Promise<void>;
  isExecuting: boolean;
}

type Part =
  | { type: 'text'; content: string }
  | { type: 'sql'; content: string; label: string };

function isMongoPipeline(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as { collection?: unknown; pipeline?: unknown };
    return typeof parsed.collection === 'string' && Array.isArray(parsed.pipeline);
  } catch {
    return false;
  }
}

function parseMessageParts(content: string): Part[] {
  const parts: Part[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = /```(sql|SQL|json|JSON)\s*([\s\S]*?)```/g;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }

    const lang = match[1]?.toLowerCase() ?? 'sql';
    const code = match[2]?.trim() ?? '';

    if (lang === 'json') {
      if (isMongoPipeline(code)) {
        parts.push({ type: 'sql', content: code, label: 'Query' });
      } else {
        // Non-pipeline JSON — render as plain text block
        parts.push({ type: 'text', content: match[0] });
      }
    } else {
      parts.push({ type: 'sql', content: code, label: 'SQL' });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts;
}

export function MessageBubble({ message, onRunQuery, isExecuting }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const parts = isUser ? [] : parseMessageParts(message.content);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-3xl rounded-xl px-4 py-3 ${
          isUser
            ? 'text-white text-sm'
            : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]'
        }`}
        style={isUser ? { backgroundColor: 'var(--brand-primary)' } : {}}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="space-y-3">
            {parts.map((part, i) =>
              part.type === 'sql' ? (
                <SqlBlock
                  key={i}
                  sql={part.content}
                  label={part.label}
                  onRun={() => onRunQuery(part.content)}
                  isRunning={isExecuting}
                />
              ) : (
                <p key={i} className="whitespace-pre-wrap leading-relaxed">
                  {part.content}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
