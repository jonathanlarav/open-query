export interface ContextBlock {
  table: string;
  column?: string;
  fact: string;
}

function parseBlocks(content: string, tag: string): ContextBlock[] {
  const pattern = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'g');
  const blocks: ContextBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const body = match[1] ?? '';
    const table = body.match(/^table:\s*(.+)$/m)?.[1]?.trim();
    const column = body.match(/^column:\s*(.+)$/m)?.[1]?.trim();
    const fact = body.match(/^fact:\s*(.+)$/m)?.[1]?.trim();

    if (table && fact) {
      blocks.push({ table, column: column || undefined, fact });
    }
  }

  return blocks;
}

export function parseContextUpdates(content: string): ContextBlock[] {
  return parseBlocks(content, 'CONTEXT_UPDATE');
}

export function parseContextConfirms(content: string): ContextBlock[] {
  return parseBlocks(content, 'CONTEXT_CONFIRM');
}

/**
 * Removes all [CONTEXT_UPDATE] and [CONTEXT_CONFIRM] blocks from content,
 * including incomplete blocks that may appear mid-stream.
 */
export function stripContextBlocks(content: string): string {
  return content
    .replace(/\[CONTEXT_UPDATE\][\s\S]*?\[\/CONTEXT_UPDATE\]/g, '')
    .replace(/\[CONTEXT_CONFIRM\][\s\S]*?\[\/CONTEXT_CONFIRM\]/g, '')
    // Strip incomplete blocks that are still streaming
    .replace(/\[CONTEXT_UPDATE\][\s\S]*$/g, '')
    .replace(/\[CONTEXT_CONFIRM\][\s\S]*$/g, '')
    .trimEnd();
}
