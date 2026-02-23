'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ChatSession, ChatMessage } from '@open-query/shared';

export interface SessionSummary extends ChatSession {
  messageCount: number;
}

export function useChatSession(sessionId: string) {
  return useQuery({
    queryKey: ['chat', 'sessions', sessionId],
    queryFn: () => apiClient.get<ChatSession>(`/chat/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });
}

export function useChatSessions() {
  return useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: () => apiClient.get<SessionSummary[]>('/chat/sessions'),
  });
}

export function useChatMessages(sessionId: string) {
  return useQuery({
    queryKey: ['chat', 'sessions', sessionId, 'messages'],
    queryFn: () => apiClient.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`),
    enabled: Boolean(sessionId),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/chat/sessions/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['chat', 'sessions'] });
      const previous = qc.getQueryData<SessionSummary[]>(['chat', 'sessions']);
      qc.setQueryData<SessionSummary[]>(['chat', 'sessions'], (old) =>
        (old ?? []).filter((s) => s.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(['chat', 'sessions'], context.previous);
      }
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['chat', 'sessions'] }),
  });
}
