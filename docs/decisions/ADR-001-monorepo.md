# ADR-001: Monorepo with Turborepo + pnpm

**Date:** 2026-02-21
**Status:** Accepted

## Context

open-query requires a web frontend (Next.js), an API backend (Fastify), and shared packages (DB schema, types). These can be organized as separate repos or a monorepo.

## Decision

Use a **pnpm workspace monorepo** orchestrated by **Turborepo**.

Structure:
- `apps/web` — Next.js 15 frontend
- `apps/api` — Fastify backend
- `packages/db` — Drizzle schema + queries
- `packages/shared` — Cross-package TypeScript types
- `packages/config` — Shared eslint/tsconfig/tailwind

## Consequences

**Benefits:**
- Single `pnpm install` installs everything
- `packages/shared` types are shared between frontend and backend with zero duplication
- Turborepo's task graph ensures correct build order (`shared` builds before `api` and `web`)
- Incremental builds via Turborepo caching
- Single PR includes full-stack changes

**Drawbacks:**
- Initial setup complexity vs. separate repos
- All contributors need to install the full toolchain

## Alternatives Considered

- **Separate repos**: Rejected because sharing types across repos requires publishing to npm, which adds friction for an open-source project
- **Nx**: Rejected in favour of Turborepo's simpler config and better pnpm compatibility
