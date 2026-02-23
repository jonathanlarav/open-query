# API Reference

Base URL: `http://localhost:3001/api/v1` (proxied from Next.js at `/api/v1`)

All responses follow:
- **Success**: `{ data: T, meta?: PaginationMeta }`
- **Error**: `{ error: { code: string, message: string, details?: unknown[] } }`

Error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, `CONNECTION_FAILED`, `SCHEMA_SCAN_FAILED`, `LLM_ERROR`, `READONLY_VIOLATION`, `ENCRYPTION_ERROR`

---

## Health

### `GET /health`
Returns server status. No prefix.

**Response**: `{ status: 'ok', timestamp: string }`

---

## Connections `/api/v1/connections`

### `GET /`
List all connections. Credentials are never included.

**Response**: `{ data: Connection[] }`

```typescript
interface Connection {
  id: string;
  name: string;
  type: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
  createdAt: Date;
  updatedAt: Date;
  lastConnectedAt: Date | null;
}
```

### `POST /`
Create a new connection. Credentials are encrypted before storage.

**Body**: `CreateConnectionInput`

```typescript
// PostgreSQL / MySQL
{ name: string, type: 'postgres'|'mysql', credentials: { host, port, database, username, password, ssl?: boolean } }

// SQLite
{ name: string, type: 'sqlite', credentials: { filePath: string } }

// MongoDB
{ name: string, type: 'mongodb', credentials: { uri: string, database: string } }
```

**Response**: `{ data: Connection }` — 201

### `GET /:id`
Get a single connection by ID.

**Response**: `{ data: Connection }` or 404

### `PUT /:id`
Update connection name or credentials.

**Body**: `UpdateConnectionInput` — all fields optional, same shape as create

**Response**: `{ data: Connection }`

### `DELETE /:id`
Delete connection and all associated data (cascades to sessions, messages, schema snapshots, context, analysis jobs, query log).

**Response**: 204

### `GET /:id/credentials`
Return decrypted credentials. Used exclusively by the edit connection form.

**Response**: `{ data: { type: string, credentials: Record<string, unknown> } }`

### `POST /:id/test`
Test a saved connection. Updates `lastConnectedAt` on success.

**Response**: `{ data: { success: true } }` or `{ error: { code: 'CONNECTION_FAILED', ... } }`

### `POST /test-credentials`
Test credentials before saving. Same body as `POST /`.

**Response**: `{ data: { success: true } }` or `{ error: { code: 'CONNECTION_FAILED', ... } }`

---

## Schema `/api/v1/schema`

### `GET /:connectionId`
Get the latest schema snapshot for a connection.

**Response**: `{ data: SchemaSnapshot | null }`

```typescript
interface SchemaSnapshot {
  id: string;
  connectionId: string;
  tables: TableInfo[];
  scannedAt: Date;
}

interface TableInfo {
  name: string;
  schema?: string;
  rowCount?: number;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTable?: string;
  foreignKeyColumn?: string;
  defaultValue?: string;
}
```

### `POST /:connectionId/scan`
Trigger a schema scan. Introspects the target DB and saves a new snapshot.

**Response**: `{ data: { snapshotId: string, tableCount: number, scannedAt: Date } }` — 202

---

## Context `/api/v1/context`

### `GET /:connectionId`
Get all business context (table descriptions, column descriptions, data profiles).

**Response**: `{ data: { tableContexts: TableContext[], columnContexts: ColumnContext[] } }`

```typescript
interface TableContext {
  id: string;
  connectionId: string;
  tableName: string;
  description: string | null;
  businessPurpose: string | null;
  isInferred: boolean;
}

interface ColumnContext {
  id: string;
  connectionId: string;
  tableName: string;
  columnName: string;
  description: string | null;
  dataProfileJson: string | null; // JSON: { sampleValues, distinctCount, nullRate, minValue, maxValue }
  isInferred: boolean;
}
```

### `PUT /:connectionId`
Upsert context for a table or column.

**Body**:
```typescript
{
  tableName: string;
  description?: string;
  businessPurpose?: string;
  columnName?: string; // if present → column context; absent → table context
}
```

**Response**: `{ data: { tableContexts, columnContexts } }`

### `POST /:connectionId/infer`
Trigger LLM-based context inference from the current schema snapshot.

**Response**: `{ data: { tableContexts, columnContexts } }`

---

## Chat `/api/v1/chat`

### `GET /sessions`
List all sessions with message counts, ordered by `updatedAt` descending.

**Response**: `{ data: SessionSummary[] }`

```typescript
interface SessionSummary {
  id: string;
  connectionId: string;
  title: string;         // AI-generated after first exchange; defaults to 'New Chat'
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### `POST /sessions`
Create a new chat session.

**Body**: `{ connectionId: string, title?: string }` (title defaults to `'New Chat'`)

**Response**: `{ data: ChatSession }` — 201

### `GET /sessions/:id`
Get a single session.

**Response**: `{ data: ChatSession }` or 404

### `PUT /sessions/:id`
Rename a session.

**Body**: `{ title: string }`

**Response**: 204

### `DELETE /sessions/:id`
Delete a session and all its messages.

**Response**: 204

### `GET /sessions/:id/messages`
Get all messages for a session, ordered by `createdAt` ascending.

**Response**: `{ data: ChatMessage[] }`

```typescript
interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sqlBlocksJson: string; // JSON array of SQL strings extracted from assistant markdown
  createdAt: Date;
}
```

### `POST /`
Stream a chat response (Server-Sent Events). This is the Vercel AI SDK streaming endpoint consumed by the `useChat` hook.

**Body**:
```typescript
{
  messages: Array<{ id?: string, role: 'user' | 'assistant' | 'system', content: string }>;
  sessionId: string;
  connectionId: string;
}
```

**Response**: SSE stream (`text/event-stream`). The frontend `useChat` hook handles parsing.

**Side effects on finish**:
- Persists user message and assistant message to DB
- Calls `touchSession()` to update `updatedAt`
- Extracts SQL blocks from markdown → stored in `sqlBlocksJson`
- Extracts `[CONTEXT_UPDATE]` blocks → upserted to context tables
- Auto-generates session title from first user message (LLM call, only fires once)

---

## Query `/api/v1/query`

### `POST /`
Execute a read-only SQL query against a connection.

**Body**:
```typescript
{
  sql: string;
  connectionId: string;
  limit?: number; // 1–10000, default 1000
}
```

The service:
1. Validates the query via `validateReadOnly()` (throws `READONLY_VIOLATION` if not SELECT)
2. Injects a `LIMIT` clause if none is present
3. Executes via the appropriate connector
4. Logs to `query_log` table (success or failure)

**Response**: `{ data: QueryResult }`

```typescript
interface QueryResult {
  columns: Array<{ name: string, dataType?: string }>;
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}
```

**Errors**: `READONLY_VIOLATION` (400), `CONNECTION_FAILED` (400), `VALIDATION_ERROR` (400)

---

## Reports `/api/v1/reports`

Reports are called "Pins" in the UI. A pin = saved SQL query + chart config + metadata.

### `GET /`
List all reports. Optional filter by connection.

**Query params**: `?connectionId=xxx`

**Response**: `{ data: Report[] }`

```typescript
interface Report {
  id: string;
  connectionId: string;
  sessionId: string | null;
  title: string;
  description: string | null;
  sql: string;
  chartConfigJson: string; // JSON: { type: 'bar'|'line'|'pie', xAxis, yAxis }
  createdAt: Date;
  updatedAt: Date;
}
```

### `POST /`
Create a report (pin a query).

**Body**:
```typescript
{
  connectionId: string;
  sessionId?: string;
  title: string;
  description?: string;
  sql: string;
  chartConfig: { type: 'bar' | 'line' | 'pie', xAxis: string, yAxis: string };
}
```

**Response**: `{ data: Report }` — 201

### `GET /:id`
Get a single report.

**Response**: `{ data: Report }` or 404

### `DELETE /:id`
Delete a report.

**Response**: 204

### `GET /:id/export`
Export report data as CSV or JSON.

**Query params**: `?format=csv` or `?format=json`

**Response**: File download

### `GET /sessions`
List all sessions that have at least one pin.

**Response**: `{ data: ReportSession[] }`

```typescript
interface ReportSession {
  sessionId: string;
  sessionTitle: string;
  connectionId: string;
  pinCount: number;
  lastSavedAt: Date;
}
```

### `GET /sessions/:sessionId`
Get all pins for a specific session.

**Response**: `{ data: Report[] }`

### `DELETE /sessions/:sessionId`
Delete all pins for a session.

**Response**: 204

### `POST /suggest-pin`
AI-generate a title and description for a pin from SQL + context.

**Body**: `{ sql: string, userMessage?: string, connectionId: string }`

**Response**: `{ data: { title: string, description: string } }`

---

## Settings `/api/v1/settings`

### `GET /`
Get current LLM settings. The API key is never returned — only `hasApiKey: boolean`.

**Response**:
```typescript
{
  data: {
    id: 'singleton';
    provider: 'anthropic' | 'openai' | 'ollama';
    model: string;
    ollamaBaseUrl: string;
    maxTokens: number;
    temperature: number;       // Stored as int*100 in DB; returned as float (e.g. 0.7)
    chatHistoryLimit: number;
    hasApiKey: boolean;
    updatedAt: Date;
  }
}
```

### `PUT /`
Update settings. Only provided fields are updated (all optional).

**Body**:
```typescript
{
  provider?: 'anthropic' | 'openai' | 'ollama';
  model?: string;
  apiKey?: string;           // Plaintext; encrypted before storage
  ollamaBaseUrl?: string;
  maxTokens?: number;        // 256–32000
  temperature?: number;      // 0–2
  chatHistoryLimit?: number; // 1–500
}
```

**Response**: `{ data: Settings }` (same shape as GET)

### `POST /test`
Test the current LLM configuration with a simple "Reply with: ok" prompt.

**Response**: `{ data: { model: string, provider: string } }` or `{ error: { code: 'LLM_ERROR', ... } }`

---

## Analysis `/api/v1/analysis`

### `GET /:connectionId/status`
Get the latest analysis job for a connection.

**Response**: `{ data: AnalysisJob | null }`

```typescript
interface AnalysisJob {
  id: string;
  connectionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progressPercent: number;
  currentStep: string | null;
  totalTables: number | null;
  processedTables: number | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}
```

### `POST /:connectionId/trigger`
Start the analysis pipeline for a connection. Returns 409 if a job is already running or pending.

**Response**: `{ data: AnalysisJob }` (status: 'pending') — 202, or 409

### `POST /:connectionId/retrigger`
Force-restart analysis even if a job is running. Marks the current job as failed and starts a new one.

**Response**: `{ data: AnalysisJob }` (status: 'pending') — 202

---

## Adding a New Domain

1. Create `apps/api/src/domains/{name}/`:
   - `{name}.service.ts` — Business logic, constructor takes `db: Database`
   - `{name}.routes.ts` — Fastify route registrations, calls `new XService(getDb())`
   - `{name}.schemas.ts` — Zod schemas (or import from `@open-query/shared`)

2. Register in `apps/api/src/server.ts`:
   ```typescript
   fastify.register(newRoutes, { prefix: '/api/v1/new-domain' });
   ```

3. If adding shared types, add them to `packages/shared/src/types/` and export from `packages/shared/src/index.ts`.

4. If adding DB tables, add to `packages/db/src/schema/`, export from `packages/db/src/schema/index.ts`, add query helpers in `packages/db/src/queries/`, export from `packages/db/src/index.ts`, then run `pnpm db:generate && pnpm db:migrate`.
