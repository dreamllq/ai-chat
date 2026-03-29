# AI Chat Component — Vue3 可复用聊天组件库

## TL;DR

> **Quick Summary**: 构建一个基于 Vue3 + Element Plus + TypeScript 的 AI 聊天组件库（npm包），支持会话管理、流式响应、模型配置、Agent注册、IndexDB持久化、国际化。附完整功能Demo页面。
>
> **Deliverables**:
> - `@ai-chat/vue` — 可复用的 Vue3 AI 聊天组件库（npm包）
> - `@ai-chat/demo` — 完整功能演示应用
> - 完整 TDD 测试套件（Vitest + Vue Test Utils）
> - 国际化支持（中/英/日）
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: T1 → T2 → T8 → T11 → T15 → T19 → T20 → T25 → F1-F4

---

## Context

### Original Request
构建一个AI聊天组件，支持会话管理（新建/删除/切换）、实时流式显示AI回复、文件上传（接口注入）、模型配置管理、Agent切换（内置LangChain agent + 自定义注册）。技术栈 Vue3+Element Plus+TS，IndexDB存储，支持国际化。

### Interview Summary
**Key Discussions**:
- **AI后端通信**: 注入式，组件定义Agent接口契约，LangChain.js在浏览器端直接调用大模型API
- **模型管理**: 配置管理 — 用户配置模型连接信息（endpoint/key/model名）
- **LangChain集成**: 前端LangChain.js，API Key存储在IndexDB中（仅演示/内部场景可接受）
- **UI布局**: ChatGPT风格 — 左侧会话列表sidebar + 右侧聊天区域
- **Demo页面**: 完整功能演示，可实际与AI对话
- **测试策略**: TDD（Vitest + Vue Test Utils）

**Research Findings**:
- **Dexie.js**: IndexDB生产标准，TypeScript-first，useLiveQuery响应式查询，内置migration
- **LangChain.js**: 浏览器端可行，streaming via fetch + ReadableStream，Agent模式用ChatPromptTemplate
- **组件库打包**: pnpm monorepo（PrimeVue/Arco模式），Vite library mode，Element Plus作peerDependency
- **i18n**: provide/inject模式（Element Plus config-provider风格）

### Metis Review
**Identified Gaps** (addressed):
- **Markdown渲染**: AI回复需要markdown渲染（代码块、语法高亮）→ 应用默认：markdown-it + highlight.js
- **Agent接口契约**: 需要精确定义 → 基于LangChain.js模式设计标准接口
- **空状态处理**: 无会话/无消息时的UI → 标准空状态组件
- **错误处理**: 流式中断、API错误、网络异常 → 标准错误展示+重试机制
- **Bundle Size**: Element Plus全量引入会很大 → 按需引入 + peerDependency
- **会话标题**: 新建会话无标题 → 首条消息自动生成标题或默认"新会话"
- **消息编辑/重发**: 未讨论 → 不在本次范围内（EXCLUDE）
- **暗色模式**: 未讨论 → 通过CSS变量支持，跟随Element Plus主题系统

---

## Work Objectives

### Core Objective
构建一个生产级可复用的 Vue3 AI 聊天组件库，发布为 npm 包，具备完整的会话管理、流式AI对话、模型配置、Agent注册能力，附带全功能Demo页面。

### Concrete Deliverables
- `packages/ai-chat/` — 组件库源码
  - `src/components/` — 所有Vue组件（Layout, Sidebar, MessageList, InputArea, ModelSelector, AgentSelector）
  - `src/composables/` — 组合式函数（useChat, useSession, useModel, useAgent, useI18n）
  - `src/services/` — 业务服务（DatabaseService, AgentService, ChatService）
  - `src/types/` — TypeScript类型定义
  - `src/locales/` — 国际化文件（zh/en/ja）
- `apps/demo/` — Demo应用
  - 完整的ChatGPT风格聊天界面
  - 可实际连接LLM API进行对话
- `dist/` — 构建产物（ESM + UMD）

### Definition of Done
- [ ] `pnpm build` 成功构建组件库
- [ ] `pnpm test` 所有测试通过
- [ ] `pnpm dev` Demo应用可正常运行并与AI对话
- [ ] 组件库可通过 `npm pack` 生成可用包

### Must Have
- 会话CRUD（新建、删除、切换、重命名）
- 流式AI消息显示（逐字/逐token输出）
- 模型配置管理（创建、删除、切换，存储endpoint/key/model名）
- 内置LangChain chat agent（浏览器端直接调用LLM API）
- Agent注册接口（代码层级注册自定义agent）
- IndexDB持久化（Dexie.js，会话隔离的消息存储）
- 国际化（中/英/日，provide/inject模式）
- Markdown渲染（代码块+语法高亮）
- 文件上传接口（可注入上传服务）
- Demo页面（完整功能，可实际对话）
- Vitest测试覆盖

### Must NOT Have (Guardrails)
- ❌ 不实现文件上传服务本身（仅定义接口）
- ❌ 不实现自定义Agent的system prompt UI（后续迭代）
- ❌ 不打包Element Plus（peerDependency）
- ❌ 不实现消息编辑/重新生成功能
- ❌ 不实现后端AI代理服务
- ❌ 不使用 `as any` 或 `@ts-ignore`
- ❌ 不在组件中hardcode中文文案（全部走i18n）
- ❌ 不在构建产物中包含测试文件
- ❌ 不引入不必要的抽象层（避免AI slop过度抽象）

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: YES (TDD)
- **Framework**: Vitest + Vue Test Utils + @vue/test-utils
- **TDD workflow**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **Component Library**: Use Bash (vitest) — Run tests, check coverage
- **Demo App**: Use Playwright — Full user flow testing
- **Build**: Use Bash — Build commands, verify output files

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + scaffolding):
├── T1: 项目脚手架 — pnpm monorepo + Vite + TS配置 [quick]
├── T2: 核心类型定义 [quick]
├── T3: Dexie.js数据库Schema + 迁移 [quick]
├── T4: 国际化体系 — locale文件 + provide/inject [quick]
├── T5: 测试基础设施 — Vitest + Vue Test Utils [quick]
└── T6: 组件库构建配置 — Vite library mode [quick]

Wave 2 (After Wave 1 — core services, MAX PARALLEL):
├── T7: 数据库CRUD服务 (depends: T2, T3) [unspecified-high]
├── T8: Agent接口 + 内置LangChain Agent (depends: T2) [deep]
├── T9: 模型管理服务 (depends: T2, T7) [unspecified-high]
├── T10: 会话管理服务 (depends: T2, T7) [unspecified-high]
├── T11: 聊天服务 — 流式消息 (depends: T2, T7, T8) [deep]
└── T12: i18n composable (depends: T4) [quick]

Wave 3 (After Wave 2 — UI components, MAX PARALLEL):
├── T13: Layout Shell组件 — ChatGPT风格布局 (depends: T5, T6, T12) [visual-engineering]
├── T14: Sidebar组件 — 会话列表 (depends: T10, T12, T13) [visual-engineering]
├── T15: ChatMessageList组件 — 消息显示+流式+Markdown (depends: T11, T12, T13) [visual-engineering]
├── T16: ChatInput组件 — 输入区域+文件上传 (depends: T11, T12, T13) [visual-engineering]
├── T17: ModelSelector组件 (depends: T9, T12) [visual-engineering]
└── T18: AgentSelector组件 (depends: T8, T12) [visual-engineering]

Wave 4 (After Wave 3 — integration + demo):
├── T19: AiChat主组件 — 整合所有子组件 (depends: T13-T18) [deep]
├── T20: 组件库入口 — exports + install plugin (depends: T19, T6) [quick]
├── T21: Demo应用脚手架 (depends: T1) [quick]
└── T22: Demo完整页面 — 真实AI对话 (depends: T19, T20, T21) [unspecified-high]

Wave 5 (After Wave 4 — polish + verification):
├── T23: 错误处理 + 重试UI (depends: T15, T16) [unspecified-high]
├── T24: 空状态处理 (depends: T14, T15) [quick]
└── T25: 构建验证 + npm pack测试 (depends: T20, T22) [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high + playwright)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 → T2 → T8 → T11 → T15 → T19 → T20 → T25 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 6 (Wave 1 & Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1 | — | T6, T21 | 1 |
| T2 | — | T7-T11 | 1 |
| T3 | — | T7 | 1 |
| T4 | — | T12 | 1 |
| T5 | — | T13-T18 | 1 |
| T6 | — | T13, T20 | 1 |
| T7 | T2, T3 | T9, T10, T11 | 2 |
| T8 | T2 | T11, T18 | 2 |
| T9 | T2, T7 | T17 | 2 |
| T10 | T2, T7 | T14 | 2 |
| T11 | T2, T7, T8 | T15, T16 | 2 |
| T12 | T4 | T13-T18 | 2 |
| T13 | T5, T6, T12 | T14, T15, T16, T19 | 3 |
| T14 | T10, T12, T13 | T19 | 3 |
| T15 | T11, T12, T13 | T19, T23, T24 | 3 |
| T16 | T11, T12, T13 | T19, T23 | 3 |
| T17 | T9, T12 | T19 | 3 |
| T18 | T8, T12 | T19 | 3 |
| T19 | T13-T18 | T20, T22 | 4 |
| T20 | T19, T6 | T25 | 4 |
| T21 | T1 | T22 | 4 |
| T22 | T19, T20, T21 | T25 | 4 |
| T23 | T15, T16 | — | 5 |
| T24 | T14, T15 | — | 5 |
| T25 | T20, T22 | — | 5 |

### Agent Dispatch Summary

- **Wave 1**: **6 tasks** — T1-T6 → all `quick`
- **Wave 2**: **6 tasks** — T7 → `unspecified-high`, T8 → `deep`, T9 → `unspecified-high`, T10 → `unspecified-high`, T11 → `deep`, T12 → `quick`
- **Wave 3**: **6 tasks** — T13-T18 → all `visual-engineering`
- **Wave 4**: **4 tasks** — T19 → `deep`, T20 → `quick`, T21 → `quick`, T22 → `unspecified-high`
- **Wave 5**: **3 tasks** — T23 → `unspecified-high`, T24 → `quick`, T25 → `unspecified-high`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task has: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**

- [x] 1. 项目脚手架 — pnpm Monorepo + Vite + TypeScript

  **What to do**:
  - 初始化 pnpm monorepo 项目结构：
    ```
    ai-chat/
    ├── packages/
    │   └── ai-chat/          # 组件库
    │       ├── src/
    │       ├── package.json
    │       ├── vite.config.ts
    │       └── tsconfig.json
    ├── apps/
    │   └── demo/             # Demo应用
    │       ├── src/
    │       ├── package.json
    │       ├── vite.config.ts
    │       └── tsconfig.json
    ├── pnpm-workspace.yaml
    ├── package.json          # 根package.json
    └── tsconfig.json         # 根tsconfig（references）
    ```
  - 创建 `pnpm-workspace.yaml`（packages: ['packages/*', 'apps/*']）
  - 根 `package.json`：private=true，scripts（build/dev/test），devDependencies（typescript, vite, vue）
  - 根 `tsconfig.json`：project references 指向子项目
  - `packages/ai-chat/package.json`：name="@ai-chat/vue"，peerDependencies（vue, element-plus）
  - `packages/ai-chat/tsconfig.json`：strict=true，paths配置
  - `apps/demo/package.json`：dependencies引用 workspace:*
  - `.gitignore`（node_modules, dist, .sisyphus/evidence）
  - 所有空项目的基本入口文件（index.ts, App.vue, main.ts）

  **TDD — RED phase first**:
  - 创建 `packages/ai-chat/src/__tests__/setup.test.ts`
  - 测试：项目结构可以正确 resolve（import vue，import element-plus）
  - 测试：`vitest.config.ts` 正确配置（Vue plugin, jsdom environment）

  **Must NOT do**:
  - 不安装不必要的依赖（按需在后续task中安装）
  - 不配置具体的构建产物格式（T6处理）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 标准项目脚手架，模式成熟
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2-T6)
  - **Blocks**: T6, T21
  - **Blocked By**: None (can start immediately)

  **References**:
  **Pattern References**:
  - PrimeVue monorepo结构: `pnpm-workspace.yaml` 中 `packages: ['packages/*', 'apps/*']`
  - Arco Design Vue: 根tsconfig使用project references模式
  - Vite library mode docs: https://vite.dev/guide/build.html#library-mode

  **Acceptance Criteria**:
  - [ ] `pnpm install` 无错误执行完成
  - [ ] `vitest run packages/ai-chat/src/__tests__/setup.test.ts` → PASS
  - [ ] 目录结构符合上述规格

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 项目依赖正确安装
    Tool: Bash
    Preconditions: 项目根目录
    Steps:
      1. 运行 `pnpm install`
      2. 检查 `node_modules/.pnpm/vue*` 存在
      3. 检查 `packages/ai-chat/node_modules` 存在（或通过 workspace 链接）
    Expected Result: pnpm install 成功退出（exit code 0），vue和element-plus在peerDependencies中
    Failure Indicators: 依赖安装失败，workspace链接不存在
    Evidence: .sisyphus/evidence/task-1-install.txt

  Scenario: Workspace 链接正确
    Tool: Bash
    Preconditions: pnpm install 已完成
    Steps:
      1. 运行 `ls apps/demo/node_modules/@ai-chat/vue` 检查 workspace 链接
      2. 验证链接指向 packages/ai-chat
    Expected Result: workspace 链接存在且指向正确路径
    Failure Indicators: 链接不存在或指向错误路径
    Evidence: .sisyphus/evidence/task-1-workspace-links.txt
  ```

  **Commit**: YES
  - Message: `chore: initialize pnpm monorepo with Vue3 + TS + Vite`
  - Files: all scaffolding files
  - Pre-commit: `pnpm install && pnpm type-check`

- [x] 2. 核心类型定义

  **What to do**:
  - 创建 `packages/ai-chat/src/types/index.ts`，导出所有核心类型
  - 定义以下接口/类型：

  ```typescript
  // === 消息 ===
  export type MessageRole = 'user' | 'assistant' | 'system'

  export interface ChatMessage {
    id: string
    conversationId: string
    role: MessageRole
    content: string
    timestamp: number  // Date.now()
    isStreaming?: boolean  // 是否正在流式输出中
    metadata?: Record<string, unknown>  // 扩展字段（token数等）
  }

  // === 会话 ===
  export interface Conversation {
    id: string
    title: string
    agentId: string
    modelId: string
    createdAt: number
    updatedAt: number
  }

  // === 模型配置 ===
  export interface ModelConfig {
    id: string
    name: string            // 显示名称 "GPT-4o"
    provider: string        // 'openai' | 'anthropic' | 'custom'
    endpoint: string        // API URL
    apiKey: string          // 加密存储的API Key
    modelName: string       // 实际模型名 'gpt-4o'
    temperature?: number    // 默认 0.7
    maxTokens?: number      // 默认不限制
    createdAt: number
  }

  // === Agent ===
  export interface AgentDefinition {
    id: string
    name: string
    description?: string
    avatar?: string
    systemPrompt?: string
    isBuiltin?: boolean     // 内置 vs 用户自定义
  }

  // Agent 运行时接口 — 用户注册的 agent 必须实现此接口
  export interface AgentRunner {
    chat(
      messages: ChatMessage[],
      model: ModelConfig,
      options?: ChatOptions
    ): AsyncGenerator<ChatChunk, void, unknown>
  }

  export interface ChatOptions {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    signal?: AbortSignal
    onToken?: (token: string) => void
  }

  export interface ChatChunk {
    type: 'token' | 'done' | 'error'
    content?: string
    error?: string
  }

  // === 文件上传 ===
  export interface FileUploadService {
    upload(file: File): Promise<UploadedFile>
    getFileUrl(fileId: string): Promise<string>
  }

  export interface UploadedFile {
    id: string
    name: string
    url: string
    size: number
    mimeType: string
  }

  // === 事件 ===
  export type ChatEventType =
    | 'message:sent'
    | 'message:streaming'
    | 'message:complete'
    | 'message:error'
    | 'conversation:created'
    | 'conversation:deleted'
    | 'model:changed'
    | 'agent:changed'
  ```

  **TDD — RED phase first**:
  - 创建 `packages/ai-chat/src/types/__tests__/types.test.ts`
  - 测试类型推导正确性（使用 tsd 或手动类型断言）
  - 测试接口满足基本约束（如 ChatChunk 的联合类型）

  **Must NOT do**:
  - 不实现任何业务逻辑
  - 不引入运行时依赖
  - 不导出具体实现，仅导出类型和接口

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 纯类型定义，无复杂逻辑
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T3-T6)
  - **Blocks**: T7-T11（几乎所有Wave 2任务依赖类型定义）
  - **Blocked By**: None (can start immediately)

  **References**:
  **Pattern References**:
  - LangChain.js消息类型: `@langchain/core/messages` — HumanMessage, AIMessage, SystemMessage
  - OpenAI Chat API: messages格式 `{role, content}` 标准模式
  - Agent Runner模式: AsyncGenerator 是流式响应的标准模式

  **Acceptance Criteria**:
  - [ ] `vitest run packages/ai-chat/src/types/__tests__/types.test.ts` → PASS
  - [ ] TypeScript 编译无错误
  - [ ] 所有类型从 `src/types/index.ts` 统一导出

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 类型导出完整
    Tool: Bash
    Preconditions: 类型文件已创建
    Steps:
      1. 运行 `npx tsc --noEmit` 在 packages/ai-chat 下
      2. 检查 index.ts 导出所有核心类型
    Expected Result: TypeScript编译通过，无类型错误
    Failure Indicators: 类型错误或缺少导出
    Evidence: .sisyphus/evidence/task-2-type-check.txt

  Scenario: AgentRunner接口类型正确
    Tool: Bash
    Preconditions: 类型已定义
    Steps:
      1. 创建临时测试文件验证 AgentRunner.chat 返回类型是 AsyncGenerator
      2. 验证 ChatChunk 联合类型覆盖 token/done/error
    Expected Result: AsyncGenerator<ChatChunk> 类型推导正确
    Failure Indicators: 类型不匹配或编译错误
    Evidence: .sisyphus/evidence/task-2-agent-type.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(types): add core type definitions for chat system`
  - Files: `packages/ai-chat/src/types/`

- [x] 3. Dexie.js 数据库 Schema + 迁移

  **What to do**:
  - 安装 `dexie` 到 packages/ai-chat
  - 创建 `packages/ai-chat/src/database/db.ts`：
    ```typescript
    import Dexie, { type EntityTable } from 'dexie'

    // 导入类型（从T2）
    import type { ChatMessage, Conversation, ModelConfig, AgentDefinition } from '../types'

    const db = new Dexie('AiChatDB') as Dexie & {
      conversations: EntityTable<Conversation, 'id'>
      messages: EntityTable<ChatMessage, 'id'>
      models: EntityTable<ModelConfig, 'id'>
      agents: EntityTable<AgentDefinition, 'id'>
    }

    db.version(1).stores({
      conversations: 'id, agentId, modelId, createdAt, updatedAt',
      messages: 'id, conversationId, role, timestamp, [conversationId+timestamp]',
      models: 'id, provider, createdAt',
      agents: 'id, isBuiltin'
    })

    export { db }
    export type Database = typeof db
    ```
  - 创建复合索引 `[conversationId+timestamp]` 用于按会话查询消息并排序

  **TDD — RED phase first**:
  - 创建 `packages/ai-chat/src/database/__tests__/db.test.ts`
  - 测试：数据库可以打开（`db.open()`）
  - 测试：所有表存在（conversations, messages, models, agents）
  - 测试：schema版本正确
  - 注意：使用 `fake-indexeddb` 在Node环境中测试

  **Must NOT do**:
  - 不实现CRUD操作（T7处理）
  - 不添加业务逻辑到数据库层
  - 不在测试中使用真实浏览器IndexedDB

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 标准Dexie.js配置，模式成熟
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T4-T6)
  - **Blocks**: T7（数据库CRUD服务依赖此schema）
  - **Blocked By**: T2（需要类型定义来约束表类型）— 但可以先定义schema再在T7中添加类型

  **References**:
  **Pattern References**:
  - Dexie.js TypeScript模式: `new Dexie('name') as Dexie & { tables... }` — 官方推荐写法
  - Dexie EntityTable: `EntityTable<T, 'keyPath'>` 提供完整类型推导
  - 复合索引语法: `'[field1+field2]'` 用于多字段查询
  - `fake-indexeddb` + `fake-indexeddb/auto` 用于Node测试环境

  **API/Type References**:
  - Dexie official: https://dexie.org/docs/Typescript
  - Dexie Version API: https://dexie.org/docs/Version/Version

  **Acceptance Criteria**:
  - [ ] `vitest run packages/ai-chat/src/database/__tests__/db.test.ts` → PASS
  - [ ] 数据库打开无错误
  - [ ] 4个表（conversations, messages, models, agents）正确定义

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 数据库Schema正确初始化
    Tool: Bash
    Preconditions: fake-indexeddb 已安装
    Steps:
      1. 运行 `pnpm --filter @ai-chat/vue test -- --run src/database/__tests__/db.test.ts`
      2. 验证所有4个表存在
      3. 验证索引定义正确
    Expected Result: 测试全部通过，4个表可访问
    Failure Indicators: 表不存在或索引缺失
    Evidence: .sisyphus/evidence/task-3-db-schema.txt

  Scenario: fake-indexeddb 在Node环境中正常工作
    Tool: Bash
    Steps:
      1. 确认 vitest.config.ts 配置了 fake-indexeddb setup
      2. 运行数据库测试
    Expected Result: 测试在Node环境中无浏览器API报错
    Failure Indicators: "indexedDB is not defined" 错误
    Evidence: .sisyphus/evidence/task-3-fake-indexeddb.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(database): add Dexie.js schema with typed tables`
  - Files: `packages/ai-chat/src/database/`
  - Pre-commit: `pnpm test`

- [x] 4. 国际化体系 — locale 文件 + provide/inject

  **What to do**:
  - 创建 `packages/ai-chat/src/locales/` 目录结构：
    ```
    locales/
    ├── index.ts          # 导出所有locale + useLocale composable
    ├── zh-cn.ts          # 中文
    ├── en.ts             # 英文
    └── ja.ts             # 日文
    ```
  - 定义 locale 类型接口：
    ```typescript
    export interface AiChatLocale {
      conversation: {
        newChat: string
        deleteConfirm: string
        rename: string
        empty: string
      }
      chat: {
        placeholder: string
        send: string
        streaming: string
        resend: string
        copyCode: string
        copySuccess: string
      }
      model: {
        title: string
        create: string
        delete: string
        endpoint: string
        apiKey: string
        modelName: string
        selectModel: string
      }
      agent: {
        title: string
        select: string
      }
      upload: {
        button: string
        dragHere: string
      }
      error: {
        network: string
        apiKey: string
        streamInterrupted: string
        retry: string
      }
    }
    ```
  - 实现 provide/inject 模式：
    ```typescript
    // 提供 Symbol key
    export const localeInjectionKey: InjectionRef<AiChatLocale> = Symbol('aiChatLocale')

    // useLocale composable
    export function useLocale() {
      const locale = inject(localeInjectionKey, ref(en))
      // 支持消费者通过 AiChatProvider 注入自定义locale
      return { locale, t: (key: string) => getNestedValue(locale.value, key) }
    }
    ```
  - 填充 zh-cn.ts, en.ts, ja.ts 的完整翻译

  **TDD — RED phase first**:
  - 测试：每个locale文件导出完整AiChatLocale结构（无缺失key）
  - 测试：useLocale 默认返回英文
  - 测试：provide自定义locale后 inject 返回正确值
  - 测试：`t()` 函数正确解析嵌套key路径

  **Must NOT do**:
  - 不使用 vue-i18n 库（组件库自己实现轻量方案，避免强制消费者依赖vue-i18n）
  - 不hardcode任何语言字符串到组件中
  - 不在locale文件中包含运行时逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 标准i18n模式，纯数据+简单composable
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1-T3, T5, T6)
  - **Blocks**: T12（composable扩展）, T13-T18（所有UI组件依赖i18n）
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - Element Plus locale模式: `packages/locale/` + `provide/inject` + `useLocale` hook
  - Element Plus ConfigProvider: 通过 `app.provide(localeContextKey, locale)` 注入
  - Arco Design Vue i18n: 同样的provide/inject模式

  **Acceptance Criteria**:
  - [ ] 3个语言文件（zh-cn/en/ja）完整且结构一致
  - [ ] `vitest run packages/ai-chat/src/locales/__tests__/` → PASS（4+tests）
  - [ ] useLocale composable 工作正常

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Locale文件完整性
    Tool: Bash
    Steps:
      1. 运行locale测试验证3个语言文件key完全一致
      2. 验证没有undefined值
    Expected Result: zh-cn/en/ja 三个文件key完全对齐，无遗漏
    Failure Indicators: key数量不匹配或值为undefined
    Evidence: .sisyphus/evidence/task-4-locale-complete.txt

  Scenario: useLocale provide/inject正确
    Tool: Bash
    Steps:
      1. 运行vitest测试useLocale
      2. 验证inject默认值是英文
      3. 验证provide中文后inject返回中文
    Expected Result: composable正确响应provide的locale变化
    Failure Indicators: inject返回默认值而非provided值
    Evidence: .sisyphus/evidence/task-4-use-locale.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(i18n): add locale files and provide/inject pattern`
  - Files: `packages/ai-chat/src/locales/`

- [x] 5. 测试基础设施 — Vitest + Vue Test Utils

  **What to do**:
  - 安装测试依赖到 packages/ai-chat：
    - `vitest`
    - `@vue/test-utils`
    - `jsdom`（DOM环境）
    - `@vitest/coverage-v8`（覆盖率）
    - `fake-indexeddb`（IndexDB模拟）
  - 创建 `packages/ai-chat/vitest.config.ts`：
    ```typescript
    import { defineConfig } from 'vitest/config'
    import vue from '@vitejs/plugin-vue'

    export default defineConfig({
      plugins: [vue()],
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.ts'],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html']
        }
      }
    })
    ```
  - 创建 `packages/ai-chat/src/__tests__/setup.ts`：
    ```typescript
    import 'fake-indexeddb/auto'
    // 其他全局setup
    ```
  - 创建示例测试验证基础设施工作正常
  - 在根 package.json 添加 `"test": "pnpm -r run test"` 脚本

  **TDD — RED phase first**:
  - 测试：vitest正确识别Vue SFC
  - 测试：jsdom环境可用（document, window存在）
  - 测试：fake-indexeddb工作（indexedDB全局对象可用）

  **Must NOT do**:
  - 不配置E2E测试（Playwright在Final Verification阶段使用）
  - 不安装cypress或其他E2E框架

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 标准vitest配置
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1-T4, T6)
  - **Blocks**: T7-T25（所有后续任务依赖测试基础设施）
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - Vitest Vue3配置: https://vitest.dev/guide/#configuring-vitest
  - Vue Test Utils: https://test-utils.vuejs.org/
  - fake-indexeddb: `import 'fake-indexeddb/auto'` 全局polyfill

  **Acceptance Criteria**:
  - [ ] `pnpm --filter @ai-chat/vue test` → PASS（setup测试通过）
  - [ ] vitest.config.ts 正确配置Vue plugin + jsdom
  - [ ] fake-indexeddb setup正常工作

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Vitest基础环境可用
    Tool: Bash
    Steps:
      1. 运行 `pnpm --filter @ai-chat/vue test -- --run`
      2. 检查jsdom环境报告
      3. 检查fake-indexeddb setup成功
    Expected Result: 测试运行器正常启动，所有setup测试通过
    Failure Indicators: "Cannot find module" 或 "indexedDB is not defined"
    Evidence: .sisyphus/evidence/task-5-vitest.txt

  Scenario: Vue SFC组件可测试
    Tool: Bash
    Steps:
      1. 创建最小Vue组件测试（mount一个简单组件）
      2. 运行测试验证 @vue/test-utils mount 正常工作
    Expected Result: 组件成功mount，DOM查询可用
    Failure Indicators: Vue plugin未正确配置
    Evidence: .sisyphus/evidence/task-5-vue-test-utils.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `chore(test): add Vitest + Vue Test Utils infrastructure`
  - Files: vitest.config.ts, setup.ts, 根package.json scripts

- [x] 6. 组件库构建配置 — Vite Library Mode

  **What to do**:
  - 创建/完善 `packages/ai-chat/vite.config.ts`：
    ```typescript
    import { defineConfig } from 'vite'
    import vue from '@vitejs/plugin-vue'
    import { resolve } from 'node:path'
    import dts from 'vite-plugin-dts'  // 自动生成 .d.ts

    export default defineConfig({
      plugins: [
        vue(),
        dts({
          insertTypesEntry: true,
          outDir: 'dist/types'
        })
      ],
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'AiChat',
          fileName: 'ai-chat',
          formats: ['es', 'umd']
        },
        rollupOptions: {
          external: ['vue', 'element-plus', '@element-plus/icons-vue'],
          output: {
            globals: {
              vue: 'Vue',
              'element-plus': 'ElementPlus'
            }
          }
        },
        cssCodeSplit: false
      }
    })
    ```
  - 完善 `packages/ai-chat/package.json`：
    ```json
    {
      "name": "@ai-chat/vue",
      "version": "0.1.0",
      "type": "module",
      "main": "./dist/ai-chat.umd.cjs",
      "module": "./dist/ai-chat.js",
      "types": "./dist/types/index.d.ts",
      "files": ["dist"],
      "exports": {
        ".": {
          "import": "./dist/ai-chat.js",
          "require": "./dist/ai-chat.umd.cjs",
          "types": "./dist/types/index.d.ts"
        },
        "./style.css": "./dist/style.css"
      },
      "peerDependencies": {
        "vue": "^3.3.0",
        "element-plus": "^2.4.0"
      },
      "sideEffects": ["*.css"]
    }
    ```
  - 创建占位 `src/index.ts`（导出空对象，后续task填充）

  **TDD — RED phase first**:
  - 测试：`vite build` 成功生成 dist/ 目录
  - 测试：产物包含 .js（ESM）、.umd.cjs（UMD）、.css、.d.ts 文件
  - 测试：产物不包含 vue 或 element-plus 代码（已externalize）

  **Must NOT do**:
  - 不配置 Rollup（使用 Vite 内置）
  - 不包含 SSR 配置
  - 不配置 CDN 发布

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 标准Vite library mode配置
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1-T5)
  - **Blocks**: T13（UI组件需要构建配置）, T20（入口文件）
  - **Blocked By**: T1（需要项目脚手架）

  **References**:
  **Pattern References**:
  - Vite Library Mode: https://vite.dev/guide/build.html#library-mode
  - vite-plugin-dts: 自动从Vue SFC和TS生成 .d.ts 类型声明
  - Element Plus作为peerDependency: 不打包，外部化

  **Acceptance Criteria**:
  - [ ] `pnpm --filter @ai-chat/vue build` 成功
  - [ ] dist/ 包含 .js, .umd.cjs, .css, .d.ts 文件
  - [ ] 产物中不包含 vue/element-plus 代码

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Library构建成功
    Tool: Bash
    Steps:
      1. 运行 `pnpm --filter @ai-chat/vue build`
      2. 检查 `packages/ai-chat/dist/` 目录内容
      3. 验证文件: ai-chat.js, ai-chat.umd.cjs, style.css, types/index.d.ts
    Expected Result: 4个预期文件全部存在，大小>0
    Failure Indicators: 构建失败或文件缺失
    Evidence: .sisyphus/evidence/task-6-build.txt

  Scenario: Vue和Element Plus已externalize
    Tool: Bash
    Steps:
      1. 检查 dist/ai-chat.js 内容
      2. 搜索 "import.*from.*'vue'" 和 "import.*from.*'element-plus'"
      3. 确认这些是外部引用而非内联代码
    Expected Result: 不包含 vue/element-plus 的实现代码
    Failure Indicators: bundle体积过大(>100KB)或包含vue运行时
    Evidence: .sisyphus/evidence/task-6-externalize.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `chore(build): add Vite library mode config with peerDependencies`
  - Files: vite.config.ts, package.json exports
  - Pre-commit: `pnpm --filter @ai-chat/vue build`

- [x] 7. 数据库 CRUD 服务

  **What to do**:
  - 创建 `packages/ai-chat/src/services/database.ts`，封装所有Dexie.js CRUD操作
  - 按实体拆分为4个服务类或composable工厂：
    ```typescript
    // 会话CRUD
    export class ConversationService {
      create(data: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Conversation>
      getAll(): Promise<Conversation[]>
      getById(id: string): Promise<Conversation | undefined>
      update(id: string, data: Partial<Conversation>): Promise<void>
      delete(id: string): Promise<void>  // 级联删除该会话所有消息
    }

    // 消息CRUD（会话隔离）
    export class MessageService {
      create(data: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage>
      getByConversationId(conversationId: string): Promise<ChatMessage[]>
      update(id: string, data: Partial<ChatMessage>): Promise<void>
      deleteByConversationId(conversationId: string): Promise<void>
      getLatest(conversationId: string, limit: number): Promise<ChatMessage[]>
    }

    // 模型CRUD
    export class ModelService {
      create(data: Omit<ModelConfig, 'id' | 'createdAt'>): Promise<ModelConfig>
      getAll(): Promise<ModelConfig[]>
      getById(id: string): Promise<ModelConfig | undefined>
      update(id: string, data: Partial<ModelConfig>): Promise<void>
      delete(id: string): Promise<void>
    }

    // Agent CRUD
    export class AgentService {
      create(data: Omit<AgentDefinition, 'id'>): Promise<AgentDefinition>
      getAll(): Promise<AgentDefinition[]>
      getById(id: string): Promise<AgentDefinition | undefined>
      update(id: string, data: Partial<AgentDefinition>): Promise<void>
      delete(id: string): Promise<void>  // 不允许删除内置agent
    }
    ```
  - 使用 Dexie.js 的 `liveQuery` 导出响应式查询方法
  - 消息按 conversationId 隔离，使用复合索引排序

  **TDD — RED phase first**:
  - 测试CRUD：每个实体的 create/getAll/getById/update/delete
  - 测试级联删除：删除会话时消息自动删除
  - 测试会话隔离：消息只返回对应conversationId的记录
  - 测试liveQuery响应式：数据变更后查询结果自动更新
  - 测试边界：空数据库、不存在的ID、重复ID

  **Must NOT do**:
  - 不在服务层引入Vue响应式（ref/reactive），使用Dexie的liveQuery
  - 不添加业务逻辑（如"自动生成标题"），仅做数据操作
  - 不直接暴露db实例，通过服务方法封装

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 4个实体的完整CRUD + 响应式查询，工作量较大
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: T9, T10, T11
  - **Blocked By**: T2, T3

  **References**:
  **Pattern References**:
  - Dexie liveQuery: `import { liveQuery } from 'dexie'` + `useObservable()` from VueUse
  - Dexie Table CRUD: `db.table.add()`, `.put()`, `.delete()`, `.where().equals()`
  - 级联删除: `db.messages.where('conversationId').equals(id).delete()`
  - 复合索引查询: `db.messages.where('[conversationId+timestamp]').between(...)`

  **API/Type References**:
  - `packages/ai-chat/src/types/index.ts` — 所有实体类型（T2）
  - `packages/ai-chat/src/database/db.ts` — db实例和表定义（T3）

  **Acceptance Criteria**:
  - [ ] 4个服务类完整实现CRUD
  - [ ] `vitest run src/services/__tests__/database.test.ts` → PASS (15+ tests)
  - [ ] 级联删除和会话隔离正确工作

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 会话CRUD完整
    Tool: Bash
    Steps:
      1. 运行数据库服务测试
      2. 验证 ConversationService 的5个方法全部通过
    Expected Result: create/getAll/getById/update/delete 全部PASS
    Failure Indicators: 任何CRUD操作失败
    Evidence: .sisyphus/evidence/task-7-conversation-crud.txt

  Scenario: 消息会话隔离
    Tool: Bash
    Steps:
      1. 创建2个会话（convA, convB）
      2. 给convA添加3条消息，给convB添加2条消息
      3. 查询convA消息 → 应返回3条
      4. 查询convB消息 → 应返回2条
    Expected Result: 消息严格按conversationId隔离
    Failure Indicators: 消息串会话或数量不匹配
    Evidence: .sisyphus/evidence/task-7-message-isolation.txt

  Scenario: 级联删除
    Tool: Bash
    Steps:
      1. 创建会话conv1并添加5条消息
      2. 删除conv1
      3. 查询conv1的消息 → 应返回空
    Expected Result: 删除会话后消息全部清除
    Failure Indicators: 孤儿消息残留
    Evidence: .sisyphus/evidence/task-7-cascade-delete.txt
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(services): add database CRUD services with reactive queries`
  - Files: `packages/ai-chat/src/services/database.ts`
  - Pre-commit: `pnpm test`

- [x] 8. Agent 接口 + 内置 LangChain Agent

  **What to do**:
  - 创建 `packages/ai-chat/src/services/agent.ts`：
    ```typescript
    import type { AgentDefinition, AgentRunner, ChatMessage, ModelConfig, ChatOptions, ChatChunk } from '../types'

    // Agent注册表
    class AgentRegistry {
      private runners: Map<string, AgentRunner> = new Map()

      register(agentDef: AgentDefinition, runner: AgentRunner): void
      unregister(agentId: string): void
      getRunner(agentId: string): AgentRunner | undefined
      getDefinition(agentId: string): AgentDefinition | undefined
      getAllDefinitions(): AgentDefinition[]
    }

    export const agentRegistry = new AgentRegistry()
    ```
  - 创建内置 LangChain Chat Agent：
    `packages/ai-chat/src/agents/langchain-chat-agent.ts`
    ```typescript
    import { ChatOpenAI } from '@langchain/openai'
    import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'

    export class LangChainChatAgent implements AgentRunner {
      async *chat(
        messages: ChatMessage[],
        model: ModelConfig,
        options?: ChatOptions
      ): AsyncGenerator<ChatChunk, void, unknown> {
        const llm = new ChatOpenAI({
          configuration: { baseURL: model.endpoint, apiKey: model.apiKey },
          modelName: model.modelName,
          temperature: options?.temperature ?? model.temperature ?? 0.7,
          maxTokens: options?.maxTokens ?? model.maxTokens,
          streaming: true,
        })

        const lcMessages = this.convertMessages(messages, options?.systemPrompt)

        try {
          const stream = await llm.stream(lcMessages)
          for await (const chunk of stream) {
            yield { type: 'token', content: chunk.content as string }
          }
          yield { type: 'done' }
        } catch (error) {
          yield { type: 'error', error: String(error) }
        }
      }

      private convertMessages(messages: ChatMessage[], systemPrompt?: string) {
        const result = []
        if (systemPrompt) result.push(new SystemMessage(systemPrompt))
        for (const msg of messages) {
          if (msg.role === 'user') result.push(new HumanMessage(msg.content))
          else if (msg.role === 'assistant') result.push(new AIMessage(msg.content))
        }
        return result
      }
    }
    ```
  - 注册内置agent到registry
  - 导出 `registerAgent()` 函数供消费者注册自定义agent

  **TDD — RED phase first**:
  - 测试：AgentRegistry 的 register/unregister/getRunner/getAllDefinitions
  - 测试：LangChainChatAgent 实现了 AgentRunner 接口
  - 测试：消息格式转换正确（ChatMessage → LangChain Message）
  - 测试：注册重复ID抛出错误
  - 测试：获取未注册的agent返回undefined
  - 注意：LangChain实际调用用mock，不测真实API

  **Must NOT do**:
  - 不在此task实现UI（Agent Selector组件在T18）
  - 不实现自定义system prompt UI（后续迭代）
  - 不调用真实LLM API（测试中全部mock）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Agent架构是核心，需要深入理解LangChain.js API
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: T11, T18
  - **Blocked By**: T2（类型定义）

  **References**:
  **Pattern References**:
  - LangChain.js streaming: `llm.stream()` 返回 AsyncIterable
  - LangChain.js ChatOpenAI: `@langchain/openai` 包
  - LangChain.js Messages: `@langchain/core/messages` — HumanMessage, AIMessage, SystemMessage
  - LangChain custom system prompts: ChatPromptTemplate + MessagesPlaceholder

  **API/Type References**:
  - `packages/ai-chat/src/types/index.ts` — AgentRunner, AgentDefinition, ChatChunk（T2）

  **Acceptance Criteria**:
  - [ ] AgentRegistry完整实现并测试通过
  - [ ] LangChainChatAgent实现AgentRunner接口
  - [ ] 内置agent自动注册
  - [ ] `vitest run src/agents/__tests__/` → PASS (8+ tests)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Agent注册表功能正常
    Tool: Bash
    Steps:
      1. 运行agent注册表测试
      2. 验证register/getRunner/unregister/getAllDefinitions
    Expected Result: 注册表CRUD操作全部通过
    Failure Indicators: 注册或查询失败
    Evidence: .sisyphus/evidence/task-8-agent-registry.txt

  Scenario: LangChain agent消息转换
    Tool: Bash
    Steps:
      1. 测试convertMessages方法
      2. 输入: [{role:'user',content:'hello'},{role:'assistant',content:'hi'}]
      3. 验证输出: [HumanMessage('hello'), AIMessage('hi')]
    Expected Result: 消息格式正确转换
    Failure Indicators: 角色映射错误或消息类型不匹配
    Evidence: .sisyphus/evidence/task-8-message-convert.txt

  Scenario: 未注册agent处理
    Tool: Bash
    Steps:
      1. 调用getRunner('non-existent-id')
      2. 验证返回undefined
      3. 调用getAllDefinitions()确认不包含
    Expected Result: 优雅返回undefined而非抛出异常
    Failure Indicators: 未处理的异常
    Evidence: .sisyphus/evidence/task-8-unregistered.txt
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(agent): add agent registry and built-in LangChain chat agent`
  - Files: `packages/ai-chat/src/agents/`, `packages/ai-chat/src/services/agent.ts`

- [x] 9. 模型管理服务

  **What to do**:
  - 创建 `packages/ai-chat/src/composables/useModel.ts`：
    ```typescript
    export function useModel() {
      const { locale } = useLocale()
      const modelService = new ModelService()

      // 响应式模型列表
      const models = useObservable(liveQuery(() => modelService.getAll()))

      // 当前选中的模型
      const currentModelId = ref<string | null>(null)
      const currentModel = computed(() =>
        models.value?.find(m => m.id === currentModelId.value)
      )

      // 操作方法
      async function createModel(data: CreateModelParams): Promise<ModelConfig>
      async function deleteModel(id: string): Promise<void>
      async function selectModel(id: string): Promise<void>

      // 初始化：选中第一个可用模型
      async function initDefault(): Promise<void>

      return { models, currentModel, currentModelId, createModel, deleteModel, selectModel, initDefault }
    }
    ```
  - 创建 `packages/ai-chat/src/composables/useModel.test.ts`

  **TDD — RED phase first**:
  - 测试：创建模型（endpoint, key, modelName, temperature等）
  - 测试：删除模型
  - 测试：切换当前模型
  - 测试：空模型列表时的默认行为
  - 测试：删除当前选中模型后的行为

  **Must NOT do**:
  - 不在此实现UI（ModelSelector组件在T17）
  - 不验证API Key有效性（仅存储）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: composable + 响应式 + 异步逻辑
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: T17
  - **Blocked By**: T2, T7

  **References**:
  **Pattern References**:
  - VueUse useObservable: 将Dexie liveQuery Observable转为Vue ref
  - Vue3 composables: 返回响应式状态 + 操作方法的标准模式

  **API/Type References**:
  - `packages/ai-chat/src/types/index.ts` — ModelConfig（T2）
  - `packages/ai-chat/src/services/database.ts` — ModelService（T7）

  **Acceptance Criteria**:
  - [ ] useModel composable 完整实现
  - [ ] `vitest run src/composables/__tests__/useModel.test.ts` → PASS (6+ tests)
  - [ ] 响应式模型列表正确更新

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 模型CRUD完整
    Tool: Bash
    Steps:
      1. 运行useModel测试
      2. 验证 createModel/deleteModel/selectModel
    Expected Result: 所有模型管理操作通过
    Failure Indicators: CRUD操作失败或响应式不更新
    Evidence: .sisyphus/evidence/task-9-model-crud.txt

  Scenario: 删除当前选中模型
    Tool: Bash
    Steps:
      1. 创建modelA和modelB，选中modelA
      2. 删除modelA
      3. 验证currentModel切换到modelB或null
    Expected Result: 优雅处理当前模型被删除的情况
    Failure Indicators: currentModel指向已删除的模型
    Evidence: .sisyphus/evidence/task-9-delete-current.txt
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(model): add useModel composable with reactive model management`
  - Files: `packages/ai-chat/src/composables/useModel.ts`

- [x] 10. 会话管理服务

  **What to do**:
  - 创建 `packages/ai-chat/src/composables/useSession.ts`：
    ```typescript
    export function useSession() {
      const conversationService = new ConversationService()
      const messageService = new MessageService()

      // 响应式会话列表
      const conversations = useObservable(liveQuery(() => conversationService.getAll()))

      // 当前活跃会话
      const currentConversationId = ref<string | null>(null)
      const currentConversation = computed(() =>
        conversations.value?.find(c => c.id === currentConversationId.value)
      )

      // 当前会话的消息
      const currentMessages = useObservable(
        liveQuery(() => {
          if (!currentConversationId.value) return []
          return messageService.getByConversationId(currentConversationId.value)
        })
      )

      // 操作方法
      async function createConversation(agentId: string, modelId: string): Promise<Conversation>
      async function deleteConversation(id: string): Promise<void>  // 级联删除消息
      async function renameConversation(id: string, title: string): Promise<void>
      async function switchConversation(id: string): Promise<void>

      return {
        conversations, currentConversationId, currentConversation, currentMessages,
        createConversation, deleteConversation, renameConversation, switchConversation
      }
    }
    ```

  **TDD — RED phase first**:
  - 测试：创建会话（关联agent和model）
  - 测试：删除会话（级联删除消息）
  - 测试：重命名会话
  - 测试：切换会话后 currentMessages 更新
  - 测试：会话列表按 updatedAt 降序排列
  - 测试：空状态（无会话时）

  **Must NOT do**:
  - 不在此实现UI（Sidebar组件在T14）
  - 不实现自动标题生成

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: composable + 响应式 + 级联操作 + 会话隔离
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: T14
  - **Blocked By**: T2, T7

  **References**:
  **API/Type References**:
  - `packages/ai-chat/src/types/index.ts` — Conversation, ChatMessage（T2）
  - `packages/ai-chat/src/services/database.ts` — ConversationService, MessageService（T7）

  **Acceptance Criteria**:
  - [ ] useSession composable 完整实现
  - [ ] `vitest run src/composables/__tests__/useSession.test.ts` → PASS (8+ tests)
  - [ ] 会话隔离和级联删除正确工作

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 会话切换消息隔离
    Tool: Bash
    Steps:
      1. 创建convA和convB
      2. 给convA添加3条消息，给convB添加2条消息
      3. 切换到convA → currentMessages.length === 3
      4. 切换到convB → currentMessages.length === 2
    Expected Result: 切换会话后消息列表正确更新
    Failure Indicators: 消息串会话或响应式不更新
    Evidence: .sisyphus/evidence/task-10-session-switch.txt

  Scenario: 删除当前会话
    Tool: Bash
    Steps:
      1. 创建3个会话，选中第2个
      2. 删除第2个
      3. 验证currentConversationId切换到相邻会话
    Expected Result: 自动切换到相邻会话，无错误
    Failure Indicators: currentConversationId指向已删除会话
    Evidence: .sisyphus/evidence/task-10-delete-current.txt
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(session): add useSession composable with conversation management`
  - Files: `packages/ai-chat/src/composables/useSession.ts`

- [x] 11. 聊天服务 — 流式消息

  **What to do**:
  - 创建 `packages/ai-chat/src/composables/useChat.ts`：
    ```typescript
    export function useChat() {
      const { currentConversationId, currentMessages } = useSession()
      const { currentModel } = useModel()
      const { getRunner } = agentRegistry
      const messageService = new MessageService()

      const isStreaming = ref(false)
      const abortController = ref<AbortController | null>(null)

      async function sendMessage(content: string, files?: UploadedFile[]) {
        if (!currentConversationId.value || !currentModel.value) return

        // 1. 保存用户消息到IndexDB
        const userMsg = await messageService.create({
          conversationId: currentConversationId.value,
          role: 'user',
          content,
          metadata: files ? { files } : undefined
        })

        // 2. 创建空的assistant消息（流式填充）
        const assistantMsg = await messageService.create({
          conversationId: currentConversationId.value,
          role: 'assistant',
          content: '',
          isStreaming: true
        })

        // 3. 获取agent runner
        const conversation = currentConversation.value
        const runner = getRunner(conversation!.agentId)
        if (!runner) throw new Error('Agent not found')

        // 4. 流式调用
        isStreaming.value = true
        abortController.value = new AbortController()
        let fullContent = ''

        try {
          const stream = runner.chat(
            currentMessages.value!,
            currentModel.value!,
            { signal: abortController.value.signal }
          )

          for await (const chunk of stream) {
            if (chunk.type === 'token' && chunk.content) {
              fullContent += chunk.content
              await messageService.update(assistantMsg.id, {
                content: fullContent
              })
            } else if (chunk.type === 'error') {
              await messageService.update(assistantMsg.id, {
                content: fullContent + `\n\n❌ Error: ${chunk.error}`,
                isStreaming: false
              })
            } else if (chunk.type === 'done') {
              await messageService.update(assistantMsg.id, {
                content: fullContent,
                isStreaming: false
              })
            }
          }
        } finally {
          isStreaming.value = false
          abortController.value = null
        }
      }

      function stopStreaming() {
        abortController.value?.abort()
      }

      return { isStreaming, sendMessage, stopStreaming }
    }
    ```

  **TDD — RED phase first**:
  - 测试：发送消息创建用户消息和助手消息
  - 测试：流式输出逐步更新助手消息内容
  - 测试：流式完成后 isStreaming 变为 false
  - 测试：stopStreaming 中断流式输出
  - 测试：agent不存在时抛出错误
  - 测试：模型未选择时安全返回
  - 注意：mock AgentRunner，不调用真实LLM

  **Must NOT do**:
  - 不在此实现UI（MessageList和Input组件在T15/T16）
  - 不处理文件上传逻辑（仅传递files元数据）
  - 不调用真实LLM API

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 流式消息核心逻辑，AsyncGenerator + 状态管理 + 错误处理
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: T15, T16
  - **Blocked By**: T2, T7, T8

  **References**:
  **Pattern References**:
  - AsyncGenerator流式模式: `for await (const chunk of stream)` 标准用法
  - AbortController: 浏览器标准API中断流式请求
  - LangChain.js streaming: `llm.stream()` 返回 AsyncIterable<AIMessageChunk>

  **API/Type References**:
  - `packages/ai-chat/src/types/index.ts` — ChatMessage, ChatChunk, AgentRunner（T2）
  - `packages/ai-chat/src/services/database.ts` — MessageService（T7）
  - `packages/ai-chat/src/agents/` — agentRegistry（T8）
  - `packages/ai-chat/src/composables/useModel.ts` — useModel（T9）
  - `packages/ai-chat/src/composables/useSession.ts` — useSession（T10）

  **Acceptance Criteria**:
  - [ ] useChat composable 完整实现
  - [ ] `vitest run src/composables/__tests__/useChat.test.ts` → PASS (8+ tests)
  - [ ] 流式消息正确保存到IndexDB

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 流式消息完整流程
    Tool: Bash
    Steps:
      1. Mock AgentRunner 返回3个token chunks + 1个done
      2. 调用 sendMessage("hello")
      3. 验证IndexDB中有2条新消息（user + assistant）
      4. 验证assistant消息content为3个token拼接
    Expected Result: 消息完整保存，流式结束后isStreaming=false
    Failure Indicators: 消息丢失或流式状态未更新
    Evidence: .sisyphus/evidence/task-11-stream.txt

  Scenario: 流式中断
    Tool: Bash
    Steps:
      1. Mock AgentRunner 模拟延迟流式输出
      2. 调用 sendMessage("hello")
      3. 在输出过程中调用 stopStreaming()
      4. 验证已输出的内容保存，isStreaming=false
    Expected Result: 已接收内容保存，流式中断无错误
    Failure Indicators: 中断后崩溃或内容丢失
    Evidence: .sisyphus/evidence/task-11-abort.txt

  Scenario: Agent不存在错误处理
    Tool: Bash
    Steps:
      1. 创建会话关联不存在的agentId
      2. 调用 sendMessage
      3. 验证错误消息写入assistant消息
    Expected Result: 错误优雅显示在聊天中
    Failure Indicators: 未捕获异常
    Evidence: .sisyphus/evidence/task-11-agent-not-found.txt
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(chat): add useChat composable with streaming message support`
  - Files: `packages/ai-chat/src/composables/useChat.ts`

- [x] 12. i18n composable

  **What to do**:
  - 创建 `packages/ai-chat/src/composables/useLocale.ts`：
    ```typescript
    // 扩展T4的基础locale，添加composable层
    export function useLocale() {
      const injectedLocale = inject(localeInjectionKey, ref(en)) as Ref<AiChatLocale>
      const locale = computed(() => injectedLocale.value)

      // 便捷翻译函数
      function t(path: string, params?: Record<string, string>): string {
        let result = getNestedValue(locale.value, path)
        if (params) {
          Object.entries(params).forEach(([key, val]) => {
            result = result.replace(`{${key}}`, val)
          })
        }
        return result
      }

      // 切换语言
      function setLocale(name: 'zh-cn' | 'en' | 'ja') {
        injectedLocale.value = locales[name]
      }

      return { locale, t, setLocale }
    }
    ```
  - 创建 `packages/ai-chat/src/components/AiChatProvider.vue`：
    - 顶层provider组件，通过props接收locale配置
    - provide localeInjectionKey 给所有子组件

  **TDD — RED phase first**:
  - 测试：默认locale是英文
  - 测试：setLocale 切换后 t() 返回正确翻译
  - 测试：嵌套路径解析正确（`conversation.newChat`）
  - 测试：带参数的翻译（`{name}` 替换）
  - 测试：不存在的key返回key本身

  **Must NOT do**:
  - 不引入 vue-i18n 库
  - 不在composable中直接依赖DOM

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 轻量composable扩展，逻辑简单
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: T13-T18（所有UI组件）
  - **Blocked By**: T4

  **References**:
  **API/Type References**:
  - `packages/ai-chat/src/locales/` — locale文件和 injectionKey（T4）

  **Acceptance Criteria**:
  - [ ] useLocale composable 完整实现
  - [ ] AiChatProvider 组件可provide locale
  - [ ] `vitest run src/composables/__tests__/useLocale.test.ts` → PASS (5+ tests)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 多语言切换
    Tool: Bash
    Steps:
      1. 默认语言检查 t('conversation.newChat') === 'New Chat'
      2. 切换中文 setLocale('zh-cn')
      3. 检查 t('conversation.newChat') === '新对话'
      4. 切换日文 setLocale('ja')
      5. 检查日文翻译正确
    Expected Result: 三种语言切换均正确
    Failure Indicators: 翻译缺失或切换后仍返回旧语言
    Evidence: .sisyphus/evidence/task-12-locale-switch.txt
  ```

  **Commit**: YES (Wave 2)
  - Message: `feat(i18n): add useLocale composable and AiChatProvider`
  - Files: `packages/ai-chat/src/composables/useLocale.ts`, `src/components/AiChatProvider.vue`

- [x] 13. Layout Shell 组件 — ChatGPT风格布局

  **What to do**:
  - 创建 `packages/ai-chat/src/components/LayoutShell.vue`：
    ```vue
    <!-- ChatGPT风格：左侧sidebar + 右侧main -->
    <template>
      <div class="ai-chat-layout">
        <aside class="ai-chat-sidebar" :class="{ collapsed: sidebarCollapsed }">
          <slot name="sidebar" />
        </aside>
        <main class="ai-chat-main">
          <slot name="header" />
          <div class="ai-chat-content">
            <slot name="messages" />
          </div>
          <div class="ai-chat-input">
            <slot name="input" />
          </div>
        </main>
      </div>
    </template>
    ```
  - CSS样式：
    - 使用CSS变量（`--ai-chat-*`）支持主题定制
    - sidebar默认宽度260px，可折叠
    - main区域flex:1，消息区域overflow-y:auto
    - 响应式：移动端sidebar变为overlay
  - 使用Element Plus的基础组件（ElContainer等可选）

  **TDD — RED phase first**:
  - 测试：组件渲染包含sidebar和main两个区域
  - 测试：sidebar折叠/展开功能
  - 测试：slot正确渲染（sidebar/header/messages/input）
  - 测试：CSS变量存在

  **Must NOT do**:
  - 不在此组件中实现具体业务逻辑
  - 不使用fixed定位（组件可能嵌入任意容器）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 纯UI组件，布局+样式+响应式
  - **Skills**: [`/frontend-ui-ux`]
    - `/frontend-ui-ux`: 需要高质量UI布局实现

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: T14, T15, T16, T19
  - **Blocked By**: T5, T6, T12

  **References**:
  **Pattern References**:
  - ChatGPT布局: sidebar 260px + main flex:1，sidebar可折叠
  - Element Plus Container: ElContainer/ElAside/ElMain 布局模式（参考但不强制使用）

  **Acceptance Criteria**:
  - [ ] LayoutShell组件渲染正确
  - [ ] `vitest run src/components/__tests__/LayoutShell.test.ts` → PASS
  - [ ] 4个slot（sidebar/header/messages/input）正常工作

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 布局结构正确
    Tool: Playwright
    Steps:
      1. 在demo页面渲染LayoutShell
      2. 检查 `.ai-chat-sidebar` 存在且宽度约260px
      3. 检查 `.ai-chat-main` 占据剩余空间
      4. 检查slot内容正确渲染
    Expected Result: 左右布局正确，sidebar和main大小合理
    Failure Indicators: 布局重叠或尺寸异常
    Evidence: .sisyphus/evidence/task-13-layout.png

  Scenario: Sidebar折叠
    Tool: Playwright
    Steps:
      1. 渲染LayoutShell
      2. 点击折叠按钮
      3. 验证sidebar宽度变为0或很小
      4. 验证main区域占满
    Expected Result: 折叠动画平滑，main区域自适应
    Failure Indicators: 折叠不生效或动画卡顿
    Evidence: .sisyphus/evidence/task-13-collapse.png
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(ui): add LayoutShell component with ChatGPT-style layout`
  - Files: `packages/ai-chat/src/components/LayoutShell.vue`

- [x] 14. Sidebar 组件 — 会话列表

  **What to do**:
  - 创建 `packages/ai-chat/src/components/Sidebar.vue`：
    - 顶部：新建会话按钮
    - 中间：会话列表（ElMenu或自定义列表）
      - 每项显示：标题、最后更新时间
      - 右键/长按：删除、重命名
    - 底部：模型选择器（紧凑版）+ Agent选择器（紧凑版）
  - 使用 `useSession` composable 获取会话列表和操作方法
  - 使用 `useLocale` 获取翻译文案
  - 交互：
    - 点击会话项切换会话
    - 新建会话：调用 createConversation
    - 删除：ElMessageBox确认后调用 deleteConversation
    - 重命名：ElInput inline编辑

  **TDD — RED phase first**:
  - 测试：渲染会话列表
  - 测试：点击会话项触发 switchConversation
  - 测试：新建会话按钮触发 createConversation
  - 测试：删除会话确认流程
  - 测试：空状态显示（无会话时）

  **Must NOT do**:
  - 不实现会话分组/搜索功能
  - 不实现拖拽排序

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI组件 + 交互逻辑
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3, after T13 ready)
  - **Parallel Group**: Wave 3
  - **Blocks**: T19
  - **Blocked By**: T10, T12, T13

  **References**:
  **API/Type References**:
  - `packages/ai-chat/src/composables/useSession.ts` — 会话数据和操作（T10）
  - `packages/ai-chat/src/composables/useLocale.ts` — i18n（T12）
  - `packages/ai-chat/src/components/LayoutShell.vue` — sidebar slot（T13）

  **Acceptance Criteria**:
  - [ ] Sidebar组件完整实现
  - [ ] `vitest run src/components/__tests__/Sidebar.test.ts` → PASS (6+ tests)
  - [ ] 新建/删除/切换/重命名功能正常

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 会话列表交互完整
    Tool: Playwright
    Steps:
      1. 渲染Sidebar with 3个mock会话
      2. 点击第2个会话 → 验证高亮状态
      3. 点击"新建会话" → 验证新会话出现在列表
      4. 右键第1个会话 → 点击"删除" → 确认弹窗 → 确认
      5. 验证会话从列表消失
    Expected Result: 所有交互流畅，UI反馈即时
    Failure Indicators: 操作无响应或状态不同步
    Evidence: .sisyphus/evidence/task-14-sidebar-interaction.png

  Scenario: 空状态
    Tool: Playwright
    Steps:
      1. 渲染Sidebar with 0个会话
      2. 验证显示空状态提示文案
      3. 验证"新建会话"按钮仍然可见
    Expected Result: 空状态友好，引导用户新建
    Failure Indicators: 空白页面或按钮不可见
    Evidence: .sisyphus/evidence/task-14-sidebar-empty.png
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(ui): add Sidebar component with session management`
  - Files: `packages/ai-chat/src/components/Sidebar.vue`

- [x] 15. ChatMessageList 组件 — 消息显示 + 流式 + Markdown

  **What to do**:
  - 创建 `packages/ai-chat/src/components/ChatMessageList.vue`：
    - 消息列表容器，自动滚动到底部
    - 使用 `useSession().currentMessages` 获取消息
  - 创建 `packages/ai-chat/src/components/ChatMessage.vue`：
    - 单条消息组件
    - 用户消息：右侧对齐，气泡样式
    - AI消息：左侧对齐，显示agent头像
    - Markdown渲染（markdown-it + highlight.js）
    - 流式状态：光标闪烁动画
    - 代码块：复制按钮 + 语法高亮
    - 头像/名称显示
  - 安装 `markdown-it` 和 `highlight.js`

  **TDD — RED phase first**:
  - 测试：渲染用户消息和AI消息
  - 测试：Markdown内容正确渲染（加粗、链接、代码块）
  - 测试：流式状态指示器（isStreaming=true时显示）
  - 测试：代码块复制按钮
  - 测试：自动滚动到底部

  **Must NOT do**:
  - 不实现消息编辑功能
  - 不实现消息搜索
  - 不使用重量级Markdown库（保持bundle小）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 核心UI组件，Markdown渲染+流式动画+样式
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: T19, T23, T24
  - **Blocked By**: T11, T12, T13

  **References**:
  **Pattern References**:
  - markdown-it: `import MarkdownIt from 'markdown-it'` — 轻量MD渲染器
  - highlight.js: 代码语法高亮，配合markdown-it的highlight选项
  - 流式光标动画: CSS animation blinking cursor

  **API/Type References**:
  - `packages/ai-chat/src/composables/useChat.ts` — isStreaming状态（T11）
  - `packages/ai-chat/src/composables/useSession.ts` — currentMessages（T10）
  - `packages/ai-chat/src/types/index.ts` — ChatMessage（T2）

  **Acceptance Criteria**:
  - [ ] ChatMessageList和ChatMessage组件完整实现
  - [ ] Markdown正确渲染（代码块、加粗、列表、链接）
  - [ ] 流式输出有光标动画
  - [ ] `vitest run src/components/__tests__/ChatMessage*.test.ts` → PASS (8+ tests)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Markdown渲染
    Tool: Playwright
    Steps:
      1. 渲染包含Markdown的消息：
         "**粗体** [链接](http://example.com) `inline code`
         ```javascript
         console.log('hello')
         ```"
      2. 验证粗体显示为<strong>
      3. 验证链接可点击
      4. 验证代码块有语法高亮
      5. 验证代码块有复制按钮
    Expected Result: Markdown完全正确渲染，代码块高亮+复制
    Failure Indicators: 原始Markdown文本显示或高亮缺失
    Evidence: .sisyphus/evidence/task-15-markdown.png

  Scenario: 流式输出动画
    Tool: Playwright
    Steps:
      1. 渲染一条 isStreaming=true 的消息
      2. 验证光标闪烁动画可见
      3. 更新消息内容（模拟流式追加）
      4. 验证列表自动滚动到底部
    Expected Result: 流式输出视觉效果自然流畅
    Failure Indicators: 无动画或不自动滚动
    Evidence: .sisyphus/evidence/task-15-streaming.png
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(ui): add ChatMessageList with markdown rendering and streaming`
  - Files: `packages/ai-chat/src/components/ChatMessageList.vue`, `ChatMessage.vue`

- [x] 16. ChatInput 组件 — 输入区域 + 文件上传

  **What to do**:
  - 创建 `packages/ai-chat/src/components/ChatInput.vue`：
    ```vue
    <template>
      <div class="ai-chat-input-area">
        <div class="input-wrapper">
          <el-input
            v-model="inputText"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 6 }"
            :placeholder="t('chat.placeholder')"
            @keydown.enter.exact="handleSend"
          />
          <div class="input-actions">
            <el-button v-if="fileUploadService" @click="triggerUpload">
              <el-icon><Upload /></el-icon>
            </el-button>
            <el-button
              :type="isStreaming ? 'danger' : 'primary'"
              @click="isStreaming ? stopStreaming() : handleSend()"
            >
              {{ isStreaming ? t('chat.stop') : t('chat.send') }}
            </el-button>
          </div>
        </div>
        <!-- 已选文件预览 -->
        <div v-if="selectedFiles.length" class="file-preview">
          <div v-for="file in selectedFiles" :key="file.name" class="file-item">
            {{ file.name }}
            <el-button size="small" @click="removeFile(file)">×</el-button>
          </div>
        </div>
      </div>
    </template>
    ```
  - Props接收 `fileUploadService`（FileUploadService | null）
  - Enter发送，Shift+Enter换行
  - 流式中显示停止按钮
  - 文件选择+预览（仅当注入了fileUploadService时显示上传按钮）

  **TDD — RED phase first**:
  - 测试：输入文字后Enter触发发送
  - 测试：Shift+Enter不触发发送（换行）
  - 测试：空输入不触发发送
  - 测试：流式中显示停止按钮
  - 测试：文件上传按钮存在性（取决于fileUploadService prop）
  - 测试：发送后清空输入框

  **Must NOT do**:
  - 不实现文件上传的具体逻辑（依赖注入的service）
  - 不支持粘贴图片（简化范围）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI交互组件，输入框+按钮+文件预览
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: T19, T23
  - **Blocked By**: T11, T12, T13

  **References**:
  **API/Type References**:
  - `packages/ai-chat/src/composables/useChat.ts` — sendMessage, stopStreaming, isStreaming（T11）
  - `packages/ai-chat/src/types/index.ts` — FileUploadService, UploadedFile（T2）

  **Acceptance Criteria**:
  - [ ] ChatInput组件完整实现
  - [ ] Enter发送/Shift+Enter换行正确
  - [ ] 文件上传接口集成
  - [ ] `vitest run src/components/__tests__/ChatInput.test.ts` → PASS (6+ tests)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 消息发送交互
    Tool: Playwright
    Steps:
      1. 渲染ChatInput
      2. 输入 "Hello AI"
      3. 按Enter
      4. 验证输入框清空
      5. 验证emit('send', { content: 'Hello AI' })
    Expected Result: 发送后输入框清空，事件正确触发
    Failure Indicators: 输入框未清空或事件未触发
    Evidence: .sisyphus/evidence/task-16-send.txt

  Scenario: 流式中停止按钮
    Tool: Playwright
    Steps:
      1. 设置 isStreaming=true
      2. 验证发送按钮变为停止按钮（红色）
      3. 点击停止按钮
      4. 验证emit('stop')
    Expected Result: 按钮文案和颜色正确切换
    Failure Indicators: 按钮状态不变
    Evidence: .sisyphus/evidence/task-16-stop-btn.png
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(ui): add ChatInput with file upload interface`
  - Files: `packages/ai-chat/src/components/ChatInput.vue`

- [x] 17. ModelSelector 组件

  **What to do**:
  - 创建 `packages/ai-chat/src/components/ModelSelector.vue`：
    - 下拉选择器（ElSelect），显示当前模型
    - 下拉列表显示所有已配置的模型
    - 底部有"管理模型"按钮，打开模型管理对话框
  - 创建 `packages/ai-chat/src/components/ModelManager.vue`：
    - 对话框（ElDialog）形式的模型管理
    - 模型列表（可删除）
    - 新建模型表单：
      - 模型显示名称（name）
      - API提供商（provider: openai/anthropic/custom）
      - API Endpoint
      - API Key（ElInput type=password，可切换显示）
      - 模型名称（modelName: gpt-4o/claude-3-opus等）
      - Temperature滑块
      - Max Tokens输入
  - 使用 `useModel` composable

  **TDD — RED phase first**:
  - 测试：模型下拉列表渲染所有模型
  - 测试：选择模型触发 selectModel
  - 测试：新建模型表单提交
  - 测试：删除模型确认流程
  - 测试：API Key输入框密码模式

  **Must NOT do**:
  - 不验证API Key有效性
  - 不实现模型预设模板

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI组件 + 表单交互
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: T19
  - **Blocked By**: T9, T12

  **References**:
  **API/Type References**:
  - `packages/ai-chat/src/composables/useModel.ts` — 模型数据和操作（T9）

  **Acceptance Criteria**:
  - [ ] ModelSelector + ModelManager 组件完整
  - [ ] 模型创建/删除/切换功能正常
  - [ ] `vitest run src/components/__tests__/Model*.test.ts` → PASS (5+ tests)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 模型选择和切换
    Tool: Playwright
    Steps:
      1. 渲染ModelSelector with 2个mock模型
      2. 当前选中模型名称显示
      3. 打开下拉 → 选择另一个模型
      4. 验证选中状态更新
    Expected Result: 模型切换即时反映
    Failure Indicators: 下拉不响应或选中状态不变
    Evidence: .sisyphus/evidence/task-17-model-select.png

  Scenario: 新建模型
    Tool: Playwright
    Steps:
      1. 打开ModelManager对话框
      2. 填写: name="My GPT-4", provider="openai", endpoint="https://api.openai.com/v1", apiKey="sk-xxx", modelName="gpt-4o"
      3. 点击确认
      4. 验证新模型出现在列表
    Expected Result: 模型创建成功并出现在列表
    Failure Indicators: 表单验证失败或创建后不显示
    Evidence: .sisyphus/evidence/task-17-model-create.png
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(ui): add ModelSelector and ModelManager components`
  - Files: `packages/ai-chat/src/components/ModelSelector.vue`, `ModelManager.vue`

- [x] 18. AgentSelector 组件

  **What to do**:
  - 创建 `packages/ai-chat/src/components/AgentSelector.vue`：
    - 下拉选择器（ElSelect），显示当前Agent
    - 列表显示所有已注册的Agent（内置 + 自定义）
    - 每个选项显示：agent名称、描述、内置/自定义标记
  - 使用 `agentRegistry` 获取agent列表

  **TDD — RED phase first**:
  - 测试：Agent列表渲染
  - 测试：选择Agent触发事件
  - 测试：内置Agent标记显示
  - 测试：空agent列表处理

  **Must NOT do**:
  - 不实现自定义Agent创建UI（system prompt编辑，后续迭代）
  - 不实现Agent删除

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 简单UI组件
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: T19
  - **Blocked By**: T8, T12

  **References**:
  **API/Type References**:
  - `packages/ai-chat/src/services/agent.ts` — agentRegistry（T8）
  - `packages/ai-chat/src/types/index.ts` — AgentDefinition（T2）

  **Acceptance Criteria**:
  - [ ] AgentSelector组件完整
  - [ ] 显示内置和自定义agent
  - [ ] `vitest run src/components/__tests__/AgentSelector.test.ts` → PASS (4+ tests)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Agent列表和选择
    Tool: Playwright
    Steps:
      1. 注册2个mock agent（1内置+1自定义）
      2. 渲染AgentSelector
      3. 验证下拉显示2个选项
      4. 选择第2个agent
      5. 验证选中状态更新
    Expected Result: Agent列表和选择功能正常
    Failure Indicators: 列表为空或选择不响应
    Evidence: .sisyphus/evidence/task-18-agent-select.png
  ```

  **Commit**: YES (Wave 3)
  - Message: `feat(ui): add AgentSelector component`
  - Files: `packages/ai-chat/src/components/AgentSelector.vue`

- [ ] 19. AiChat 主组件 — 整合所有子组件

  **What to do**:
  - 创建 `packages/ai-chat/src/components/AiChat.vue`：
    ```vue
    <template>
      <AiChatProvider :locale="locale">
        <LayoutShell v-model:sidebar-collapsed="sidebarCollapsed">
          <template #sidebar>
            <Sidebar />
          </template>
          <template #header>
            <div class="ai-chat-header">
              <AgentSelector />
              <ModelSelector />
            </div>
          </template>
          <template #messages>
            <ChatMessageList />
          </template>
          <template #input>
            <ChatInput :file-upload-service="fileUploadService" />
          </template>
        </LayoutShell>
      </AiChatProvider>
    </template>
    ```
  - Props：
    ```typescript
    interface AiChatProps {
      locale?: AiChatLocale | 'zh-cn' | 'en' | 'ja'  // 默认 'en'
      fileUploadService?: FileUploadService | null
      defaultModelId?: string
      defaultAgentId?: string
    }
    ```
  - 初始化逻辑：
    - 组件mount时初始化默认模型和agent
    - 如无会话，自动创建新会话

  **TDD — RED phase first**:
  - 测试：AiChat组件渲染所有子组件
  - 测试：locale prop正确传递
  - 测试：fileUploadService prop正确传递
  - 测试：初始化流程（默认模型/agent/会话）
  - 测试：完整聊天流程（发送→流式→完成）

  **Must NOT do**:
  - 不在主组件中添加过多逻辑（保持thin orchestrator模式）
  - 不直接操作IndexDB（通过composables）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要协调所有子组件和composables的集成
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential, depends on all Wave 3)
  - **Blocks**: T20, T22
  - **Blocked By**: T13-T18

  **References**:
  **API/Type References**:
  - T13 LayoutShell, T14 Sidebar, T15 ChatMessageList, T16 ChatInput, T17 ModelSelector, T18 AgentSelector
  - T11 useChat, T9 useModel, T10 useSession, T12 useLocale

  **Acceptance Criteria**:
  - [ ] AiChat组件整合所有子组件
  - [ ] 完整聊天流程可运行
  - [ ] `vitest run src/components/__tests__/AiChat.test.ts` → PASS (5+ tests)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: AiChat完整渲染
    Tool: Playwright
    Steps:
      1. 渲染AiChat组件（mock所有services）
      2. 验证sidebar可见
      3. 验证header包含AgentSelector和ModelSelector
      4. 验证消息区域可见
      5. 验证输入区域可见
    Expected Result: 所有子组件正确渲染，布局完整
    Failure Indicators: 子组件缺失或布局异常
    Evidence: .sisyphus/evidence/task-19-aichat-render.png

  Scenario: 完整聊天流程
    Tool: Playwright
    Steps:
      1. 渲染AiChat
      2. 在输入框输入 "Hello"
      3. 按Enter发送
      4. 验证用户消息出现在聊天区域
      5. 验证AI回复开始流式显示
      6. 验证流式完成后消息完整
    Expected Result: 完整的发送→流式→显示流程
    Failure Indicators: 任何环节断裂
    Evidence: .sisyphus/evidence/task-19-full-chat.png
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat: add AiChat main component integrating all sub-components`
  - Files: `packages/ai-chat/src/components/AiChat.vue`

- [ ] 20. 组件库入口 — exports + install plugin

  **What to do**:
  - 更新 `packages/ai-chat/src/index.ts`：
    ```typescript
    // 组件
    export { default as AiChat } from './components/AiChat.vue'
    export { default as AiChatProvider } from './components/AiChatProvider.vue'

    // 类型
    export type {
      ChatMessage, Conversation, ModelConfig, AgentDefinition,
      AgentRunner, ChatOptions, ChatChunk, FileUploadService,
      UploadedFile, AiChatLocale
    } from './types'

    // Composables
    export { useChat } from './composables/useChat'
    export { useSession } from './composables/useSession'
    export { useModel } from './composables/useModel'
    export { useLocale } from './composables/useLocale'

    // Agent注册
    export { agentRegistry, registerAgent } from './services/agent'

    // Locale文件
    export { zhCn, en, ja } from './locales'

    // Vue Plugin (可选安装)
    import type { App } from 'vue'
    import AiChat from './components/AiChat.vue'

    export const AiChatPlugin = {
      install(app: App) {
        app.component('AiChat', AiChat)
      }
    }
    ```

  **TDD — RED phase first**:
  - 测试：所有导出项存在且类型正确
  - 测试：AiChatPlugin.install 注册组件
  - 测试：构建后导出正确（可选）

  **Must NOT do**:
  - 不在install时自动注册Element Plus（消费者自行处理）
  - 不添加全局副作用

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 纯导出文件，逻辑简单
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4)
  - **Parallel Group**: Wave 4 (with T21)
  - **Blocks**: T22, T25
  - **Blocked By**: T19, T6

  **References**:
  **Pattern References**:
  - Vue3组件库plugin模式: `app.component()` 注册全局组件
  - PrimeVue导出模式: 分层导出（components/types/composables分离）

  **Acceptance Criteria**:
  - [ ] index.ts导出所有组件、类型、composables
  - [ ] AiChatPlugin.install可用
  - [ ] `vitest run src/__tests__/index.test.ts` → PASS

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 导出完整性
    Tool: Bash
    Steps:
      1. 运行index.ts的导入测试
      2. 验证所有命名导出存在
      3. 验证类型导出可被TypeScript识别
    Expected Result: 所有导出无遗漏
    Failure Indicators: 导出缺失或类型错误
    Evidence: .sisyphus/evidence/task-20-exports.txt

  Scenario: Plugin安装
    Tool: Bash
    Steps:
      1. 创建Vue app，调用 AiChatPlugin.install(app)
      2. 验证 app.component('AiChat') 存在
    Expected Result: Plugin正确注册AiChat组件
    Failure Indicators: 组件未注册
    Evidence: .sisyphus/evidence/task-20-plugin.txt
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat: add library entry point with exports and Vue plugin`
  - Files: `packages/ai-chat/src/index.ts`

- [ ] 21. Demo 应用脚手架

  **What to do**:
  - 创建 `apps/demo/` 完整的Vite Vue3应用：
    ```
    apps/demo/
    ├── src/
    │   ├── App.vue
    │   ├── main.ts
    │   └── env.d.ts
    ├── index.html
    ├── package.json       # dependencies引用workspace:*
    ├── vite.config.ts
    └── tsconfig.json
    ```
  - `main.ts`：引入Element Plus + @ai-chat/vue组件库
  - `App.vue`：基础结构，router占位（可选）
  - 配置CORS代理（vite.config.ts proxy → 后端AI API，如需要）

  **Must NOT do**:
  - 不在脚手架中实现完整Demo页面（T22处理）
  - 不配置生产部署（仅开发用途）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 标准Vite Vue3应用脚手架
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4, with T20)
  - **Parallel Group**: Wave 4
  - **Blocks**: T22
  - **Blocked By**: T1

  **References**:
  **Pattern References**:
  - PrimeVue showcase: apps/showcase/ 独立app包
  - Vite Vue3应用模板: `npm create vite@latest`

  **Acceptance Criteria**:
  - [ ] `pnpm --filter demo dev` 启动无错误
  - [ ] 页面可访问（localhost）
  - [ ] Element Plus正确集成

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Demo应用启动
    Tool: Bash
    Steps:
      1. 运行 `pnpm --filter demo dev`
      2. 等待Vite启动完成
      3. curl http://localhost:5173 验证HTML返回
    Expected Result: Demo应用成功启动
    Failure Indicators: 启动失败或编译错误
    Evidence: .sisyphus/evidence/task-21-demo-start.txt
  ```

  **Commit**: YES (Wave 4)
  - Message: `chore(demo): add demo app scaffolding`
  - Files: `apps/demo/`

- [ ] 22. Demo 完整页面 — 真实AI对话

  **What to do**:
  - 实现 `apps/demo/src/App.vue` 完整Demo页面：
    ```vue
    <template>
      <div class="demo-app">
        <AiChat
          locale="zh-cn"
          :file-upload-service="fileUploadService"
        />
      </div>
    </template>
    ```
  - 配置Element Plus中文locale
  - 实现简单的FileUploadService mock（可选：上传到本地/返回mock URL）
  - 页面标题和简单样式
  - 添加使用说明（如何在Demo中配置API Key）

  **Must NOT do**:
  - 不实现复杂的Demo路由（单页面即可）
  - 不添加不必要的装饰性UI

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 集成测试性质的完整Demo实现
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after T19, T20, T21)
  - **Blocks**: T25
  - **Blocked By**: T19, T20, T21

  **References**:
  **API/Type References**:
  - `packages/ai-chat/src/components/AiChat.vue` — 主组件（T19）
  - `packages/ai-chat/src/index.ts` — 导出（T20）

  **Acceptance Criteria**:
  - [ ] Demo页面渲染AiChat组件
  - [ ] 可以配置模型（endpoint, API key）
  - [ ] 可以与AI进行真实对话
  - [ ] 会话管理功能可用

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Demo完整使用流程
    Tool: Playwright
    Steps:
      1. 打开Demo页面
      2. 验证AiChat组件渲染（sidebar + 聊天区域）
      3. 点击"管理模型"，创建一个模型配置（mock endpoint）
      4. 新建会话
      5. 输入消息并发送
      6. 验证用户消息显示
    Expected Result: 完整Demo功能可用
    Failure Indicators: 任何步骤失败
    Evidence: .sisyphus/evidence/task-22-demo-flow.png

  Scenario: 国际化切换
    Tool: Playwright
    Steps:
      1. 验证默认中文UI文案
      2. （如有切换功能）切换到英文
      3. 验证UI文案变为英文
    Expected Result: 国际化正确生效
    Failure Indicators: 文案显示为key而非翻译
    Evidence: .sisyphus/evidence/task-22-i18n.png
  ```

  **Commit**: YES (Wave 4)
  - Message: `feat(demo): add full functional demo page with real AI chat`
  - Files: `apps/demo/src/`

- [ ] 23. 错误处理 + 重试 UI

  **What to do**:
  - 在ChatMessage组件中添加错误消息样式：
    - AI错误消息用红色边框/背景标记
    - 显示具体错误信息（网络错误/API Key错误/流式中断）
  - 在错误消息下方添加"重试"按钮
  - 重试逻辑：重新发送最后一条用户消息
  - 在ChatInput中处理发送失败：
    - 发送失败时保留输入内容
    - 显示错误toast提示
  - 网络断连检测（navigator.onLine）

  **TDD — RED phase first**:
  - 测试：错误消息渲染红色样式
  - 测试：重试按钮触发重新发送
  - 测试：网络错误时显示正确文案
  - 测试：API Key错误时显示正确文案

  **Must NOT do**:
  - 不实现自动重试（仅手动重试）
  - 不实现断线重连（仅检测和提示）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 错误处理逻辑 + UI样式 + 边界情况
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 5)
  - **Parallel Group**: Wave 5 (with T24, T25)
  - **Blocks**: —
  - **Blocked By**: T15, T16

  **References**:
  **API/Type References**:
  - `packages/ai-chat/src/components/ChatMessage.vue` — 消息组件（T15）
  - `packages/ai-chat/src/components/ChatInput.vue` — 输入组件（T16）
  - `packages/ai-chat/src/types/index.ts` — ChatChunk type === 'error'（T2）

  **Acceptance Criteria**:
  - [ ] 错误消息有视觉区分（红色标记）
  - [ ] 重试按钮功能正常
  - [ ] `vitest run src/components/__tests__/ChatMessage.test.ts` → PASS (新增错误相关tests)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 错误消息显示
    Tool: Playwright
    Steps:
      1. 渲染一条错误消息（content含"❌ Error: API Key invalid"）
      2. 验证消息有红色边框/背景
      3. 验证"重试"按钮可见
    Expected Result: 错误消息视觉上明显区分于正常消息
    Failure Indicators: 无视觉区分或重试按钮缺失
    Evidence: .sisyphus/evidence/task-23-error-msg.png

  Scenario: 重试功能
    Tool: Playwright
    Steps:
      1. 渲染错误消息和重试按钮
      2. 点击"重试"
      3. 验证重新发送最后一条用户消息
      4. 验证错误消息被替换或新消息出现
    Expected Result: 重试成功触发新的流式请求
    Failure Indicators: 重试按钮无响应
    Evidence: .sisyphus/evidence/task-23-retry.txt
  ```

  **Commit**: YES (Wave 5)
  - Message: `feat(ui): add error handling with retry UI`
  - Files: ChatMessage.vue, ChatInput.vue updates

- [ ] 24. 空状态处理

  **What to do**:
  - Sidebar空状态：无会话时显示引导文案 + "新建会话"按钮
  - 聊天区域空状态：当前会话无消息时显示欢迎界面
    - 显示当前Agent名称和图标
    - 显示欢迎文案（可配置）
    - 显示快捷提示词（可选）
  - 无模型配置时：引导用户配置模型

  **TDD — RED phase first**:
  - 测试：Sidebar空会话显示引导
  - 测试：聊天区域空消息显示欢迎界面
  - 测试：无模型时显示配置引导

  **Must NOT do**:
  - 不实现快捷提示词功能（仅预留位置）
  - 不在空状态中引入复杂动画

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: UI空状态组件，逻辑简单
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 5)
  - **Parallel Group**: Wave 5
  - **Blocks**: —
  - **Blocked By**: T14, T15

  **References**:
  **API/Type References**:
  - `packages/ai-chat/src/components/Sidebar.vue` — 会话列表（T14）
  - `packages/ai-chat/src/components/ChatMessageList.vue` — 消息列表（T15）

  **Acceptance Criteria**:
  - [ ] 三种空状态均有友好UI
  - [ ] 空状态文案走i18n
  - [ ] 测试通过

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 无会话空状态
    Tool: Playwright
    Steps:
      1. 渲染Sidebar with 0个会话
      2. 验证显示空状态引导文案
      3. 验证"新建会话"按钮可见且可点击
    Expected Result: 空状态友好，有明确引导
    Evidence: .sisyphus/evidence/task-24-empty-sidebar.png

  Scenario: 无消息欢迎界面
    Tool: Playwright
    Steps:
      1. 选择一个会话（无消息）
      2. 验证显示欢迎界面
      3. 验证欢迎文案使用当前locale语言
    Expected Result: 欢迎界面美观且国际化正确
    Evidence: .sisyphus/evidence/task-24-welcome.png
  ```

  **Commit**: YES (Wave 5)
  - Message: `feat(ui): add empty states for sidebar and chat area`
  - Files: Sidebar.vue, ChatMessageList.vue updates

- [ ] 25. 构建验证 + npm pack 测试

  **What to do**:
  - 运行完整构建流程：
    1. `pnpm --filter @ai-chat/vue build` → 生成dist/
    2. `pnpm --filter @ai-chat/vue type-check` → TypeScript无错误
    3. `pnpm test` → 所有测试通过
    4. `pnpm --filter demo build` → Demo构建成功
  - 验证npm pack产物：
    - `pnpm --filter @ai-chat/vue pack --dry-run`
    - 确认包含所有必要文件（.js, .css, .d.ts）
    - 确认不包含源码、测试文件、node_modules
  - 验证产物可用性：
    - 在demo中使用packed的tarball安装
    - 确认组件正常工作
  - 修复所有发现的问题

  **TDD —**:
  - 此task是验证性质，不新增测试
  - 确保所有已有测试通过

  **Must NOT do**:
  - 不发布到npm registry（仅本地验证）
  - 不修改package.json版本号

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 构建调试可能需要解决问题
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (must be last before Final)
  - **Parallel Group**: Wave 5 (after T20, T22)
  - **Blocks**: F1-F4
  - **Blocked By**: T20, T22

  **References**:
  **API/Type References**:
  - `packages/ai-chat/vite.config.ts` — 构建配置（T6）
  - `packages/ai-chat/package.json` — exports配置（T6）

  **Acceptance Criteria**:
  - [ ] `pnpm build` 成功
  - [ ] `pnpm test` 全部通过
  - [ ] npm pack 产物完整（含 .js, .css, .d.ts）
  - [ ] Demo构建成功

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 完整构建流程
    Tool: Bash
    Steps:
      1. 运行 `pnpm build`
      2. 检查 packages/ai-chat/dist/ 内容
      3. 验证: ai-chat.js (ESM), ai-chat.umd.cjs (UMD), style.css, types/index.d.ts
      4. 运行 `pnpm test`
    Expected Result: 构建和测试全部通过
    Failure Indicators: 任何构建错误或测试失败
    Evidence: .sisyphus/evidence/task-25-build.txt

  Scenario: npm pack产物检查
    Tool: Bash
    Steps:
      1. 运行 `pnpm --filter @ai-chat/vue pack --dry-run 2>&1`
      2. 验证包含: dist/ai-chat.js, dist/style.css, dist/types/
      3. 验证不包含: src/, __tests__/, node_modules/
    Expected Result: 产物干净，仅包含dist内容
    Failure Indicators: 包含源码或测试文件
    Evidence: .sisyphus/evidence/task-25-pack.txt

  Scenario: Demo构建成功
    Tool: Bash
    Steps:
      1. 运行 `pnpm --filter demo build`
      2. 验证 apps/demo/dist/ 生成
    Expected Result: Demo构建成功，无错误
    Failure Indicators: 构建失败
    Evidence: .sisyphus/evidence/task-25-demo-build.txt
  ```

  **Commit**: YES (Wave 5)
  - Message: `chore: verify build pipeline and npm pack output`
  - Files: any fixes applied
  - Pre-commit: `pnpm build && pnpm test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `pnpm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state (`pnpm install && pnpm build && pnpm dev`). Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Test edge cases: empty state, network error, rapid send. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec. Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Wave | Commit Message | Files | Pre-commit |
|------|---------------|-------|------------|
| 1 | `chore: initialize pnpm monorepo with Vue3 + TS + Vite` | all Wave 1 files | `pnpm type-check` |
| 2 | `feat(core): add database, agent, model, session, chat services` | all Wave 2 files | `pnpm test` |
| 3 | `feat(ui): add all chat UI components` | all Wave 3 files | `pnpm test` |
| 4 | `feat: integrate AiChat component and demo app` | all Wave 4 files | `pnpm test && pnpm build` |
| 5 | `feat: add error handling, empty states, and build verification` | all Wave 5 files | `pnpm test && pnpm build` |

---

## Success Criteria

### Verification Commands
```bash
pnpm install              # Expected: dependencies installed successfully
pnpm build                # Expected: dist/ with ESM + UMD + CSS + .d.ts
pnpm test                 # Expected: all tests pass
pnpm dev                  # Expected: demo app running on localhost
pnpm --filter @ai-chat/vue type-check  # Expected: no type errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Demo app can chat with real AI
- [ ] i18n works (zh/en/ja switching)
- [ ] Library builds as npm package
