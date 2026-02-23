# Architecture

This document describes the system design, data flows, security model, and coding patterns used throughout Open Query.

---

## System Overview

Open Query is a monorepo with four packages:

| Package | Role |
|---|---|
| `apps/web` | Next.js 15 App Router frontend |
| `apps/api` | Fastify 5 REST + SSE backend |
| `packages/db` | Drizzle ORM schema, migrations, typed query helpers |
| `packages/shared` | Zod schemas + inferred TypeScript types shared by all packages |

The web app proxies all `/api/*` requests to the API via Next.js rewrites — there is no direct browser-to-API communication in production.

---

## Request Lifecycle

### Standard REST Request

```
Browser → Next.js (/api/v1/...) → [rewrite] → Fastify (/api/v1/...)
                                                    │
                                              Route handler
                                                    │
                                          new XService(getDb())
                                                    │
                                           Service method
                                                    │
                                         DB query helper
                                                    │
                                            SQLite (Drizzle)
```

### Chat Streaming Request

```
Browser useChat hook → POST /api/v1/chat
                              │
                        ChatService.streamChat()
                              │
                   buildSystemPrompt(schema + context)
                              │
                   streamText(model, system, messages)  ← Vercel AI SDK
                              │
                   Fastify pipes SSE chunks to response
                              │
                   onFinish callback:
                     - extractSQLBlocks() → persist message
                     - extractContextUpdates() → upsert context
                     - touchSession() → update updatedAt
                     - auto-title session (if first exchange)
```

---

## Package Dependency Graph

```
apps/web     → @open-query/shared
apps/api     → @open-query/db, @open-query/shared
packages/db  → @open-query/shared (for types)
packages/shared → (no internal deps, only zod)
```

`packages/shared` is the foundation. Nothing else is circular.

---

## API Layer

### Entry Point: `apps/api/src/server.ts`

Startup sequence:
1. Validate `MASTER_KEY` env var — app exits immediately if missing
2. Initialize crypto key manager with `MASTER_KEY`
3. Initialize SQLite database via `initDatabase(DATABASE_URL)`
4. Apply pending Drizzle migrations
5. Register Fastify plugins (CORS, Helmet)
6. Register domain routes under `/api/v1`
7. Attach global error handler

### Route Prefixes

| Prefix | Domain |
|---|---|
| `/api/v1/connections` | Connection CRUD, test, credentials |
| `/api/v1/schema` | Schema scanning, snapshot retrieval |
| `/api/v1/context` | Table/column context CRUD + LLM inference |
| `/api/v1/chat` | Session management + streaming chat |
| `/api/v1/query` | SQL execution |
| `/api/v1/reports` | Pins CRUD + export |
| `/api/v1/settings` | LLM provider settings |
| `/api/v1/analysis` | Background analysis pipeline |
| `/health` | Health check (no prefix) |

### Service Pattern

Every domain follows the same structure:

```typescript
// Service — constructor injection, no singletons
export class ConnectionsService {
  constructor(private readonly db: Database) {}

  list() {
    return findAllConnections(this.db).map(stripCredentials);
  }
}

// Route — creates service per-request
fastify.get('/', async (_req, reply) => {
  const service = new ConnectionsService(getDb());
  return reply.send({ data: service.list() });
});
```

Services **never** call `getDb()` themselves — the database is injected. This makes services testable in isolation.

### Error Handling

All errors are normalized to `{ error: { code, message, details? } }` by the global error handler in `apps/api/src/shared/middleware/error-handler.ts`:

| Thrown | Status | Code |
|---|---|---|
| `ZodError` | 400 | `VALIDATION_ERROR` |
| `AppError` | custom | custom (e.g. `NOT_FOUND`, `CONNECTION_FAILED`) |
| Fastify validation | 400 | `VALIDATION_ERROR` |
| Anything else | 500 | `INTERNAL_ERROR` |

Throw `AppError` from any service when you need a specific code/status:

```typescript
throw new AppError({
  code: ErrorCode.NOT_FOUND,
  message: `Session not found: ${id}`,
  statusCode: 404,
});
```

---

## Database Layer

### SQLite Client (`packages/db/src/client.ts`)

- Opened via `better-sqlite3` with `PRAGMA journal_mode = WAL` (concurrent reads) and `PRAGMA foreign_keys = ON` (cascade deletes enforced)
- Singleton pattern: `initDatabase()` on startup, `getDb()` everywhere else
- Drizzle ORM wraps the client — all queries are type-safe

### Migrations

Drizzle Kit manages migrations in `packages/db/src/migrations/`.

```bash
# After any schema change:
pnpm db:generate   # Creates a new SQL migration file
pnpm db:migrate    # Applies it to the SQLite file
```

Never edit migration files manually. Always regenerate via `db:generate`.

### ID Generation

All tables use CUID2 (`@paralleldrive/cuid2`) for primary keys — collision-resistant, sortable, URL-safe.

### Upsert Pattern

Context tables use `onConflictDoUpdate` for idempotent writes:

```typescript
db.insert(tableContext)
  .values(data)
  .onConflictDoUpdate({
    target: [tableContext.connectionId, tableContext.tableName],
    set: { description: data.description, updatedAt: new Date() },
  })
  .run();
```

---

## Security Model

### Read-Only Enforcement (4 layers)

Every SQL query passes through `validateReadOnly()` in `apps/api/src/shared/utils/read-only-validator.ts`:

1. **Keyword regex** — Fast check. Rejects if query matches `INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|CALL|MERGE|REPLACE|UPSERT|GRANT|REVOKE|SET|LOCK`
2. **AST parse** — `node-sql-parser` parses the query and verifies `statement.type === 'select'`. Rejects non-SELECT ASTs.
3. **Connector-level** — PostgreSQL/MySQL wrap queries in `SET TRANSACTION READ ONLY`. SQLite connector opens the file with `readonly: true`.
4. **LLM prompt** — System prompt includes explicit instruction to only generate SELECT statements.

MongoDB: keyword check is skipped (no SQL), but aggregation pipelines are inspected for `$out` and `$merge` stages (which write to collections).

### Credential Encryption

Flow: `MASTER_KEY` → SHA-256 → 32-byte key → AES-256-GCM encryption

```
encrypt(plaintext):
  iv = randomBytes(12)          // 12-byte IV
  cipher = createCipheriv('aes-256-gcm', key, iv)
  ciphertext = cipher.update(plaintext) + cipher.final()
  authTag = cipher.getAuthTag() // 16 bytes
  return base64(iv + authTag + ciphertext)

decrypt(stored):
  bytes = base64decode(stored)
  iv = bytes[0..11]
  authTag = bytes[12..27]
  ciphertext = bytes[28..]
  return decipher.update(ciphertext) + decipher.final()
```

The `encryptedCredentials` field is **never** returned to the frontend. `ConnectionsService.stripCredentials()` removes it from every response. The `/connections/:id/credentials` endpoint is the only place decrypted credentials are returned, and only for the edit form.

---

## LLM Integration

### Provider Factory (`apps/api/src/infrastructure/llm/provider-factory.ts`)

Returns a Vercel AI SDK `LanguageModel` based on the saved settings:

| Provider | Requires |
|---|---|
| `anthropic` | `encryptedApiKey` |
| `openai` | `encryptedApiKey` |
| `ollama` | `ollamaBaseUrl` (default: `http://localhost:11434`) |

### System Prompt (`apps/api/src/infrastructure/llm/prompt-builder.ts`)

`buildSystemPrompt(tables, context, analysisStatus?, dbType)` constructs a prompt with:

1. **Scope rule** — Only answer database questions, refuse others
2. **Analysis status** — If analysis is incomplete, tell the LLM what context may be missing
3. **Database summary** — List of tables with business purpose descriptions
4. **Schema detail** — Per-table: column names, types, descriptions, sample values or ranges
5. **Query rules** — SQL dialect specifics (e.g. MongoDB aggregation pipeline format)
6. **Report instructions** — How to format SQL blocks for extraction
7. **CONTEXT_UPDATE format** — How to emit context updates inline

MongoDB gets special treatment: no schema prefix on collection names, aggregation pipeline syntax instead of SQL.

### Context Updates

The LLM can annotate its responses with:

```
[CONTEXT_UPDATE]
table: orders
column: status
fact: Values are 'pending', 'shipped', 'delivered', 'cancelled'
[/CONTEXT_UPDATE]
```

`extractContextUpdates()` parses these blocks, and `ChatService.streamChat()` upserts them to the `column_context` or `table_context` table on every `onFinish` callback.

### SQL Extraction

```
[CONTEXT_UPDATE] blocks → extractContextUpdates()
```sql ... ``` blocks      → extractSQLBlocks()
```

Both functions use regex on the raw assistant text.

---

## Analysis Pipeline

Triggered automatically when a connection is created. Can be manually retriggered.

```
triggerAnalysis(connectionId)
  → insertAnalysisJob (status='pending')
  → runPipeline() [fire-and-forget, no await]
      │
      ├─ Step 1 (0–10%):   Schema scan via connector.scanSchema()
      │                     Saves snapshot to schema_snapshots
      │
      ├─ Step 2 (10–70%):  DataSampler.profileTable() per table
      │                     Saves column profiles to column_context.data_profile_json
      │                     Skips tables with > 10M rows
      │
      ├─ Step 3 (70–95%):  generateContextWithSamples() — LLM call
      │                     Upserts table description + businessPurpose
      │                     Upserts column descriptions
      │
      ├─ Step 4 (95–100%): enrichWithRelationships()
      │                     For FK columns: appends "References: table.col" to businessPurpose
      │
      └─ Complete:          updateAnalysisJob(status='completed', progressPercent=100)
```

Frontend polls `GET /api/v1/analysis/:connectionId/status` every 3 seconds via `useAnalysis()` until status is `completed` or `failed`.

---

## Frontend Architecture

### Data Fetching

TanStack Query (v5) for all server state. Configuration in `apps/web/lib/query-client.ts`:
- `staleTime: 30_000` — Data considered fresh for 30s
- `retry: 1` — Retry failed requests once
- `refetchOnWindowFocus: false` — No background refetch on tab switch

Query keys are organized hierarchically:
```typescript
['connections']                        // all connections
['connections', id]                    // single connection
['connections', id, 'credentials']     // decrypted credentials
['chat', 'sessions']                   // all sessions
['chat', 'sessions', sessionId]        // single session
['chat', 'sessions', sessionId, 'messages'] // session messages
['schema', connectionId]               // schema snapshot
['context', connectionId]              // business context
['analysis', connectionId]             // analysis job
['settings']                           // LLM settings
['reports']                            // all reports
```

### Client State

Zustand stores in `apps/web/stores/`:

| Store | State | Purpose |
|---|---|---|
| `useActiveConnectionStore` | `activeConnection` | Persisted via localStorage |
| `useUIStore` | `sidebarCollapsed` | In-memory only |

### Routing

All app pages live under `apps/web/app/(app)/` and share the sidebar layout.

| Route | Page |
|---|---|
| `/chat` | Session history list + New Chat dialog |
| `/chat/[sessionId]` | Active chat interface |
| `/reports` | Pinned reports list |
| `/settings` | Tabbed settings (General, Connections, AI Model) |
| `/connections/new` | Create connection form |
| `/connections/[id]/edit` | Edit connection form |
| `/connections/[id]/knowledge` | Knowledge base viewer |

### CSS Variables

All colors use CSS variables defined in `apps/web/app/globals.css`:

| Variable | Usage |
|---|---|
| `--brand-primary` | `#4F46E5` — buttons, active states, links |
| `--brand-primary-light` | Light tint of brand — active tab background |
| `--color-background` | Page background |
| `--color-surface` | Card/panel backgrounds, hover states |
| `--color-border` | All borders |
| `--color-text-primary` | Main text |
| `--color-text-secondary` | Secondary/muted text |
| `--color-text-muted` | Placeholder, disabled |
| `--color-success` | Green for success states |
| `--color-error` | Red for error states |

Never hardcode color values. Always use these variables.

---

## Coding Conventions

### File Naming

```
{domain}.routes.ts     → Fastify route registrations
{domain}.service.ts    → Business logic
{domain}.queries.ts    → Drizzle query helpers (in packages/db)
{domain}.schemas.ts    → Zod validation schemas
{domain}.types.ts      → TypeScript types (if not in shared)
{domain}.service.test.ts → Co-located unit tests
```

### 200-Line Limit

Files over 200 lines must be split. Extract helper functions into a `{domain}.helpers.ts` or `{domain}.{sub-concern}.ts`.

### No `any`

`any` is forbidden. Use explicit types, `unknown` + type guards, or generics.

### Zod First

All API input types derive from Zod schemas. All types shared between frontend and backend live in `packages/shared/src/`:

```typescript
// In packages/shared:
export const CreateConnectionSchema = z.object({ ... });
export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;

// In API route:
const body = CreateConnectionSchema.parse(req.body);

// In frontend hook:
import type { CreateConnectionInput } from '@open-query/shared';
```

### API Response Shape

```typescript
// Success
{ data: T, meta?: { page: number, pageSize: number, total: number } }

// Error
{ error: { code: string, message: string, details?: unknown[] } }
```

All routes wrap their return in `{ data: result }`. The `apiClient` in the frontend unwraps this automatically — `apiClient.get<T>()` returns `T` directly.

### Component Pattern

```tsx
'use client'; // Required for any component using hooks, state, or events

import { useQuery } from '@tanstack/react-query';

// Skeleton first
if (isLoading) return <SkeletonUI />;

// Empty state
if (!data?.length) return <EmptyState ... />;

// Happy path
return <RealUI />;
```
