# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-29
**Commit:** db5a565
**Branch:** main

## OVERVIEW

Vue 3 AI chat component library (monorepo). Uses Element Plus for UI, Dexie/IndexedDB for client-side persistence, and LangChain.js for AI agent integration. Distributed as `@ai-chat/vue` npm package with ESM + UMD builds.

## STRUCTURE

```
.
├── packages/ai-chat/   # Main library (@ai-chat/vue)
│   ├── src/
│   │   ├── components/ # 10 Vue SFCs (AiChat, Sidebar, ChatInput, ChatMessage, etc.)
│   │   ├── composables/# 6 composables (useChat, useSession, useModel, useLocale, useAgent, useObservable)
│   │   ├── agents/     # LangChainRunner + message converter + LLM init + MCP client
│   │   ├── services/   # AgentRegistry singleton + CRUD services for IndexedDB
│   │   ├── database/   # Dexie schema (4 tables: conversations, messages, models, agents)
│   │   ├── locales/    # i18n (zh-CN, en, ja) with injection key
│   │   └── types/      # Shared TypeScript interfaces
│   └── vitest.config.ts
├── apps/demo/           # Dev demo app (consumes package via workspace alias)
└── pnpm-workspace.yaml  # packages/* + apps/*
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add a new UI component | `packages/ai-chat/src/components/` | Export from `src/index.ts` |
| Add a new composable | `packages/ai-chat/src/composables/` | Export from `src/index.ts` |
| Add a new AI agent | Config-based `registerAgent()` | Define `AgentDefinition` with tools, register via `registerAgent(def)` |
| Modify DB schema | `packages/ai-chat/src/database/db.ts` | Dexie versioned migration |
| Add i18n strings | `packages/ai-chat/src/locales/{zh-cn,en,ja}.ts` | All 3 locales must be updated together |
| Change build output | `packages/ai-chat/vite.config.ts` | ESM + UMD dual format |
| Demo app changes | `apps/demo/src/App.vue` | Only demo, not the library |
| Test a component | `packages/ai-chat/src/**/__tests__/*.test.ts` | Collocated `__tests__/` dirs |
| Tool/MCP integration | `packages/ai-chat/src/agents/langchain-runner.ts` | Unified LangChain runner with tool calling loop |
| MCP server connection | `packages/ai-chat/src/agents/mcp-client.ts` | MCP integration via @langchain/mcp-adapters |
| Message conversion | `packages/ai-chat/src/agents/message-converter.ts` | ChatMessage → LangChain BaseMessage conversion |
| LLM initialization | `packages/ai-chat/src/agents/llm-init.ts` | ChatOpenAI creation from ModelConfig |

## CONVENTIONS

- **No ESLint/Prettier configured** — follow existing code style from surrounding files
- **TypeScript strict mode** across all tsconfig files — no `as any` or `@ts-ignore`
- **No hardcoded text** — all user-facing strings go through i18n locale system
- **Module-level singletons** — composables (`useChat`, `useSession`, `useModel`, `useAgent`) share state via module-level `ref()`s, not Vue provide/inject. Most export `_reset*State()` for test isolation
- **Side-effect agent registration** — built-in LangChain agent is registered in `src/index.ts` (not `agents/index.ts`) to prevent tree-shaking from removing it
- **Element Plus is peerDependency** — never bundle it; externalized in vite build
- **Tests collocated** — `__tests__/` subdirectory next to source files, `*.test.ts` naming

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use `as any` or `@ts-ignore` — fix the type instead
- **NEVER** hardcode Chinese/English text in components — use i18n
- **NEVER** bundle Element Plus into the library output
- **NEVER** implement file upload service — only define the `FileUploadService` interface
- **NEVER** delete builtin agents — `AgentService.delete()` guards `isBuiltin` flag
- **NEVER** forget cascade delete — `ConversationService.delete()` must also delete associated messages
- **DO NOT** use Dexie `liveQuery` closures that read Vue `ref.value` — liveQuery only tracks Dexie table mutations, not Vue reactivity. Use `watch()` for parameterized queries instead
- **DO NOT** leave TS errors in test files — `vite-plugin-dts` scans all `.ts` files including tests; test TS errors will fail the build

## UNIQUE STYLES

- **Config-based agent registration** — `registerAgent({ id, name, tools, mcpServers })` creates runner internally. Users never implement `AgentRunner` — just provide tool definitions and MCP configs. Framework handles LLM init, message conversion, tool calling loop, streaming.
- **Dual package exports** — `package.json` exports map `"development"` condition to source `.ts` files, `"import"` to built `.js`. Demo app resolves source directly for HMR
- **Streaming chat** — `AgentRunner.chat()` returns `AsyncGenerator<ChatChunk>`. `useChat` creates a placeholder message (isStreaming=true), updates it token-by-token, then marks done
- **Database service classes** — `ConversationService`, `MessageService`, `ModelService`, `AgentService` are plain classes (not composables) wrapping Dexie operations. Composables consume them
- **Tool calling loop** — `LangChainRunner` implements max-5-iteration invoke → tool_calls → execute → ToolMessage loop internally. Users only provide `ToolDefinition[]` with execute functions.
- **MCP integration** — `MCPClient` wraps `@langchain/mcp-adapters` MultiServerMCPClient. Lazy-loaded, graceful degradation on connection failure. Tools converted to framework-agnostic `ToolDefinition[]`.

## COMMANDS

```bash
pnpm dev            # Run demo app (apps/demo) with HMR
pnpm build          # Build library (packages/ai-chat) → dist/
pnpm test           # Run vitest (packages/ai-chat)
pnpm type-check     # Run tsc across all workspace packages
```

## NOTES

- Demo app aliases `@ai-chat/vue` to `packages/ai-chat/src/index.ts` — changes to the library are immediately reflected without rebuild
- `fake-indexeddb/auto` imported in test setup — all tests use in-memory IndexedDB
- Test helpers: `withSetup()` for composables with lifecycle, `flushLiveQuery()` to wait for Dexie reactivity, `createMockStream()` for async generator mocking
- IndexedDB compound index `[conversationId+timestamp]` on messages table for efficient conversation queries
