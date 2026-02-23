import { z } from 'zod';

// Standard API success response
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z
      .object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().nonnegative(),
      })
      .optional(),
  });

// Standard API error response
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export type ApiSuccess<T> = {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
  };
};

// Pagination query params
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

// Error codes used throughout the application
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  READONLY_VIOLATION: 'READONLY_VIOLATION',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  SCHEMA_SCAN_FAILED: 'SCHEMA_SCAN_FAILED',
  LLM_ERROR: 'LLM_ERROR',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
