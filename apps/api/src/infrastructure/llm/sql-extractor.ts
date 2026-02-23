/**
 * Extracts SQL and MongoDB pipeline code blocks from a markdown-formatted LLM response.
 * Matches ```sql ... ``` and ```json ... ``` blocks containing { collection, pipeline }.
 */
export function extractSQLBlocks(text: string): string[] {
  const pattern = /```(?:sql|SQL|json|JSON)\s*([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const content = match[1]?.trim();
    if (content) {
      blocks.push(content);
    }
  }

  return blocks;
}

export interface ContextUpdate {
  table: string;
  column?: string;
  fact: string;
}

/**
 * Extracts [CONTEXT_UPDATE]...[/CONTEXT_UPDATE] blocks from LLM responses.
 * Used to persist user-clarified facts back into the knowledge base.
 */
export function extractContextUpdates(text: string): ContextUpdate[] {
  const pattern = /\[CONTEXT_UPDATE\]([\s\S]*?)\[\/CONTEXT_UPDATE\]/g;
  const updates: ContextUpdate[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const block = match[1]?.trim();
    if (!block) continue;

    const tableMatch = /^table:\s*(.+)$/m.exec(block);
    const columnMatch = /^column:\s*(.+)$/m.exec(block);
    const factMatch = /^fact:\s*([\s\S]+)$/m.exec(block);

    const table = tableMatch?.[1]?.trim();
    const fact = factMatch?.[1]?.trim();

    if (table && fact) {
      updates.push({
        table,
        column: columnMatch?.[1]?.trim(),
        fact,
      });
    }
  }

  return updates;
}
