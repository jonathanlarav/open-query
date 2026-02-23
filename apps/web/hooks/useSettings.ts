'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface LLMSettings {
  provider: string;
  model: string;
  ollamaBaseUrl: string;
  maxTokens: number;
  temperature: number;
  chatHistoryLimit: number;
  hasApiKey: boolean;
}

interface UpdateSettingsInput {
  provider?: string;
  model?: string;
  apiKey?: string;
  ollamaBaseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  chatHistoryLimit?: number;
}

const SETTINGS_KEY = ['settings'] as const;

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiClient.get<LLMSettings>('/settings'),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSettingsInput) =>
      apiClient.put<LLMSettings>('/settings', data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useTestLLM() {
  return useMutation({
    mutationFn: () =>
      apiClient.post<{ model: string; provider: string }>('/settings/test'),
  });
}
