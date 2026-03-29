# @ai-chat/vue — Package Knowledge Base

**Generated:** 2026-03-29
**Commit:** e1a90c2

## OVERVIEW

Vue 3 AI chat component library distributed as `@ai-chat/vue`. Dual ESM + UMD build, Element Plus as peer dep, Dexie/IndexedDB for persistence, LangChain.js for AI integration.

## STRUCTURE

```
src/
├── components/     # 10 Vue SFCs — AiChat (main), AiChatProvider, LayoutShell,
│                  #   Sidebar, ChatMessageList, ChatMessage, ChatInput,
│                  #   ModelSelector, ModelManager, AgentSelector
├── composables/    # 5 composables — useChat, useSession, useModel, useLocale, useObservable
├── agents/         # AgentRunner interface + LangChainChatAgent (built-in)
├── services/       # AgentRegistry singleton + database CRUD services (4 classes)
├── database/       # Dexie schema (4 tables, compound index on messages)
├── locales/        # zh-cn, en, ja locale files + injection key
├── types/          # Shared interfaces (ChatMessage, Conversation, ModelConfig, etc.)
└── index.ts        # Public API surface + side-effect agent registration
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new component | `src/components/` | Also export from `index.ts` |
| Add new composable | `src/composables/` | Module-level `ref()` singleton pattern, export `_reset*State()` |
| Add new agent type | `src/agents/` | Implement `AgentRunner.chat()` → `AsyncGenerator<ChatChunk>` |
| Modify DB schema | `src/database/db.ts` | Add Dexie versioned migration |
| Add service method | `src/services/database.ts` | 4 service classes: Conversation, Message, Model, Agent |
| Register custom agent | `src/services/agent.ts` | `agentRegistry.register(def, runner)` or `registerAgent()` helper |
| Add locale | `src/locales/` | Must add to all 3: zh-cn.ts, en.ts, ja.ts + index.ts `LocaleName` type |

## KEY INTERFACES

```
AgentRunner.chat(messages, model, options?) → AsyncGenerator<ChatChunk>
ChatChunk: { type: 'token' | 'done' | 'error', content?, error? }
FileUploadService: { upload(file), getFileUrl(id) }  — interface only, never implemented
```

## DB SCHEMA (Dexie v1)

| Table | Key | Indexes |
|-------|-----|---------|
| conversations | id | agentId, modelId, createdAt, updatedAt |
| messages | id | conversationId, timestamp, **[conversationId+timestamp]** (compound) |
| models | id | provider, createdAt |
| agents | id | isBuiltin |

## CONVENTIONS

- **Singleton composables** — `useChat`, `useSession`, `useModel` use module-level `ref()`s (not provide/inject). Each exports `_reset*State()` for test isolation
- **Service classes** — `ConversationService`, `MessageService`, `ModelService`, `AgentService` are plain classes wrapping Dexie ops. Instantiated inside composables, not singletons
- **Streaming flow** — `useChat.sendMessage()` creates placeholder msg (isStreaming=true), loops `for await (const chunk of generator)`, updates msg per token, marks done
- **Side-effect registration** — built-in LangChain agent registered in `src/index.ts` to survive tree-shaking (not in `agents/index.ts`)
- **`liveQuery` + `watch`** — `useSession` uses `watch(currentConversationId, ...)` to switch liveQuery subscriptions, NOT liveQuery closures that read `ref.value`

## ANTI-PATTERNS

- **NEVER** use `liveQuery(() => someRef.value ? table.get(someRef.value) : ...)` — liveQuery only tracks Dexie table ops, not Vue reactivity
- **NEVER** delete builtin agents — `AgentService.delete()` throws if `isBuiltin` is true
- **NEVER** forget cascade delete — deleting a conversation MUST delete its messages first
- **NEVER** leave TS errors in test files — `vite-plugin-dts` scans ALL `.ts` files; test errors break builds
- **NEVER** bundle Element Plus — it's externalized in vite.config as peerDependency

## TESTING

- **Framework**: Vitest + jsdom + @vue/test-utils
- **Setup**: `fake-indexeddb/auto` imported globally (in-memory IndexedDB)
- **Collocated**: `__tests__/` dirs next to source, `*.test.ts` naming
- **Key helpers**: `withSetup()` for composable lifecycle, `flushLiveQuery()` for Dexie reactivity, `createMockStream()` for async generators
- **Mock pattern**: `vi.hoisted()` + `vi.mock()` for composable mocking; fresh `ref()` objects in `beforeEach`
- **Order-agnostic assertions**: Dexie `toArray()` order not guaranteed by insertion — use `expect.arrayContaining`

## BUILD

- **Entry**: `src/index.ts` → `dist/ai-chat.js` (ESM) + `dist/ai-chat.umd.cjs` (UMD)
- **Types**: Generated to `dist/types/` via `vite-plugin-dts`
- **Externals**: vue, element-plus, @element-plus/icons-vue
- **Development exports**: `package.json` exports `"development"` condition → source `.ts` files
