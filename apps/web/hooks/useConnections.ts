'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Connection, CreateConnectionInput } from '@open-query/shared';
import { useTriggerAnalysis } from './useAnalysis';

const CONNECTIONS_KEY = ['connections'] as const;

export function useConnections() {
  return useQuery({
    queryKey: CONNECTIONS_KEY,
    queryFn: () => apiClient.get<Connection[]>('/connections'),
  });
}

export function useConnection(id: string) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, id],
    queryFn: () => apiClient.get<Connection>(`/connections/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  const { mutate: triggerAnalysis } = useTriggerAnalysis();
  return useMutation({
    mutationFn: (data: CreateConnectionInput) =>
      apiClient.post<Connection>('/connections', data),
    onSuccess: (connection) => {
      void qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });
      triggerAnalysis(connection.id);
    },
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/connections/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useConnectionCredentials(id: string) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, id, 'credentials'],
    queryFn: () =>
      apiClient.get<{ type: string; credentials: Record<string, unknown> }>(
        `/connections/${id}/credentials`
      ),
    enabled: Boolean(id),
  });
}

export function useUpdateConnection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; credentials?: Record<string, unknown> }) =>
      apiClient.put<Connection>(`/connections/${id}`, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CONNECTIONS_KEY }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean }>(`/connections/${id}/test`),
  });
}

export function useTestRawCredentials() {
  return useMutation({
    mutationFn: (data: CreateConnectionInput) =>
      apiClient.post<{ success: boolean }>('/connections/test-credentials', data),
  });
}
