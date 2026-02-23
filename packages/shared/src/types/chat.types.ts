import { z } from 'zod';

export const ChatMessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: ChatMessageRoleSchema,
  content: z.string(),
  createdAt: z.date(),
  sqlBlocks: z.array(z.string()).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSessionSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  messageCount: z.number().optional(),
});

export type ChatSession = z.infer<typeof ChatSessionSchema>;

export const CreateChatSessionSchema = z.object({
  connectionId: z.string(),
  title: z.string().min(1).max(200).default('New Chat'),
});

export type CreateChatSessionInput = z.infer<typeof CreateChatSessionSchema>;

export const ChatRequestSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1),
  connectionId: z.string(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
