'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface ReportSession {
  sessionId: string;
  sessionTitle: string;
  connectionId: string;
  pinCount: number;
  lastSavedAt: string;
}

export interface Report {
  id: string;
  connectionId: string;
  sessionId: string | null;
  title: string;
  description: string | null;
  sql: string;
  chartConfigJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportInput {
  connectionId: string;
  sessionId?: string;
  title: string;
  description?: string;
  sql: string;
}

export function useReportSessions() {
  return useQuery({
    queryKey: ['reports', 'sessions'],
    queryFn: () => apiClient.get<ReportSession[]>('/reports/sessions'),
  });
}

export function usePinsBySession(sessionId: string) {
  return useQuery({
    queryKey: ['reports', 'sessions', sessionId],
    queryFn: () => apiClient.get<Report[]>(`/reports/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReportInput) =>
      apiClient.post<Report>('/reports', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'sessions'] });
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/reports/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'sessions'] });
    },
  });
}

export function useDeletePinSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.delete<void>(`/reports/sessions/${sessionId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'sessions'] });
    },
  });
}

export function useRenameSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) =>
      apiClient.put<void>(`/chat/sessions/${sessionId}`, { title }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'sessions'] });
    },
  });
}
