# Open Query

Open Query is an open-source, self-hostable natural language data exploration tool. Connect to any SQL or NoSQL database, enrich the schema with business context, then chat with your data — the AI generates SQL, executes queries, and produces charts and reports, all in a read-only, secure interface.

## Features

- **Natural language chat** — Ask questions in plain English; the LLM generates and executes SQL
- **Multi-database support** — PostgreSQL, MySQL, SQLite, MongoDB
- **AI-powered schema analysis** — Automatic data profiling, column descriptions, and business context
- **Knowledge base** — Per-connection schema context visible in every chat session
- **Pinned reports** — Save query + chart results as persistent reports
- **Pluggable LLM providers** — Anthropic, OpenAI, or local Ollama
- **Read-only by design** — Four enforcement layers prevent any write operations
- **Self-hostable** — Single SQLite file for metadata, no external services required

## Monorepo Structure

```
open-query/
├── apps/
│   ├── web/          → Next.js 15 frontend (App Router, port 3000)
│   └── api/          → Fastify 5 backend (port 3001)
├── packages/
│   ├── db/           → Drizzle ORM schema, migrations, query helpers (SQLite)
│   ├── shared/       → Zod schemas + TypeScript types shared across packages
│   └── config/       → Shared ESLint, tsconfig, Tailwind configs
└── docs/
    ├── decisions/    → Architecture Decision Records (ADRs)
    ├── architecture.md
    ├── api-reference.md
    ├── frontend-guide.md
    └── database-schema.md
```

## Quick Start

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- An LLM provider API key (Anthropic, OpenAI) or local Ollama

### Installation

```bash
# Clone the repo
git clone https://github.com/your-org/open-query.git
cd open-query

# Install dependencies
pnpm install

# Set environment variables
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — at minimum set MASTER_KEY
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MASTER_KEY` | **Yes** | — | Minimum 16 chars. Derives the 32-byte AES key for credential encryption. App fails to start if missing. |
| `DATABASE_URL` | No | `file:./data/openquery.db` | SQLite file path for internal metadata |
| `API_PORT` | No | `3001` | Fastify server port |
| `NODE_ENV` | No | `development` | Affects CORS policy and logging |

### Database Setup

```bash
# Generate and apply migrations
pnpm db:generate
pnpm db:migrate
```

### Development

```bash
pnpm dev   # Starts both web (3000) and api (3001) concurrently
```

### Production Build

```bash
pnpm build
```

## Common Commands

```bash
pnpm dev              # Start all apps in watch mode
pnpm build            # Build all apps
pnpm typecheck        # TypeScript check all packages
pnpm lint             # ESLint all packages
pnpm test             # Run all tests
pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:migrate       # Apply pending migrations
pnpm db:studio        # Open Drizzle Studio (browser DB viewer)
```

## Architecture Overview

```
Browser ──► Next.js (3000)
              │  rewrites /api/* → http://localhost:3001/api/*
              ▼
           Fastify API (3001)
              │
              ├── /api/v1/connections   → ConnectionsService
              ├── /api/v1/schema        → SchemaService
              ├── /api/v1/context       → ContextService
              ├── /api/v1/chat          → ChatService (SSE streaming)
              ├── /api/v1/query         → QueryService
              ├── /api/v1/reports       → ReportsService
              ├── /api/v1/settings      → SettingsService
              └── /api/v1/analysis      → AnalysisService
                      │
                      ├── @open-query/db  (SQLite via Drizzle)
                      ├── Database connectors (pg / mysql2 / better-sqlite3 / mongodb)
                      └── LLM providers (Anthropic / OpenAI / Ollama via Vercel AI SDK)
```

### Key Design Decisions

- **SQLite for metadata** — Zero-dependency internal store. See ADR-002.
- **Read-only enforcement** — Four layers: UI hint → connector flag → keyword regex → AST parse. See ADR-003.
- **Vercel AI SDK** — Provides a unified streaming interface across all LLM providers.
- **Zod as single source of truth** — All types derived from `z.infer<>`, shared via `@open-query/shared`.
- **Constructor injection** — All services take `db: Database` in constructor; no global singletons in service layer.

## Documentation Index

| Document | Description |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System design, data flows, security model, patterns |
| [docs/api-reference.md](docs/api-reference.md) | Every API route, service method, request/response shape |
| [docs/frontend-guide.md](docs/frontend-guide.md) | Pages, components, hooks, state management |
| [docs/database-schema.md](docs/database-schema.md) | All tables, columns, relationships, migration guide |
| [docs/decisions/](docs/decisions/) | Architecture Decision Records |
| [CLAUDE.md](CLAUDE.md) | AI agent coding conventions and rules |

## Security Model

1. **UI layer** — System prompt instructs LLM to only generate SELECT statements
2. **Connector layer** — PostgreSQL and MySQL connections opened in read-only transaction mode; SQLite opened with `readonly: true`
3. **Keyword layer** — Regex fast-check rejects INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, EXEC
4. **AST layer** — `node-sql-parser` parses query and verifies `type === 'select'`

Database credentials are encrypted with AES-256-GCM before being stored. The `MASTER_KEY` environment variable is hashed via SHA-256 to derive the 32-byte key. The encrypted key is never returned to the frontend.

## Contributing

1. Follow the conventions in [CLAUDE.md](CLAUDE.md)
2. Add a migration when modifying the DB schema (`pnpm db:generate && pnpm db:migrate`)
3. Keep files under 200 lines — split into helpers when needed
4. All types must derive from Zod schemas in `@open-query/shared`
5. `any` is forbidden — use explicit TypeScript types everywhere
