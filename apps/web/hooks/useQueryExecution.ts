'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { QueryResult, ExecuteQueryInput } from '@open-query/shared';

export function useQueryExecution() {
  return useMutation({
    mutationFn: (input: ExecuteQueryInput) =>
      apiClient.post<QueryResult>('/query', input),
  });
}
