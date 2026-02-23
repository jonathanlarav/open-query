# Open Query — CLAUDE.md

AI agent coding guide. Read this before making any changes.

## Project Overview

Open Query is an open-source, self-hostable data exploration tool. Users connect to SQL/NoSQL databases, enrich the schema with business context, then use a natural-language chat interface to generate SQL, run queries, and produce charts and reports — all read-only.

**Full documentation index:**
- `docs/architecture.md` — System design, data flows, security model, patterns
- `docs/api-reference.md` — Every API route and service method
- `docs/frontend-guide.md` — Pages, components, hooks, state management
- `docs/database-schema.md` — All tables, columns, relationships, migration guide
- `docs/decisions/` — Architecture Decision Records

---

## Monorepo Structure

```
apps/web/       → Next.js 15 App Router frontend (port 3000)
apps/api/       → Fastify 5 backend (port 3001)
packages/db/    → Drizzle ORM schema + migrations (SQLite internal store)
packages/shared → Cross-package TypeScript types + Zod schemas (source of truth)
packages/config → Shared eslint, tsconfig, tailwind configs
```

---

## Commands

```bash
pnpm dev              # Start all apps
pnpm build            # Build all apps
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm typecheck        # TypeScript check all — run this after every change
pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:migrate       # Apply pending migrations
pnpm db:studio        # Open Drizzle Studio (browser DB viewer)
```

**Always run `pnpm typecheck` after making changes to confirm no type errors.**

---

## Where Things Live

### Adding a new API feature

1. Service: `apps/api/src/domains/{domain}/{domain}.service.ts`
2. Routes: `apps/api/src/domains/{domain}/{domain}.routes.ts`
3. Register route in: `apps/api/src/server.ts`
4. Shared types: `packages/shared/src/types/{domain}.types.ts` → export from `packages/shared/src/index.ts`

### Adding a new DB table

1. Schema: `packages/db/src/schema/{name}.ts` → export from `packages/db/src/schema/index.ts`
2. Queries: `packages/db/src/queries/{name}.queries.ts` → export from `packages/db/src/index.ts`
3. Run `pnpm db:generate && pnpm db:migrate`

### Adding a new frontend page

1. Page: `apps/web/app/(app)/{name}/page.tsx`
2. Hook (if needed): `apps/web/hooks/use{Name}.ts`
3. Nav entry (if primary nav): `apps/web/components/shared/AppSidebar.tsx`

### Adding a new settings tab

1. Create component: `apps/web/components/shared/{Name}SettingsForm.tsx`
2. Add tab entry to TABS array in `apps/web/app/(app)/settings/page.tsx`
3. Render the component in the content section

---

## Key Conventions

### File Naming

```
{domain}.routes.ts     → Fastify route registrations
{domain}.service.ts    → Business logic
{domain}.queries.ts    → Drizzle query helpers (packages/db only)
{domain}.schemas.ts    → Zod validation schemas
{domain}.types.ts      → TypeScript-only types
{domain}.service.test.ts → Co-located unit tests
```

**200-line limit per file** — split into helpers if needed.

### Types — Zod is the Source of Truth

```typescript
// 1. Define in packages/shared/src/types/
export const CreateFooSchema = z.object({ name: z.string().min(1) });
export type CreateFooInput = z.infer<typeof CreateFooSchema>;

// 2. Use in API
import { CreateFooSchema } from '@open-query/shared';
const body = CreateFooSchema.parse(req.body);

// 3. Use in frontend
import type { CreateFooInput } from '@open-query/shared';
```

- `any` is **forbidden** — use explicit types, `unknown` + type guards, or generics
- All discriminated union variants must use Zod discriminated unions

### Service Pattern (Constructor Injection)

```typescript
export class FooService {
  constructor(private readonly db: Database) {}
  list() { return findAllFoos(this.db); }
}

// In route — create per-request, never singleton
fastify.get('/', async (_req, reply) => {
  return reply.send({ data: new FooService(getDb()).list() });
});
```

### API Response Shape

```typescript
// Success
{ "data": T, "meta"?: { "page": 1, "pageSize": 20, "total": 100 } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

Every route wraps its return in `{ data: result }`. Never return bare objects.

### Throwing Errors in Services

```typescript
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

throw new AppError({
  code: ErrorCode.NOT_FOUND,
  message: `Connection not found: ${id}`,
  statusCode: 404,
});
```

### DB Query Helpers

All query functions take `db: Database` as first parameter:

```typescript
export function findFooById(db: Database, id: string): SelectFoo | undefined {
  return db.select().from(foos).where(eq(foos.id, id)).get();
}
```

Use `.get()` for single row, `.all()` for lists, `.run()` for mutations with no return.

### DB Schema — New Tables

```typescript
import { createId } from '@paralleldrive/cuid2';
import { connections } from './connections';

export const myTable = sqliteTable('my_table', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  // ...
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

Always use CUID2 for IDs. Always add `{ onDelete: 'cascade' }` on FK references to connections.

---

## Security Rules — Do Not Break These

1. **Never return `encryptedCredentials`** from any endpoint. Call `stripCredentials()` or manually exclude.
2. **All SQL must pass `validateReadOnly()`** before execution — already enforced in `QueryService`.
3. **Never call `getLanguageModel()` without checking settings exist** — throw `LLM_ERROR` if null.
4. **MASTER_KEY is required** — `apps/api/src/server.ts` fails fast on startup. Don't weaken this.

---

## Design System

- **4px grid** — Tailwind multiples: `p-1`=4px, `p-2`=8px, `p-4`=16px, `p-6`=24px, `p-8`=32px
- **Borders over shadows** — `border border-[var(--color-border)] rounded-lg`
- **CSS variables** — Always `var(--brand-primary)` not `#4F46E5`. See `apps/web/app/globals.css`
- **Skeleton loading** — Every async component shows animated skeleton while loading
- **Empty states** — Use `<EmptyState icon title description action />` component
- **Icons** — Lucide React only. Import what you use.
- **Font** — Inter via `next/font/google`
- **WCAG AA** minimum contrast

### Active nav/tab style

```tsx
activeTab === id
  ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary)] font-medium'
  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
```

---

## Frontend Patterns

### TanStack Query hooks

```typescript
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

const KEY = ['resource'] as const;

export function useResource() {
  return useQuery({ queryKey: KEY, queryFn: () => apiClient.get<T[]>('/resource') });
}

export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Input) => apiClient.post<T>('/resource', data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

### Optimistic delete pattern

```typescript
export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/resource/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<T[]>(KEY);
      qc.setQueryData<T[]>(KEY, old => (old ?? []).filter(r => r.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => { if (ctx?.previous) qc.setQueryData(KEY, ctx.previous); },
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

### Form pre-fill pattern

```typescript
const initialized = useRef(false);
useEffect(() => {
  if (data && !initialized.current) {
    form.reset({ field: data.field });
    initialized.current = true;
  }
}, [data, form]);
```

The `initialized` ref prevents wiping user input on re-renders.

### Component structure

```tsx
'use client';

export function MyComponent() {
  const { data, isLoading } = useMyData();

  if (isLoading) return <Skeleton />;
  if (!data?.length) return <EmptyState ... />;

  return <div>...</div>;
}
```

---

## Current Feature Status

### Implemented
- Connection CRUD (Postgres, MySQL, SQLite, MongoDB)
- Schema scanning (per-connection introspection)
- Business context (table + column descriptions, AI-generated)
- Analysis pipeline (schema scan → data profiling → LLM enrichment → FK relationships)
- Chat with AI (streaming, session history, persisted messages, auto-title)
- Query execution (read-only enforced, result table + chart builder)
- Pinned reports (save query + chart, export CSV/JSON)
- Settings: LLM provider (Anthropic/OpenAI/Ollama), General (chat history limit)
- Knowledge base panel (inline in chat, standalone viewer page)

### Known Pre-existing Issue
`apps/api/src/infrastructure/connectors/factory.ts` lines 15, 17, 19, 21 — `Parameters<typeof XConnector>` type constraint error. Pre-existing, not blocking runtime behavior.

---

## Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MASTER_KEY` | **Yes** | — | Min 16 chars. App exits on startup if missing. |
| `DATABASE_URL` | No | `file:./data/openquery.db` | SQLite internal store path |
| `API_PORT` | No | `3001` | Fastify port |
| `NODE_ENV` | No | `development` | Affects CORS |

---

## ADRs

- `docs/decisions/ADR-001-monorepo.md` — Turborepo monorepo structure
- `docs/decisions/ADR-002-sqlite-internal-store.md` — SQLite for metadata
- `docs/decisions/ADR-003-read-only-enforcement.md` — Multi-layer read-only
