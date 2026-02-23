'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface AnalysisJob {
  id: string;
  connectionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progressPercent: number;
  currentStep: string | null;
  totalTables: number;
  processedTables: number;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

const ANALYSIS_KEY = (connectionId: string) => ['analysis', connectionId] as const;

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

export function useAnalysis(connectionId: string) {
  return useQuery({
    queryKey: ANALYSIS_KEY(connectionId),
    queryFn: () => apiClient.get<AnalysisJob | null>(`/analysis/${connectionId}/status`),
    enabled: Boolean(connectionId),
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job || TERMINAL_STATUSES.has(job.status)) return false;
      return 3000;
    },
  });
}

export function useTriggerAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      apiClient.post<AnalysisJob>(`/analysis/${connectionId}/trigger`),
    onSuccess: (_data, connectionId) => {
      void qc.invalidateQueries({ queryKey: ANALYSIS_KEY(connectionId) });
    },
  });
}

export function useRetriggerAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      apiClient.post<AnalysisJob>(`/analysis/${connectionId}/retrigger`),
    onSuccess: (_data, connectionId) => {
      void qc.invalidateQueries({ queryKey: ANALYSIS_KEY(connectionId) });
    },
  });
}
