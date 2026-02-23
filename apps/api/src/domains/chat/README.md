# Domain: Chat

Handles the natural language → SQL chat interface. Uses the Vercel AI SDK (`streamText`) to stream responses from the configured LLM provider.

## Files

| File | Purpose |
|---|---|
| `chat.routes.ts` | Fastify routes — sessions CRUD + streaming chat endpoint |
| `chat.service.ts` | Loads schema + context, builds prompt, streams LLM response, persists messages |

## SQL Generation Flow

```
User message
  → chat.service.ts: load schema snapshot + business context
  → prompt-builder.ts: build system prompt with schema + context
  → streamText(model, systemPrompt, messages)
  → Streaming SSE response
  → Frontend: SqlBlock components with "Run Query" button
  → POST /api/v1/query → read-only validation → execute
```

## Streaming

The chat route uses `streamText` from the Vercel AI SDK. The AI SDK's `toDataStreamResponse()` is piped directly to Fastify's raw Node.js `res` stream. This avoids buffering the full response.

## Message Persistence

Messages are persisted to SQLite on completion via the `onFinish` callback. SQL blocks are extracted from the assistant response and stored in `sqlBlocksJson` for replay.
