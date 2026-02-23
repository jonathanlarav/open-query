# AGENTS.md — Open Query

Instructions for AI coding agents. Read this before making any changes to this repository.

For deeper context on any topic, see:
- `CLAUDE.md` — Detailed conventions, patterns, and current feature status
- `docs/architecture.md` — System design, data flows, security model
- `docs/api-reference.md` — Every API route and service method
- `docs/frontend-guide.md` — Pages, components, hooks
- `docs/database-schema.md` — All tables, columns, migration guide

---

## What This Project Is

Open Query is a self-hostable natural language data exploration tool. Users connect databases, the AI generates SQL from plain-English questions, results are displayed with charts, and queries can be pinned as reports. All database access is strictly read-only.

**Stack**: Next.js 15 (frontend) · Fastify 5 (API) · SQLite/Drizzle (internal store) · Vercel AI SDK (LLM streaming) · TanStack Query (frontend data fetching)

---

## Verify Your Changes

After **every** change, run:

```bash
pnpm typecheck   # Must pass with zero new errors
```

For larger changes also run:

```bash
pnpm lint        # ESLint across all packages
pnpm test        # Unit tests
pnpm build       # Full production build
```

If you modify `packages/db/src/schema/`, you must also run:

```bash
pnpm db:generate   # Generate migration SQL
pnpm db:migrate    # Apply to the SQLite file
```

---

## Repository Layout

```
apps/api/src/
  server.ts                        ← Entry point, route registration, startup checks
  domains/{name}/
    {name}.service.ts              ← Business logic (constructor-injected db)
    {name}.routes.ts               ← Fastify route handlers
    {name}.schemas.ts              ← Zod input validation
  infrastructure/
    connectors/                    ← DB drivers (postgres, mysql, sqlite, mongodb)
    llm/                           ← Prompt builder, SQL extractor, provider factory
    crypto/                        ← AES-256-GCM encryption/decryption

apps/web/
  app/(app)/                       ← All app pages (share sidebar layout)
  components/                      ← React components
  hooks/                           ← TanStack Query hooks (one file per domain)
  lib/api-client.ts                ← Fetch wrapper, unwraps { data: T }
  stores/                          ← Zustand client state

packages/db/src/
  schema/                          ← Drizzle table definitions (one file per table)
  queries/                         ← Typed query helper functions
  migrations/                      ← Auto-generated SQL migration files
  client.ts                        ← SQLite singleton (initDatabase / getDb)

packages/shared/src/
  types/                           ← Zod schemas + inferred TS types
  constants/                       ← Enums (ConnectionType, LLMProvider)
  index.ts                         ← Single export point for all shared types
```

---

## Critical Rules

### Never break these — they are security invariants

1. **Never return `encryptedCredentials`** in any API response. Strip it before returning connection objects.
2. **Never skip `validateReadOnly()`** before executing SQL. It is already called in `QueryService` — do not bypass it.
3. **Never weaken the `MASTER_KEY` startup check** in `apps/api/src/server.ts`. The app must exit if it is missing.
4. **Never call `getLanguageModel(settings)`** if `settings` is null — throw `AppError` with `ErrorCode.LLM_ERROR` instead.
5. **Never commit `.env` files** — the `.gitignore` excludes them. Verify with `git add --dry-run .` before committing.

---

## Key Patterns

### API service (constructor injection)
```typescript
export class FooService {
  constructor(private readonly db: Database) {}
  list() { return findAllFoos(this.db); }
}
// In route:
fastify.get('/', async (_req, reply) =>
  reply.send({ data: new FooService(getDb()).list() })
);
```

### API response shape
```typescript
{ data: T }             // success
{ error: { code, message, details? } }  // error — thrown via AppError
```

### Zod is the type source of truth
```typescript
// packages/shared — define once
export const CreateFooSchema = z.object({ ... });
export type CreateFooInput = z.infer<typeof CreateFooSchema>;
// API — parse input
const body = CreateFooSchema.parse(req.body);
// Frontend — import type only
import type { CreateFooInput } from '@open-query/shared';
```

### DB query helpers
```typescript
findFooById(db, id)      // → T | undefined   (use .get())
findAllFoos(db)          // → T[]             (use .all())
insertFoo(db, data)      // → T               (use .returning().get())
deleteFoo(db, id)        // → void            (use .run())
```

### Frontend hook
```typescript
'use client';
export function useFoo() {
  return useQuery({ queryKey: ['foo'], queryFn: () => apiClient.get<Foo[]>('/foo') });
}
export function useCreateFoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Input) => apiClient.post<Foo>('/foo', data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['foo'] }),
  });
}
```

### UI component structure
```tsx
'use client';
export function MyComponent() {
  const { data, isLoading } = useFoo();
  if (isLoading) return <Skeleton />;       // always show skeleton
  if (!data?.length) return <EmptyState />; // always handle empty
  return <div>...</div>;
}
```

---

## Common Tasks

### Add a new API endpoint
1. Add service method to `apps/api/src/domains/{domain}/{domain}.service.ts`
2. Add route to `apps/api/src/domains/{domain}/{domain}.routes.ts`
3. If new domain: register in `apps/api/src/server.ts`
4. Add shared types to `packages/shared/src/types/` and export from `packages/shared/src/index.ts`

### Add a new database table
1. Create `packages/db/src/schema/{name}.ts` — use CUID2 for PK, add `{ onDelete: 'cascade' }` on connection FK
2. Export from `packages/db/src/schema/index.ts`
3. Add query helpers in `packages/db/src/queries/{name}.queries.ts`
4. Export from `packages/db/src/index.ts`
5. Run `pnpm db:generate && pnpm db:migrate`

### Add a new frontend page
1. Create `apps/web/app/(app)/{name}/page.tsx`
2. Add hook in `apps/web/hooks/use{Name}.ts` if data fetching is needed
3. Add to sidebar nav in `apps/web/components/shared/AppSidebar.tsx` if it's a primary destination

### Add a new settings section
1. Create `apps/web/components/shared/{Name}SettingsForm.tsx`
2. Add entry to `TABS` array in `apps/web/app/(app)/settings/page.tsx`
3. Render the component in the content section of `settings/page.tsx`

### Modify LLM settings fields
- DB column: `packages/db/src/schema/llm-settings.ts` → run migration
- API validation: `apps/api/src/domains/settings/settings.service.ts` (`UpdateSettingsSchema` + `getDefaults()`)
- Frontend type: `apps/web/hooks/useSettings.ts` (`LLMSettings` interface)
- Frontend form: `apps/web/components/shared/LLMProviderForm.tsx` or `GeneralSettingsForm.tsx`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MASTER_KEY` | **Yes** | — | Min 16 chars. Derives 32-byte AES encryption key. Startup fails if absent. |
| `DATABASE_URL` | No | `file:./data/openquery.db` | Path to SQLite metadata database |
| `API_PORT` | No | `3001` | Fastify listen port |
| `NODE_ENV` | No | `development` | Affects CORS policy |

---

## Known Issues

- `apps/api/src/infrastructure/connectors/factory.ts` lines 15, 17, 19, 21 — pre-existing TypeScript error (`Parameters<typeof XConnector>` constraint). Does not affect runtime. Do not attempt to fix unless specifically tasked.
