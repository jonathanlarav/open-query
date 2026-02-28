'use client';

import { Check } from 'lucide-react';
import type { Message } from 'ai';
import { SqlBlock } from './SqlBlock';
import { ContextConfirmCard } from './ContextConfirmCard';
import {
  parseContextUpdates,
  parseContextConfirms,
  stripContextBlocks,
} from '@/lib/parse-context-blocks';
import type { ContextBlock } from '@/lib/parse-context-blocks';

interface MessageBubbleProps {
  message: Message;
  onRunQuery: (sql: string) => Promise<void>;
  isExecuting: boolean;
  connectionId: string;
}

type Part =
  | { type: 'text'; content: string }
  | { type: 'sql'; content: string; label: string }
  | { type: 'context-saved'; blocks: ContextBlock[] }
  | { type: 'context-confirm'; blocks: ContextBlock[] };

function isMongoPipeline(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as { collection?: unknown; pipeline?: unknown };
    return typeof parsed.collection === 'string' && Array.isArray(parsed.pipeline);
  } catch {
    return false;
  }
}

function parseMessageParts(content: string): Part[] {
  const savedBlocks = parseContextUpdates(content);
  const confirmBlocks = parseContextConfirms(content);

  // Strip all context block tags before processing SQL/text
  const stripped = stripContextBlocks(content);

  const parts: Part[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = /```(sql|SQL|json|JSON)\s*([\s\S]*?)```/g;

  while ((match = pattern.exec(stripped)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: stripped.slice(lastIndex, match.index) });
    }

    const lang = match[1]?.toLowerCase() ?? 'sql';
    const code = match[2]?.trim() ?? '';

    if (lang === 'json') {
      if (isMongoPipeline(code)) {
        parts.push({ type: 'sql', content: code, label: 'Query' });
      } else {
        parts.push({ type: 'text', content: match[0] });
      }
    } else {
      parts.push({ type: 'sql', content: code, label: 'SQL' });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < stripped.length) {
    parts.push({ type: 'text', content: stripped.slice(lastIndex) });
  }

  // Append context parts after the main message content
  if (savedBlocks.length > 0) {
    parts.push({ type: 'context-saved', blocks: savedBlocks });
  }
  if (confirmBlocks.length > 0) {
    parts.push({ type: 'context-confirm', blocks: confirmBlocks });
  }

  return parts;
}

export function MessageBubble({ message, onRunQuery, isExecuting, connectionId }: MessageBubbleProps) {
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
            {parts.map((part, i) => {
              if (part.type === 'sql') {
                return (
                  <SqlBlock
                    key={i}
                    sql={part.content}
                    label={part.label}
                    onRun={() => onRunQuery(part.content)}
                    isRunning={isExecuting}
                  />
                );
              }
              if (part.type === 'context-saved') {
                return (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-[var(--color-success)]">
                    <Check className="w-3 h-3" />
                    Knowledge base updated ({part.blocks.length} {part.blocks.length === 1 ? 'fact' : 'facts'} saved)
                  </div>
                );
              }
              if (part.type === 'context-confirm') {
                return (
                  <ContextConfirmCard
                    key={i}
                    blocks={part.blocks}
                    connectionId={connectionId}
                  />
                );
              }
              return (
                <p key={i} className="whitespace-pre-wrap leading-relaxed">
                  {part.content}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
