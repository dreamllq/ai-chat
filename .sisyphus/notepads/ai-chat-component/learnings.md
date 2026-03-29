# Learnings — ai-chat-component

## 2026-03-28 Session Start
- Greenfield project: only .gitignore, README.md, LICENSE exist
- Plan: Vue3 + Element Plus + TypeScript AI Chat component library
- pnpm monorepo: packages/ai-chat (library) + apps/demo
- Key deps: dexie (IndexedDB), langchain.js (AI), markdown-it + highlight.js (rendering)
- TDD approach: Vitest + Vue Test Utils + fake-indexeddb

## 2026-03-29 useModel Composable
- useObservable wraps Dexie liveQuery into Vue ref: call liveQuery(querier), subscribe to observable, update ref on next, unsubscribe on onUnmounted
- Dexie liveQuery emits asynchronously — don't rely on models.value being updated immediately after a DB mutation in the same sync tick
- In deleteModel, filter out deleted model from models.value before selecting fallback (liveQuery hasn't emitted yet)
- Dexie toArray() order is not guaranteed by insertion order — tests must be order-agnostic
- Testing composables with lifecycle hooks (onUnmounted): must use withSetup pattern mounting a real component via @vue/test-utils mount()
- liveQuery is re-exported from services/database.ts

## 2026-03-29 useSession Composable
- **CRITICAL**: Dexie `liveQuery` does NOT track Vue reactive refs. If the querier closure reads a Vue `ref.value`, the query won't re-run when the ref changes — only Dexie table mutations trigger re-runs.
- For queries depending on Vue refs (e.g., `currentConversationId`), use `watch()` to create/destroy `liveQuery` subscriptions manually when the ref changes.
- `useObservable` works well for static queries (like `getAll()`) but not for parameterized queries driven by Vue state.
- `deleteConversation` auto-switch logic: must query DB directly (`conversationService.getAll()`) instead of reading the stale `conversations.value` ref — liveQuery hasn't propagated yet at that point.
- Test flush pattern: `vi.waitFor(() => {}, { timeout: 200 }).catch(() => {})` + `setTimeout(r, 50)` + `nextTick()` needed for Dexie liveQuery to propagate in jsdom.
- `defineComponent` must be imported from `vue`, NOT from `@vue/test-utils`.
- `withSetup` helper must use `h('div')` not `() => null` for proper rendering.
- Initial `conversations.value` is `undefined` before liveQuery first emission — use `?? []` in assertions.
- Total tests: 99 (10 useSession + 8 useModel + 81 original) — all pass.

## 2026-03-29 useChat Composable
- **Testing composables that depend on other composables**: Use `vi.hoisted()` + `vi.mock()` to mock `useSession`/`useModel` return values. Create fresh mock refs in `beforeEach` and configure mock return values.
- **Message timestamp ordering**: Messages created in the same JS tick can have the same `Date.now()` timestamp. When querying by timestamp sort, order is not guaranteed. Use `.find(m => m.role === ...)` instead of index-based assertions.
- **AsyncGenerator testing**: Create helper `createMockStream(chunks)` that yields ChatChunk objects. For abort testing, make generator wait on signal and check `signal.aborted`.
- **AbortController pattern**: Use plain `let` variable (not `ref`) for AbortController — it doesn't need Vue reactivity. Call `abort()` in `onUnmounted` for cleanup.
- **Agent not found**: Don't throw — create assistant message with error content. This keeps chat UI consistent.
- **Streaming flow**: save user msg → create placeholder assistant msg (isStreaming:true) → stream tokens updating content → on done/error set isStreaming:false. Query DB for history (not reactive ref) to ensure just-saved user message is included.
- **Total tests: 110** (11 useChat + 10 useSession + 8 useModel + 8 useLocale + 81 original) — all pass.

## 2026-03-29 useChat Composable
- **Implementation diverges from plan spec** in several important ways — the implementation is more robust:
  - Plan spec uses `currentMessages.value!` for agent context; implementation queries DB directly via `messageService.getByConversationId()` to include just-saved user message
  - Plan spec uses `throw new Error('Agent not found')`; implementation creates assistant error message (no throw) for consistent UI
  - Plan spec uses `ref<AbortController | null>`; implementation uses plain `let` variable (no Vue reactivity needed for AbortController)
  - Plan spec has only `try/finally`; implementation has `try/catch/finally` to write errors to assistant message
  - Implementation adds `onUnmounted` cleanup to abort ongoing streams on component destroy
  - Implementation filters out placeholder assistant message from context sent to agent
- **Mocking composables with vi.hoisted**: Use `vi.hoisted(() => ({ useSession: vi.fn(), useModel: vi.fn(), getRunner: vi.fn() }))` then `vi.mock('../useSession', () => ({ useSession: mocks.useSession }))`. This works because hoisted values are available in hoisted mock factories.
- **Mock refs pattern**: Create real `ref()` objects in `beforeEach`, set them as `mockReturnValue` on the mocked functions. Tests can update ref values directly (`currentModel.value = undefined`).
- **TS error with vi.fn() mocks**: `AgentRunner.chat` typed as interface method can't access `.mock` property. Fix: extract spy as separate `const chatSpy = vi.fn()`, then use `chatSpy.mock.calls[0][0]`.
- **Abortable stream testing**: Generator that awaits a Promise resolved by signal abort listener. Pattern: `signal?.addEventListener('abort', () => resolve())` then check `signal?.aborted` before yielding more.
- **Error message format**: Implementation uses `⚠️ Error:` prefix for stream errors and `Error:` for non-stream errors. Tests check `toContain()` not exact match.
- **Build TS check**: `vite-plugin-dts` generates `.d.ts` from all `.ts` files including tests. TS errors in test files will fail the build.

## 2026-03-29 Sidebar Component
- **Component mocking pattern**: Use vi.mock() for composables (useSession, useLocale) with real ref() objects in module scope. Tests can mutate .value directly.
- **Element Plus stubs**: Create simple stub components with template/props/emits. ElPopconfirm needs #reference slot via template.
- **ElPopconfirm stub testing**: Stub emits confirm event — call popconfirm.vm.$emit('confirm') then await nextTick() to trigger delete.
- **Inline rename pattern**: Use editingId ref to toggle between display and ElInput. Double-click sets editingId, Enter/blur calls confirmRename and resets.
- **conversations.value is undefined initially**: Use computed(() => conversations.value ?? []) for the template list. Test undefined case separately.
- **Total tests: 165** (11 Sidebar + 154 previous) — all pass. Pre-existing failures: ChatInput.test.ts, ChatMessage.test.ts (components not yet created).
