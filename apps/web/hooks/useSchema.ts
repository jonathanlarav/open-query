'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { SchemaSnapshot, ScanSchemaResponse } from '@open-query/shared';

export function useSchema(connectionId: string) {
  return useQuery({
    queryKey: ['schema', connectionId],
    queryFn: () => apiClient.get<SchemaSnapshot | null>(`/schema/${connectionId}`),
    enabled: Boolean(connectionId),
  });
}

export function useScanSchema(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<ScanSchemaResponse>(`/schema/${connectionId}/scan`),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['schema', connectionId] }),
  });
}
