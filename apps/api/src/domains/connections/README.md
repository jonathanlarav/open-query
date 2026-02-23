# Domain: Connections

Manages database connection configurations. Credentials are encrypted at rest using AES-256-GCM before being stored in SQLite.

## Files

| File | Purpose |
|---|---|
| `connections.routes.ts` | Fastify route handlers — CRUD + test endpoint |
| `connections.service.ts` | Business logic — create, update, delete, test |
| `connections.schemas.ts` | Re-exports Zod schemas from `@open-query/shared` |
| `connections.types.ts` | Re-exports TypeScript types from `@open-query/shared` |

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/connections` | List all (no credentials) |
| POST | `/api/v1/connections` | Create + encrypt credentials |
| GET | `/api/v1/connections/:id` | Get by ID (no credentials) |
| PUT | `/api/v1/connections/:id` | Update name |
| DELETE | `/api/v1/connections/:id` | Delete |
| POST | `/api/v1/connections/:id/test` | Test live connection |

## Security

- `encryptedCredentials` is never returned in API responses (stripped in `stripCredentials()`)
- Credentials are decrypted only at query/test time inside the connector factory
- See ADR-003 for read-only enforcement details
