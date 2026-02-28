'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ContextBlock } from '@/lib/parse-context-blocks';

interface ContextUpdatePayload {
  tables: Array<{
    tableName: string;
    description?: string;
    columns: Array<{ columnName: string; description: string }>;
  }>;
}

function blocksToPayload(blocks: ContextBlock[]): ContextUpdatePayload {
  const tableMap = new Map<string, { description?: string; columns: Array<{ columnName: string; description: string }> }>();

  for (const block of blocks) {
    if (!tableMap.has(block.table)) {
      tableMap.set(block.table, { columns: [] });
    }
    const entry = tableMap.get(block.table)!;
    if (block.column) {
      entry.columns.push({ columnName: block.column, description: block.fact });
    } else {
      entry.description = block.fact;
    }
  }

  return {
    tables: Array.from(tableMap.entries()).map(([tableName, data]) => ({
      tableName,
      description: data.description,
      columns: data.columns,
    })),
  };
}

export function useUpdateContext(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blocks: ContextBlock[]) =>
      apiClient.put<unknown>(`/context/${connectionId}`, blocksToPayload(blocks)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['context', connectionId] }),
  });
}
