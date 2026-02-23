import { z } from 'zod';
import { ConnectionTypeSchema } from '../constants/db-types';

export const ConnectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  type: ConnectionTypeSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  lastConnectedAt: z.date().nullable(),
});

export type Connection = z.infer<typeof ConnectionSchema>;

// Postgres credentials
export const PostgresCredentialsSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string(),
  ssl: z.boolean().default(false),
});

// MySQL credentials
export const MySQLCredentialsSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(3306),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string(),
  ssl: z.boolean().default(false),
});

// SQLite credentials
export const SQLiteCredentialsSchema = z.object({
  filePath: z.string().min(1),
});

// MongoDB credentials
export const MongoDBCredentialsSchema = z.object({
  uri: z.string().url(),
  database: z.string().min(1),
});

export type PostgresCredentials = z.infer<typeof PostgresCredentialsSchema>;
export type MySQLCredentials = z.infer<typeof MySQLCredentialsSchema>;
export type SQLiteCredentials = z.infer<typeof SQLiteCredentialsSchema>;
export type MongoDBCredentials = z.infer<typeof MongoDBCredentialsSchema>;

// Discriminated union for credentials
export type DatabaseCredentials =
  | { type: 'postgres'; credentials: PostgresCredentials }
  | { type: 'mysql'; credentials: MySQLCredentials }
  | { type: 'sqlite'; credentials: SQLiteCredentials }
  | { type: 'mongodb'; credentials: MongoDBCredentials };

export const CreateConnectionSchema = z.discriminatedUnion('type', [
  z.object({
    name: z.string().min(1).max(100),
    type: z.literal('postgres'),
    credentials: PostgresCredentialsSchema,
  }),
  z.object({
    name: z.string().min(1).max(100),
    type: z.literal('mysql'),
    credentials: MySQLCredentialsSchema,
  }),
  z.object({
    name: z.string().min(1).max(100),
    type: z.literal('sqlite'),
    credentials: SQLiteCredentialsSchema,
  }),
  z.object({
    name: z.string().min(1).max(100),
    type: z.literal('mongodb'),
    credentials: MongoDBCredentialsSchema,
  }),
]);

export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;

export const UpdateConnectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  credentials: z
    .union([
      PostgresCredentialsSchema,
      MySQLCredentialsSchema,
      SQLiteCredentialsSchema,
      MongoDBCredentialsSchema,
    ])
    .optional(),
});

export type UpdateConnectionInput = z.infer<typeof UpdateConnectionSchema>;
