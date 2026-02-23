# ADR-002: SQLite for Internal Metadata Store

**Date:** 2026-02-21
**Status:** Accepted

## Context

open-query needs to store internal metadata: connection configs, schema snapshots, business context annotations, chat sessions, reports, and LLM settings. We need a storage engine that works out-of-the-box for self-hosting without requiring users to provision a separate database service.

## Decision

Use **SQLite via Drizzle ORM + better-sqlite3** for the internal metadata store.

Database file path: `./data/openquery.db` (configurable via `DATABASE_URL` env var).

## Consequences

**Benefits:**
- Zero external dependencies — users just run `docker-compose up` or `node dist/server.js`
- File-based storage is easy to back up (copy one `.db` file)
- Drizzle ORM provides type-safe queries and migration management
- `better-sqlite3` is synchronous, avoiding callback complexity for an internal store
- WAL mode enabled for better concurrent read performance
- Foreign keys enforced at the SQLite driver level

**Drawbacks:**
- Not suitable for multi-instance deployments (horizontal scaling requires switching to Postgres)
- No built-in replication
- Large schema snapshots stored as JSON blobs in TEXT columns

## Alternatives Considered

- **PostgreSQL for internal store**: Rejected — would require users to provision Postgres just to run the app; violates self-hosting simplicity goal
- **LevelDB / RocksDB**: Rejected — less familiar, harder to introspect, no migration story
- **In-memory / JSON files**: Rejected — no ACID guarantees, harder to query

## Migration Path

If multi-instance deployments become a requirement, the Drizzle schema is database-agnostic. Switching to PostgreSQL would require changing the Drizzle dialect and updating `DATABASE_URL` — all query logic remains unchanged.
