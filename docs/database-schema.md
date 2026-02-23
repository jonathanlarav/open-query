# Database Schema

Open Query uses SQLite (via `better-sqlite3` + Drizzle ORM) as its internal metadata store. The database file path defaults to `./data/openquery.db` relative to the API process.

---

## Configuration

```typescript
// packages/db/src/client.ts
const sqlite = new Database(filePath);
sqlite.pragma('journal_mode = WAL');   // Concurrent reads
sqlite.pragma('foreign_keys = ON');    // Cascade deletes enforced
```

**WAL mode** allows multiple readers to access the DB simultaneously while a writer is active — important for analysis pipeline + API handling requests concurrently.

**Foreign keys ON** means cascade deletes defined in the schema actually fire. Deleting a connection will cascade-delete all sessions, messages, schema snapshots, context, analysis jobs, and query log entries.

---

## Tables

### `connections`

Stores one row per user-configured database connection.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, CUID2 | Unique identifier |
| `name` | TEXT | NOT NULL | Display name (user-provided) |
| `type` | TEXT | NOT NULL | `'postgres'`, `'mysql'`, `'sqlite'`, `'mongodb'` |
| `encrypted_credentials` | TEXT | NOT NULL | AES-256-GCM encrypted JSON credentials |
| `created_at` | INTEGER | NOT NULL, default `unixepoch()` | Unix timestamp |
| `updated_at` | INTEGER | NOT NULL, default `unixepoch()` | Unix timestamp |
| `last_connected_at` | INTEGER | nullable | Set on successful test |

**Cascade**: Deleting a connection cascades to `chat_sessions`, `schema_snapshots`, `table_context`, `column_context`, `analysis_jobs`, `query_log`.

---

### `schema_snapshots`

Stores schema introspection results (table list, columns, row counts).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, CUID2 | |
| `connection_id` | TEXT | NOT NULL, FK → connections(id) CASCADE | |
| `tables_json` | TEXT | NOT NULL | JSON-serialized `TableInfo[]` |
| `scanned_at` | INTEGER | NOT NULL, default `unixepoch()` | |

The latest snapshot for a connection is found by `ORDER BY scanned_at DESC LIMIT 1`. When a new scan runs, old snapshots are deleted to keep only the most recent.

**`tables_json` structure:**
```json
[
  {
    "name": "orders",
    "schema": "public",
    "rowCount": 142500,
    "columns": [
      {
        "name": "id", "dataType": "integer", "isNullable": false,
        "isPrimaryKey": true, "isForeignKey": false
      },
      {
        "name": "user_id", "dataType": "integer", "isNullable": false,
        "isPrimaryKey": false, "isForeignKey": true,
        "foreignKeyTable": "users", "foreignKeyColumn": "id"
      }
    ]
  }
]
```

---

### `table_context`

Business context for each table in a connection.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, CUID2 | |
| `connection_id` | TEXT | NOT NULL, FK → connections(id) CASCADE | |
| `table_name` | TEXT | NOT NULL | |
| `schema_name` | TEXT | nullable | e.g. `'public'` for PostgreSQL |
| `description` | TEXT | nullable | Human-readable description |
| `business_purpose` | TEXT | nullable | Why this table exists in business terms |
| `is_inferred` | INTEGER | NOT NULL, default 1 | 1 = AI-generated, 0 = manually set |
| `created_at` | INTEGER | NOT NULL | |
| `updated_at` | INTEGER | NOT NULL | |

**Unique index**: `(connection_id, table_name)` — enables upsert-on-conflict pattern.

---

### `column_context`

Business context and data profiles for individual columns.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, CUID2 | |
| `connection_id` | TEXT | NOT NULL, FK → connections(id) CASCADE | |
| `table_name` | TEXT | NOT NULL | |
| `column_name` | TEXT | NOT NULL | |
| `description` | TEXT | nullable | AI or user description |
| `example_values` | TEXT | nullable | JSON array of example strings |
| `data_profile_json` | TEXT | nullable | Profiling data (see structure below) |
| `is_inferred` | INTEGER | NOT NULL, default 1 | |
| `created_at` | INTEGER | NOT NULL | |
| `updated_at` | INTEGER | NOT NULL | |

**Unique index**: `(connection_id, table_name, column_name)`

**`data_profile_json` structure:**
```json
{
  "sampleValues": ["pending", "shipped", "delivered"],
  "distinctCount": 4,
  "nullRate": 0.002,
  "minValue": null,
  "maxValue": null
}
```

For numeric columns, `sampleValues` is empty and `minValue`/`maxValue` are set instead.

---

### `chat_sessions`

One row per chat conversation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, CUID2 | |
| `connection_id` | TEXT | NOT NULL, FK → connections(id) CASCADE | |
| `title` | TEXT | NOT NULL, default `'New Chat'` | AI-generated after first exchange |
| `created_at` | INTEGER | NOT NULL | |
| `updated_at` | INTEGER | NOT NULL | Updated via `touchSession()` on each exchange |

**Cascade**: Deleting a session cascades to `chat_messages` and sets `reports.session_id` to NULL.

---

### `chat_messages`

Individual messages within a session.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, CUID2 | |
| `session_id` | TEXT | NOT NULL, FK → chat_sessions(id) CASCADE | |
| `role` | TEXT | NOT NULL | `'user'`, `'assistant'`, `'system'` |
| `content` | TEXT | NOT NULL | Full message text (markdown for assistant) |
| `sql_blocks_json` | TEXT | NOT NULL, default `'[]'` | JSON array of SQL strings extracted from assistant markdown |
| `created_at` | INTEGER | NOT NULL | |

---

### `llm_settings`

Singleton table — always exactly one row with `id = 'singleton'`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, default `'singleton'` | Always `'singleton'` |
| `provider` | TEXT | NOT NULL, default `'anthropic'` | `'anthropic'`, `'openai'`, `'ollama'` |
| `model` | TEXT | NOT NULL, default `'claude-sonnet-4-6'` | Model identifier string |
| `encrypted_api_key` | TEXT | nullable | AES-256-GCM encrypted API key |
| `ollama_base_url` | TEXT | default `'http://localhost:11434'` | For Ollama provider |
| `max_tokens` | INTEGER | NOT NULL, default `4096` | Max response tokens |
| `temperature` | INTEGER | NOT NULL, default `0` | Stored as `float * 100` (e.g. 0.7 → 70) |
| `chat_history_limit` | INTEGER | NOT NULL, default `20` | Past messages loaded when resuming chat |
| `updated_at` | INTEGER | NOT NULL | |

**Temperature encoding**: The float value `0.7` is stored as integer `70`. The service converts on read/write: `Math.round(input.temperature * 100)` on write, divide by 100 on read.

**Upsert pattern**:
```typescript
db.insert(llmSettings)
  .values({ id: 'singleton', ...data })
  .onConflictDoUpdate({ target: llmSettings.id, set: data })
  .run();
```

---

### `reports`

Saved query results + chart configuration. Called "Pins" in the UI.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, CUID2 | |
| `connection_id` | TEXT | NOT NULL, FK → connections(id) CASCADE | |
| `session_id` | TEXT | FK → chat_sessions(id) SET NULL on delete | nullable |
| `title` | TEXT | NOT NULL | |
| `description` | TEXT | nullable | |
| `sql` | TEXT | NOT NULL | The pinned SQL query |
| `chart_config_json` | TEXT | NOT NULL, default `'{}'` | `{ type, xAxis, yAxis }` |
| `created_at` | INTEGER | NOT NULL | |
| `updated_at` | INTEGER | NOT NULL | |

**`chart_config_json` structure:**
```json
{ "type": "bar", "xAxis": "month", "yAxis": "revenue" }
```

---

### `analysis_jobs`

Tracks background analysis pipeline runs.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, CUID2 | |
| `connection_id` | TEXT | NOT NULL, FK → connections(id) CASCADE | |
| `status` | TEXT | NOT NULL | `'pending'`, `'running'`, `'completed'`, `'failed'` |
| `progress_percent` | INTEGER | NOT NULL, default `0` | 0–100 |
| `current_step` | TEXT | nullable | Human-readable step description |
| `total_tables` | INTEGER | nullable | Set at start of Step 2 |
| `processed_tables` | INTEGER | nullable, default `0` | Incremented per table in Step 2 |
| `error` | TEXT | nullable | Error message if failed |
| `started_at` | INTEGER | nullable | Set when status → 'running' |
| `completed_at` | INTEGER | nullable | Set when status → 'completed' or 'failed' |
| `created_at` | INTEGER | NOT NULL | |

**Index**: `(connection_id, created_at)` — used to find the latest job per connection.

**Terminal statuses**: `'completed'` and `'failed'`. Frontend polling stops when either is reached.

---

### `query_log`

Audit log of all SQL queries executed through the system.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, CUID2 | |
| `connection_id` | TEXT | NOT NULL, FK → connections(id) CASCADE | |
| `session_id` | TEXT | nullable, no FK | Session context (informational only) |
| `query` | TEXT | NOT NULL | The SQL executed |
| `row_count` | INTEGER | nullable | Rows returned on success |
| `execution_time_ms` | INTEGER | nullable | Query duration |
| `error` | TEXT | nullable | Error message if failed |
| `executed_at` | INTEGER | NOT NULL | |

**Index**: `(connection_id, executed_at)` — used for recent query lookups.

Note: `session_id` has no FK constraint — it's informational. Deleting a session does not affect query logs.

---

## Query Helper Patterns

All query helpers live in `packages/db/src/queries/` and are exported from `packages/db/src/index.ts`. Every function takes `db: Database` as the first argument.

### Reading

```typescript
// Returns T | undefined for single rows
findConnectionById(db, id): SelectConnection | undefined

// Returns T[] for lists
findAllConnections(db): SelectConnection[]

// With joins — returns extended type
findAllSessionsSummary(db): SessionSummary[]  // SessionSummary = SelectChatSession & { messageCount: number }
```

### Writing

```typescript
// Insert — returns the inserted row
insertSession(db, data): SelectChatSession

// Update — returns updated row or undefined
updateSessionTitle(db, id, title): SelectChatSession | undefined

// Update with no return
touchSession(db, id): void

// Delete
deleteSession(db, id): void
```

### Upsert (context tables)

```typescript
upsertTableContext(db, {
  connectionId, tableName, description, businessPurpose, isInferred
}): void

upsertColumnContext(db, {
  connectionId, tableName, columnName, description, isInferred
}): void
```

Both use `onConflictDoUpdate` on their unique indexes.

---

## Migrations

Migrations are in `packages/db/src/migrations/`. Each is a `.sql` file generated by Drizzle Kit.

### Workflow

```bash
# 1. Modify schema in packages/db/src/schema/
# 2. Generate migration
pnpm db:generate

# 3. Review the generated SQL in src/migrations/
# 4. Apply to the database
pnpm db:migrate
```

### Migration History

| File | Change |
|---|---|
| `0000_*.sql` | Initial schema (all tables) |
| `0001_*.sql` | Analysis jobs table + data_profile_json on column_context |
| `0005_damp_revanche.sql` | chat_history_limit column on llm_settings |

Never edit migration files after they've been applied. If you need to fix a migration, create a new one.

---

## Adding a New Table

1. Create `packages/db/src/schema/{name}.ts`:

```typescript
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { connections } from './connections';

export const myTable = sqliteTable('my_table', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  value: text('value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type SelectMyTable = typeof myTable.$inferSelect;
export type InsertMyTable = typeof myTable.$inferInsert;
```

2. Export from `packages/db/src/schema/index.ts`

3. Add query helpers in `packages/db/src/queries/my-table.queries.ts`

4. Export from `packages/db/src/index.ts`

5. Run `pnpm db:generate && pnpm db:migrate`

---

## Drizzle Studio

```bash
pnpm db:studio
```

Opens a browser-based database viewer at `https://local.drizzle.studio`. Useful for inspecting data during development.
