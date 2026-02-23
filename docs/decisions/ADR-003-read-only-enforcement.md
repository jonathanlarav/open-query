# ADR-003: Multi-Layer Read-Only Enforcement

**Date:** 2026-02-21
**Status:** Accepted

## Context

open-query sends LLM-generated SQL directly to user databases. If the LLM generates a `DROP TABLE` or `DELETE` statement (by mistake or via prompt injection), it could cause irreversible data loss. This is unacceptable.

## Decision

Enforce read-only access at **four independent layers**:

### Layer 1: UI Guidance
The connection form recommends creating a read-only database user. This is advisory only but sets expectations.

### Layer 2: Connector-Level Enforcement
Each database connector enforces read-only mode at the driver level:
- **PostgreSQL**: `SET default_transaction_read_only = on` before every query
- **SQLite**: `readonly: true` flag in the `better-sqlite3` constructor
- **MySQL**: `SET SESSION TRANSACTION READ ONLY` before every query
- **MongoDB**: `readPreference: 'secondaryPreferred'` in the MongoClient

### Layer 3: Keyword Blocklist (Fast Path)
Before AST parsing, a regex pre-check rejects queries containing write keywords:
```
/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|...)\b/i
```
This is fast and catches obvious cases before incurring AST parsing overhead.

### Layer 4: AST Validation
`node-sql-parser` parses the SQL into an AST and verifies the root statement type is `select`. This catches obfuscated attempts like `/* INSERT */ SELECT ...` being reinterpreted.

### Error Response
Any read-only violation returns:
```json
{ "error": { "code": "READONLY_VIOLATION", "message": "Only SELECT statements are allowed" } }
```

## Consequences

**Benefits:**
- Defense-in-depth: an LLM generating a write statement will be caught at multiple layers
- Connector-level enforcement means even if all application-level checks fail, the DB driver still blocks writes
- Fast keyword blocklist avoids AST overhead for the common case

**Drawbacks:**
- Layer 4 (AST parsing) may fail for complex or dialect-specific SQL; the connector layer is the true safety net
- Some read-only analytical queries (e.g. `EXPLAIN`, `SHOW`) may be blocked by the keyword check

## Alternatives Considered

- **Application-only check**: Rejected — a single check point is insufficient for security-critical enforcement
- **Separate read-only DB user only**: Rejected — doesn't protect against users who use their admin credentials
- **Sandbox/transaction rollback**: Rejected — adds complexity and doesn't prevent temporary table-lock damage
