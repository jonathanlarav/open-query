# Domain: Query

Executes validated SQL queries against user databases. This is the security boundary between LLM output and the user's database.

## Files

| File | Purpose |
|---|---|
| `query.routes.ts` | POST /api/v1/query handler |
| `query.service.ts` | Validation → connector → execute |

## Security Layers

1. Zod validates the request shape
2. `validateReadOnly()` (AST + keyword blocklist) rejects any non-SELECT
3. Connector-level read-only enforcement at the driver
4. `LIMIT` is injected if not already present (max 10,000 rows)

## Response Shape

```typescript
{
  data: {
    columns: Array<{ name: string; dataType?: string }>;
    rows: Array<Record<string, unknown>>;
    rowCount: number;
    executionTimeMs: number;
  }
}
```
