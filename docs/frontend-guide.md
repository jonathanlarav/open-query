# Frontend Guide

This document covers the Next.js 15 frontend: pages, components, hooks, state management, and UI conventions.

---

## Tech Stack

| Library | Version | Purpose |
|---|---|---|
| Next.js | 15 | App Router, SSR, file-system routing |
| React | 19 | UI framework |
| TanStack Query | 5 | Server state, data fetching, caching |
| Zustand | 5 | Client UI state |
| Tailwind CSS | 3 | Utility-first styling |
| Lucide React | latest | Icons |
| Recharts | 2 | Charts (bar, line, pie) |
| Vercel AI SDK (`ai/react`) | 4 | `useChat` hook for SSE streaming |
| react-hook-form + zod + @hookform/resolvers | latest | Form validation |
| date-fns | latest | Date formatting |

---

## Directory Structure

```
apps/web/
├── app/
│   ├── layout.tsx             → Root layout (fonts, providers)
│   ├── globals.css            → CSS variables + Tailwind base
│   ├── providers.tsx          → TanStack Query + Zustand providers
│   └── (app)/                 → App layout group (sidebar + main)
│       ├── layout.tsx         → Sidebar + main flex layout
│       ├── chat/
│       │   ├── page.tsx       → Session history list
│       │   └── [sessionId]/page.tsx → Active chat
│       ├── reports/page.tsx   → Pinned reports list
│       ├── settings/page.tsx  → Tabbed settings
│       └── connections/
│           ├── new/page.tsx         → Create connection
│           └── [id]/
│               ├── edit/page.tsx    → Edit connection
│               └── knowledge/page.tsx → Knowledge base viewer
├── components/
│   ├── chat/                  → Chat-specific components
│   ├── charts/                → Chart rendering
│   ├── connections/           → Connection forms + list
│   ├── context/               → Knowledge base viewer
│   ├── reports/               → Report list + detail
│   └── shared/                → Reusable components (sidebar, empty state, errors)
├── hooks/                     → TanStack Query hooks
├── lib/                       → API client, query client, utilities
└── stores/                    → Zustand stores
```

---

## API Client (`apps/web/lib/api-client.ts`)

All API calls go through `apiClient`:

```typescript
import { apiClient } from '@/lib/api-client';

// GET — returns T (unwrapped from { data: T })
const sessions = await apiClient.get<SessionSummary[]>('/chat/sessions');

// POST
const session = await apiClient.post<ChatSession>('/chat/sessions', { connectionId, title });

// PUT
await apiClient.put<Settings>('/settings', { maxTokens: 8192 });

// DELETE — returns void for 204
await apiClient.delete<void>('/chat/sessions/abc123');
```

The client:
- Prepends `/api/v1` to all paths
- Unwraps `{ data: T }` automatically
- Throws `ApiError` (with `.code` and `.statusCode`) on non-2xx responses
- Handles 204 (no-content) responses without attempting JSON parse

---

## Hooks

All hooks are in `apps/web/hooks/`. They wrap TanStack Query and follow consistent patterns.

### `useConnections.ts`

| Hook | Type | Description |
|---|---|---|
| `useConnections()` | Query | All connections |
| `useConnection(id)` | Query | Single connection, enabled only when id truthy |
| `useCreateConnection()` | Mutation | Creates connection; on success triggers `useTriggerAnalysis` |
| `useDeleteConnection()` | Mutation | Deletes connection |
| `useConnectionCredentials(id)` | Query | Decrypted credentials for edit form |
| `useUpdateConnection(id)` | Mutation | Updates name/credentials |
| `useTestConnection()` | Mutation | Tests saved connection |
| `useTestRawCredentials()` | Mutation | Tests credentials before saving |

### `useChat.ts`

| Hook | Type | Description |
|---|---|---|
| `useChatSessions()` | Query | All sessions with message counts |
| `useChatSession(sessionId)` | Query | Single session |
| `useChatMessages(sessionId)` | Query | All messages for a session |
| `useDeleteSession()` | Mutation | Optimistic delete — removes from cache immediately, restores on error |

### `useAnalysis.ts`

| Hook | Type | Description |
|---|---|---|
| `useAnalysis(connectionId)` | Query | Job status; auto-refetches every 3s while `pending` or `running` |
| `useTriggerAnalysis()` | Mutation | Start analysis pipeline |
| `useRetriggerAnalysis()` | Mutation | Force-restart analysis |

### `useSettings.ts`

| Hook | Type | Description |
|---|---|---|
| `useSettings()` | Query | LLM + general settings |
| `useUpdateSettings()` | Mutation | Update settings |
| `useTestLLM()` | Mutation | Test LLM connection |

### `useSchema.ts`

| Hook | Type | Description |
|---|---|---|
| `useSchema(connectionId)` | Query | Latest schema snapshot |
| `useScanSchema()` | Mutation | Trigger a schema re-scan |

### `useQueryExecution.ts`

| Hook | Type | Description |
|---|---|---|
| `useQueryExecution()` | Mutation | Execute a SQL query via `POST /query` |

### `useReports.ts`

| Hook | Type | Description |
|---|---|---|
| `useReports(connectionId?)` | Query | All reports, optional connection filter |
| `useReportSessions()` | Query | Sessions with pins |
| `useReportsBySession(sessionId)` | Query | Pins for a session |
| `useCreateReport()` | Mutation | Pin a query result |
| `useDeleteReport()` | Mutation | Remove a pin |
| `useSuggestPin()` | Mutation | AI-generate pin title/description |

---

## Pages

### `/chat` — `apps/web/app/(app)/chat/page.tsx`

Session history list. Client component.

- `useChatSessions()` — loads all sessions
- `useConnections()` — joined client-side to show connection name/type badge
- `useDeleteSession()` — optimistic delete
- `<NewChatDialog>` — modal opened by "New Chat" button
- Session cards: title, connection badge, `formatReportTime(updatedAt)`, message count, hover-delete with 2-click confirm

### `/chat/[sessionId]` — `apps/web/app/(app)/chat/[sessionId]/page.tsx`

Thin wrapper that passes `sessionId` to `<ChatInterface>`.

### `/reports` — `apps/web/app/(app)/reports/page.tsx`

Pinned reports. Uses `<ReportsList>` component.

### `/settings` — `apps/web/app/(app)/settings/page.tsx`

Tabbed layout. Client component using `useState` for active tab.

| Tab | Component | Description |
|---|---|---|
| General | `<GeneralSettingsForm>` | Chat history limit (expandable) |
| Connections | `<ConnectionList>` + Link to `/connections/new` | Connection CRUD |
| AI Model | `<LLMProviderForm>` | LLM provider config |

### `/connections/new`

Full-page create form with `<ConnectionForm>`. Back link → `/settings`.

### `/connections/[id]/edit`

Full-page edit form with `<EditConnectionForm>`. Back link → `/settings`.

### `/connections/[id]/knowledge`

Full-page knowledge base with `<KnowledgeViewer>`. Back link → `/settings`.

---

## Key Components

### `ChatInterface` (`components/chat/ChatInterface.tsx`)

The core chat UI. Manages:
- `useChatSession(sessionId)` — loads session metadata
- `useChatMessages(sessionId)` — loads persisted messages
- Vercel AI SDK `useChat({ api: '/api/v1/chat', body: { sessionId, connectionId }, initialMessages })` — streaming
- `useQueryExecution()` — runs SQL when user clicks "Run" in a code block
- `<KnowledgePanel>` — right-side panel, open by default
- `<AnalysisBanner>` — top banner showing analysis progress
- `<ResultsPanel>` — bottom panel showing query results + chart builder

**Initial message loading**: `useChatMessages` fetches persisted messages; `initialMessages` is passed to `useChat` to pre-populate the chat. A loading skeleton is shown until `savedMessages !== undefined`.

### `KnowledgePanel` (`components/chat/KnowledgePanel.tsx`)

Right-side panel (default open, default width 624px, drag-resizable 240–1365px).
- Table list view: shows all tables with description status indicators
- Table detail view: columns with types, descriptions, sample values
- Progress bar when analysis is running
- Collapse icon (`PanelRightClose`) in header

### `NewChatDialog` (`components/chat/NewChatDialog.tsx`)

Modal for creating a new chat session.
- Lists connections via `useConnections()`
- On connection click: `POST /chat/sessions` then `router.push(/chat/${session.id})`
- Closes on Escape or click-outside overlay

### `ConnectionList` (`components/connections/ConnectionList.tsx`)

Lists all connections with Test / Knowledge / Edit / Delete actions.
- `AnalysisStatusBadge` — shows analysis job progress per connection
- Uses `useDeleteConnection()`, `useTestConnection()`

### `ConnectionForm` (`components/connections/ConnectionForm.tsx`)

Create connection. DB type selector (4 tiles), dynamic credential fields by type.
- Uses `useCreateConnection()` and `useTestRawCredentials()`
- On success: navigates to `/settings`

### `EditConnectionForm` (`components/connections/EditConnectionForm.tsx`)

Edit connection. Pre-fills from `useConnectionCredentials()`. Type badge is read-only.
- On success: navigates to `/settings`

### `LLMProviderForm` (`components/shared/LLMProviderForm.tsx`)

AI Model settings. Fields: Provider, Model, API Key / Ollama URL, Max Tokens.
- Pre-fills once on load via `initialized` ref (prevents wiping typed API keys on re-render)
- "Test Connection" button triggers `useTestLLM()`

### `GeneralSettingsForm` (`components/shared/GeneralSettingsForm.tsx`)

General settings. Currently: Chat History Limit. Expandable for future settings.

### `ChartBuilder` (`components/charts/ChartBuilder.tsx`)

Renders Recharts charts from `QueryResult`. Supports bar, line, pie.
- User selects X-axis column, Y-axis column
- Y values coerced to number; `NaN` → 0 before rendering
- Tooltip uses `formatter` to guard against NaN display

### `EmptyState` (`components/shared/EmptyState.tsx`)

Standard empty state: centered icon + title + description + optional CTA button or link.

```tsx
<EmptyState
  icon={<MessageSquare className="w-8 h-8" />}
  title="No conversations yet"
  description="Start a new chat to ask questions about your data."
  action={{ label: 'New Chat', onClick: () => setDialogOpen(true) }}
/>
```

### `AppSidebar` (`components/shared/AppSidebar.tsx`)

Main nav sidebar. Nav items: Chat, Pins, Settings. Logo: `BrainCircuit` icon + "Open Query" wordmark.

Active state: `pathname === href || pathname.startsWith(`${href}/`)`

---

## State Management

### TanStack Query Query Keys

Use these exact keys when calling `invalidateQueries` or `setQueryData`:

```typescript
['connections']                          // list
['connections', id]                      // single
['connections', id, 'credentials']       // edit form

['chat', 'sessions']                     // list with counts
['chat', 'sessions', sessionId]          // single session
['chat', 'sessions', sessionId, 'messages']

['schema', connectionId]
['context', connectionId]
['analysis', connectionId]
['settings']
['reports']
['reports', 'sessions']
['reports', 'sessions', sessionId]
```

### Optimistic Updates

`useDeleteSession` uses full optimistic update:
1. `onMutate`: cancel queries, snapshot previous, update cache
2. `onError`: restore from snapshot
3. `onSettled`: invalidate to re-sync from server

Follow this pattern for any delete mutation that needs instant feedback.

---

## UI Conventions

### Design Tokens (CSS Variables)

Always use CSS variables. Never hardcode colors:

```tsx
// ✅ Correct
className="border border-[var(--color-border)] bg-[var(--color-surface)]"
style={{ backgroundColor: 'var(--brand-primary)' }}

// ❌ Wrong
className="border border-gray-200 bg-gray-50"
style={{ backgroundColor: '#4F46E5' }}
```

### Loading States

Every async component must show a skeleton while loading:

```tsx
if (isLoading) {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-[var(--color-surface)] rounded-lg" />
      ))}
    </div>
  );
}
```

### Error Display

Use `<ActionableError>` for query/mutation errors:

```tsx
import { ActionableError } from '@/components/shared/ActionableError';
import { parseApiError } from '@/lib/parse-api-error';

{error && <ActionableError message={parseApiError(error).message} />}
```

`parseApiError` maps known error codes to user-friendly messages with optional CTA links (e.g. LLM errors link to Settings).

### Forms

Use react-hook-form + Zod:

```typescript
const form = useForm<FormValues>({
  resolver: zodResolver(FormSchema),
  defaultValues: { ... },
});

// Pre-fill from API once only
const initialized = useRef(false);
useEffect(() => {
  if (data && !initialized.current) {
    form.reset({ ... });
    initialized.current = true;
  }
}, [data, form]);
```

The `initialized` ref prevents re-resetting when the user has typed into the form.

### Icons

Use Lucide React. Import only what you use:

```typescript
import { Database, MessageSquare, Trash2 } from 'lucide-react';
```

### Spacing (4px grid)

Use Tailwind spacing multiples: `p-1` (4px), `p-2` (8px), `p-4` (16px), `p-6` (24px), `p-8` (32px).

---

## Adding a New Page

1. Create `apps/web/app/(app)/{name}/page.tsx`
2. The `(app)` layout automatically wraps it with the sidebar
3. If it needs data: create a hook in `apps/web/hooks/use{Name}.ts` using `useQuery`/`useMutation`
4. Add a nav entry to `AppSidebar.tsx` if it needs primary navigation

## Adding a New Hook

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { MyType } from '@open-query/shared';

const KEY = ['my-resource'] as const;

export function useMyResource() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get<MyType[]>('/my-resource'),
  });
}

export function useCreateMyResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInput) => apiClient.post<MyType>('/my-resource', data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
```
