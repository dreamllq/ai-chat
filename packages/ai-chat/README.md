# @ai-chat/vue

Vue 3 AI 聊天组件库。内置 LangChain.js 驱动的智能体引擎、IndexedDB 本地持久化、流式对话输出，支持自定义工具和 MCP 服务器集成。

## 特性

- 🧩 **开箱即用** — `<AiChat />` 一行代码即可接入
- 🤖 **配置式智能体** — 通过 `registerAgent()` 注册，无需手写 Runner
- 🧠 **深度智能体** — 内置 `DeepAgentRunner`，支持子 Agent 调度、技能加载和推理过程展示
- 🔧 **工具调用** — 支持纯函数工具和 Zod Schema 结构化工具
- 🔌 **MCP 集成** — 接入任何兼容 MCP 协议的外部工具服务
- 🌊 **流式输出** — Token 级实时流式响应，支持推理内容流式展示
- 📊 **Token 统计** — 自动追踪每条消息和每次子 Agent 调用的 Token 用量
- 💾 **本地持久化** — 基于 Dexie (IndexedDB)，会话和消息自动保存
- 🌍 **多语言** — 内置中文、英文、日文，支持自定义 locale
- 📎 **文件上传** — 通过 `FileUploadService` 接口对接任意存储后端
- 🔄 **请求代理** — 通过 `requestInterceptor` 支持后端代理、动态 Token 刷新和自定义请求头

## 安装

```bash
pnpm add @ai-chat/vue
```

> **Peer Dependencies**: 需要 `vue >= 3.3` 和 `element-plus >= 2.4`。

## 快速开始

### 1. 全局注册组件

```ts
// main.ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import { AiChatPlugin } from '@ai-chat/vue'
import '@ai-chat/vue/style.css'

const app = createApp(App)
app.use(ElementPlus)
app.use(AiChatPlugin)
app.mount('#app')
```

### 2. 在模板中使用

```vue
<template>
  <AiChat locale="zh-cn" />
</template>
```

或者直接在组件中导入：

```vue
<script setup>
import { AiChat } from '@ai-chat/vue'
import '@ai-chat/vue/style.css'
</script>

<template>
  <AiChat locale="zh-cn" />
</template>
```

### 3. 完整示例

```vue
<script setup>
import { ref } from 'vue'
import { AiChat, registerAgent } from '@ai-chat/vue'
import '@ai-chat/vue/style.css'

// 注册自定义智能体（可选）
registerAgent({
  id: 'my-agent',
  name: 'My Agent',
  description: '我的自定义智能体',
  systemPrompt: '你是一个友好的助手。',
})

const locale = ref('zh-cn')
</script>

<template>
  <div style="width: 100%; height: 100vh;">
    <AiChat :locale="locale" />
  </div>
</template>
```

## 自定义智能体

通过 `registerAgent()` 注册智能体。框架会自动创建内部 LangChain Runner 处理 LLM 调用、工具执行循环和流式输出，**你只需提供配置**。

### 基础智能体

最简单的智能体只包含 `id` 和 `name`：

```ts
import { registerAgent } from '@ai-chat/vue'

registerAgent({
  id: 'simple-chat',
  name: 'Simple Chat',
  description: '基础对话智能体',
  systemPrompt: '你是一个有帮助的 AI 助手，请用中文回复。',
})
```

### 带工具的智能体

工具分为两种：**简单工具**（字符串输入）和**结构化工具**（Zod Schema 输入）。

#### 简单工具（字符串输入）

```ts
import { registerAgent } from '@ai-chat/vue'

registerAgent({
  id: 'tool-agent',
  name: 'Tool Agent',
  description: '支持工具调用的智能体',
  systemPrompt: '你是一个智能助手。需要计算时使用计算器工具。',
  tools: [
    {
      name: 'calculator',
      description: '计算数学表达式。例如 "2+3*4"、"100/3"。',
      execute: async (input: string) => {
        const result = new Function(`"use strict"; return (${input})`)()
        return `计算结果: ${result}`
      },
    },
    {
      name: 'get_current_time',
      description: '获取当前日期和时间。',
      execute: async () => {
        return new Date().toLocaleString('zh-CN')
      },
    },
  ],
})
```

#### 结构化工具（Zod Schema）

使用 Zod 定义参数结构，LLM 会看到完整的参数描述并传入结构化 JSON：

```ts
import { z } from 'zod'
import { registerAgent } from '@ai-chat/vue'

const FormFieldSchema = z.object({
  name: z.string().describe('字段名'),
  label: z.string().describe('显示标签'),
  type: z.enum(['input', 'select', 'textarea']).describe('字段类型'),
  required: z.boolean().optional().describe('是否必填'),
})

const FormSchema = z.object({
  title: z.string().describe('表单标题'),
  fields: z.array(FormFieldSchema).describe('字段列表'),
})

registerAgent({
  id: 'form-agent',
  name: 'Form Generator',
  description: '生成表单 Schema 的智能体',
  systemPrompt: '你是一个表单生成助手，通过工具生成表单结构。',
  tools: [
    {
      name: 'get_form_schema',
      description: '获取当前表单 Schema',
      execute: async () => '暂无表单',
    },
    {
      name: 'submit_form_schema',
      description: '提交表单 Schema',
      schema: FormSchema, // LLM 会看到完整的参数结构
      execute: async (input) => {
        console.log('表单已生成:', input)
        return `表单 "${input.title}" 已创建，共 ${input.fields.length} 个字段`
      },
    },
  ],
})
```

### 带 MCP 服务器的智能体

MCP（Model Context Protocol）允许接入外部工具服务：

```ts
import { registerAgent } from '@ai-chat/vue'

registerAgent({
  id: 'mcp-agent',
  name: 'MCP Agent',
  description: '接入 MCP 工具服务的智能体',
  systemPrompt: '你是一个可以调用外部工具的助手。',
  mcpServers: [
    {
      name: 'my-tools',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@example/mcp-server'],
      env: {
        API_KEY: 'your-api-key',
      },
    },
    {
      name: 'remote-tools',
      transport: 'sse',
      url: 'https://example.com/mcp/sse',
      headers: {
        Authorization: 'Bearer your-token',
      },
    },
  ],
})
```

MCP 连接采用懒加载策略，首次使用时才会建立连接，连接失败时优雅降级。

## 组件 API

### `<AiChat />`

主组件，包含完整的聊天界面（侧边栏 + 消息列表 + 输入框）。

#### Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `locale` | `AiChatLocale \| LocaleName` | `'en'` | 界面语言，支持 `'zh-cn'`、`'en'`、`'ja'` 或自定义 locale 对象 |
| `fileUploadService` | `FileUploadService \| null` | `null` | 文件上传服务，实现 `upload()` 和 `getFileUrl()` 方法 |
| `defaultSidebarCollapsed` | `boolean` | `false` | 侧边栏默认是否折叠 |
| `sidebarCollapsed` | `boolean` | `undefined` | 侧边栏折叠状态（受控模式，支持 `v-model:sidebar-collapsed`） |
| `showAgentSelector` | `boolean` | `true` | 是否在输入区域显示智能体选择器 |
| `defaultAgentId` | `string` | `undefined` | 默认选中的智能体 ID，未设置时自动选中第一个可用智能体 |
| `showModelSelector` | `boolean` | `true` | 是否在输入区域显示模型选择器 |
| `defaultModelId` | `string` | `undefined` | 默认选中的模型 ID，未设置时自动选中第一个可用模型 |
| `models` | `ModelConfig[]` | `undefined` | 通过 props 传入的模型列表，会与 IndexedDB 中的模型合并 |

#### Emits

| 事件 | 参数 | 说明 |
|------|------|------|
| `update:sidebarCollapsed` | `(value: boolean)` | 侧边栏折叠状态变化时触发 |

#### Slots

| 插槽 | 说明 |
|------|------|
| `empty` | 无消息时的空状态内容 |

#### 使用示例

```vue
<!-- 基础用法 -->
<AiChat locale="zh-cn" />

<!-- 完整配置 -->
<AiChat
  locale="zh-cn"
  :file-upload-service="myUploadService"
  :default-sidebar-collapsed="true"
  v-model:sidebar-collapsed="collapsed"
  show-agent-selector
  default-agent-id="my-agent"
  show-model-selector
  default-model-id="qwen-turbo"
  :models="myModels"
>
  <template #empty>
    <div>开始新的对话</div>
  </template>
</AiChat>
```

### `<AiChatProvider />`

国际化 Provider 组件。单独使用时只为子树提供 locale 上下文，不含 UI：

```vue
<AiChatProvider locale="zh-cn">
  <!-- 你的自定义布局 -->
</AiChatProvider>
```

## Composables

所有 composable 均为模块级单例模式，可在任意组件中调用，共享同一份状态。

### `useChat()`

聊天核心逻辑。

```ts
const { isStreaming, currentMessages, sendMessage, stopStreaming } = useChat()

// 当前消息列表（响应式，自动跟踪 IndexedDB 变化）
currentMessages // Ref<ChatMessage[]>

// 发送消息（支持附件）
sendMessage('你好')
sendMessage('请看这张图', attachments)

// 停止流式输出
stopStreaming()
```

### `useSession()`

会话管理。

```ts
const {
  conversations,          // 会话列表
  currentConversation,    // 当前会话
  currentConversationId,  // 当前会话 ID
  currentMessages,        // 当前会话的消息列表
  createConversation,     // 创建新会话
  deleteConversation,     // 删除会话
  clearAllConversations,  // 清空所有会话
  renameConversation,     // 重命名会话
  switchConversation,     // 切换会话
} = useSession()
```

### `useModel()`

模型配置管理。

```ts
const {
  models,          // 已配置的模型列表（DB + props 合并）
  currentModelId,  // 当前选中的模型 ID
  currentModel,    // 当前选中的模型配置对象
  selectModel,     // 切换模型
  createModel,     // 创建新模型
  updateModel,     // 更新模型配置
  deleteModel,     // 删除模型
  initDefault,     // 初始化默认模型（AiChat 内部调用）
} = useModel()
```

### `useAgent()`

智能体管理。

```ts
const {
  agents,          // 已注册的智能体列表（DB + registry 合并）
  currentAgentId,  // 当前选中的智能体 ID
  currentAgent,    // 当前选中的智能体定义对象
  selectAgent,     // 切换智能体
  initDefault,     // 初始化默认智能体（AiChat 内部调用）
} = useAgent()
```

### `useLocale()`

国际化。

```ts
const { locale, setLocale, t } = useLocale()

// 切换语言
setLocale('zh-cn')

// 翻译 key
t('chat.send')  // → '发送'
```

## 文件上传

`<AiChat>` 通过 `fileUploadService` prop 支持文件上传。该接口只定义行为规范，**不内置任何上传实现**，你可以对接 S3、OSS、自建后端等任意存储服务。

### 工作流程

```
用户选择文件 → addFile() → fileUploadService.upload() 上传 → 展示进度 → 成功/失败
                                                      ↓ (无 service)
                                                 转 Base64 内联
```

1. 用户点击输入框工具栏的📎按钮选择文件（支持多选）
2. 如果提供了 `fileUploadService`，调用 `upload()` 上传到远端，UI 实时显示进度
3. 如果**未提供** `fileUploadService`，文件会自动转为 Base64 Data URL 内联到消息中（无需服务端）
4. 上传成功后，文件作为 `MessageAttachment` 附加到发送的消息中
5. 上传失败的文件会显示错误状态和重试按钮

### 接口定义

```ts
interface FileUploadService {
  /** 上传文件，返回已上传文件信息 */
  upload(file: File, options?: FileUploadOptions): Promise<UploadedFile>
  /** 根据 fileId 获取文件访问 URL（用于消息展示） */
  getFileUrl(fileId: string): Promise<string>
}

interface FileUploadOptions {
  /** 上传进度回调，可用于显示进度条 */
  onProgress?: (event: FileUploadProgressEvent) => void
  /** 取消信号，用户移除文件时触发 abort */
  signal?: AbortSignal
}

interface FileUploadProgressEvent {
  loaded: number   // 已上传字节
  total: number    // 总字节
  percent: number  // 进度百分比 (0-100)
}

interface UploadedFile {
  id: string       // 文件唯一标识
  name: string     // 文件名
  url: string      // 文件访问 URL
  size: number     // 文件大小 (字节)
  mimeType: string // MIME 类型
}
```

### 使用方式

#### 1. 不提供 fileUploadService（Base64 内联模式）

不传 `fileUploadService` 或传 `null` 时，组件会将文件自动转为 Base64 Data URL，直接内联到消息的 `attachments` 中，**无需任何后端服务**：

```vue
<template>
  <AiChat locale="zh-cn" />
</template>
```

此模式下消息中的 `MessageAttachment` 会包含 `data` 字段（Base64 Data URL），而 `url` 为空。

#### 2. 自定义上传服务（对接任意存储后端）

实现 `FileUploadService` 接口，传入组件即可：

```ts
import type { FileUploadService } from '@ai-chat/vue'

const myUploadService: FileUploadService = {
  async upload(file, options) {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      signal: options?.signal, // 支持用户取消
    })

    const data = await res.json()
    return {
      id: data.id,
      name: file.name,
      url: data.url,
      size: file.size,
      mimeType: file.type,
    }
  },

  async getFileUrl(fileId: string) {
    return `/api/files/${fileId}`
  },
}
```

```vue
<template>
  <AiChat locale="zh-cn" :file-upload-service="myUploadService" />
</template>
```

此模式下消息中的 `MessageAttachment` 会包含 `url` 字段，`data` 为空。

#### 3. 对接 S3 存储（使用 @ai-chat/storage-s3）

```ts
import { S3StorageService } from '@ai-chat/storage-s3'
import type { S3StorageConfig } from '@ai-chat/storage-s3'

const s3Config: S3StorageConfig = {
  endpoint: 'https://s3.amazonaws.com',
  region: 'us-east-1',
  bucket: 'my-chat-files',
  accessKeyId: 'YOUR_ACCESS_KEY',
  secretAccessKey: 'YOUR_SECRET_KEY',
  forcePathStyle: false,
}

const fileUploadService = new S3StorageService(s3Config)
```

```vue
<template>
  <AiChat locale="zh-cn" :file-upload-service="fileUploadService" />
</template>
```

### 附件类型

上传的文件会根据 MIME 类型自动归类为以下 `AttachmentType`：

| 类型 | MIME 前缀 |
|------|-----------|
| `image` | `image/*` |
| `audio` | `audio/*` |
| `video` | `video/*` |
| `document` | 其他所有类型 |

### 上传状态管理

组件内部通过 `useFileUpload` composable 管理上传生命周期，每个文件经历以下状态：

```
pending → uploading → success
                    → failed → (retry) → uploading → ...
```

- **进度展示**：上传过程中实时更新进度百分比，UI 显示进度条覆盖层
- **失败重试**：上传失败的文件显示错误提示和重试按钮，点击重新上传
- **取消上传**：用户在完成前移除文件，自动 `abort()` 取消进行中的请求
- **全部就绪检查**：发送按钮仅在所有文件上传成功后才可用

## 请求代理

默认情况下，组件直接从前端请求 LLM API，需要用户在前端配置 `endpoint` 和 `apiKey`。但在很多场景下这不太适合：

- **跨域问题**：浏览器直接请求第三方 API 受 CORS 限制
- **密钥安全**：`apiKey` 存在前端 IndexedDB 中会被用户看到
- **动态鉴权**：后端代理可能需要带动态刷新的 `access_token`，不能写死

通过 `ModelConfig` 的 `requestInterceptor` 字段，可以在每次 LLM API 请求前拦截并修改请求参数。

### 使用方式

带 `requestInterceptor` 的模型需通过 `<AiChat>` 的 `:models` prop 注入（因为函数不可序列化，不能存入 IndexedDB）：

```vue
<script setup>
import { AiChat } from '@ai-chat/vue'

const models = [{
  id: 'proxy-model',
  name: '后端代理模型',
  provider: 'proxy',
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-4',
  createdAt: Date.now(),
  requestInterceptor: async (ctx) => {
    // 替换 URL 为自建代理地址
    ctx.url = ctx.url.replace('https://api.openai.com/v1', '/api/llm')
    // 动态获取最新 access_token
    const token = await getAccessToken()
    ctx.headers['Authorization'] = `Bearer ${token}`
    return ctx
  }
}]
</script>

<template>
  <AiChat :models="models" />
</template>
```

### 拦截器上下文

拦截器接收 `RequestContext` 对象，包含当前请求的完整信息：

```ts
interface RequestContext {
  url: string                      // 完整请求 URL
  method: string                   // 请求方法（通常为 POST）
  headers: Record<string, string>  // 已构建好的 headers
  body?: unknown                   // 请求 body
}
```

你可以修改 `RequestContext` 的任何字段后返回，组件会用修改后的上下文发起请求。

### 常见场景

#### 后端代理转发

将前端请求全部转发到自建后端，后端负责添加 API Key 后转发给 LLM：

```ts
requestInterceptor: (ctx) => {
  ctx.url = '/api/llm' + new URL(ctx.url).pathname
  delete ctx.headers['Authorization']
  return ctx
}
```

#### 动态 Token 刷新

后端代理使用 OAuth 鉴权，`access_token` 会过期，需要每次请求前动态获取：

```ts
import { refreshTokenIfNeeded } from './auth'

requestInterceptor: async (ctx) => {
  ctx.url = '/api/llm'
  const { accessToken } = await refreshTokenIfNeeded()
  ctx.headers['Authorization'] = `Bearer ${accessToken}`
  return ctx
}
```

#### 多租户场景

不同租户使用不同的后端端点，通过 header 传递租户信息：

```ts
requestInterceptor: (ctx) => {
  ctx.url = `/api/tenant/${currentTenantId}/llm`
  ctx.headers['X-Request-Id'] = crypto.randomUUID()
  return ctx
}
```

## 国际化

### 使用内置语言

支持三种内置语言：`'zh-cn'`（中文）、`'en'`（英文）、`'ja'`（日文）。

```vue
<AiChat locale="zh-cn" />
```

### 自定义 Locale

传入自定义 locale 对象覆盖或扩展翻译：

```ts
import { en } from '@ai-chat/vue'
import type { AiChatLocale } from '@ai-chat/vue'

const myLocale: AiChatLocale = {
  ...en,
  chat: {
    ...en.chat,
    send: 'Send Message',
    placeholder: 'Type something...',
  },
}
```

```vue
<AiChat :locale="myLocale" />
```

## 内置模型

组件内置了三个免费的 OpenAI 兼容模型（用户只需填入 API Key）：

| 模型 | Provider | Endpoint |
|------|----------|----------|
| 通义千问 Qwen Turbo | qwen | dashscope.aliyuncs.com |
| 智谱 GLM-4-Flash | zhipu | open.bigmodel.cn |
| DeepSeek Chat | deepseek | api.deepseek.com |

用户也可以通过模型管理界面自行添加任意 OpenAI 兼容的模型。

## 类型参考

### Tool（工具）

工具有两种形态：**简单工具**（接收纯字符串）和**结构化工具**（接收 Zod Schema 解析后的对象）。通过 TypeScript 联合类型 `ToolDefinition` 统一表示。

```ts
import type { ZodType, z } from 'zod'

/** 简单工具 — LLM 传入纯字符串，工具自行解析 */
interface SimpleToolDefinition {
  /** 工具名称，需全局唯一 */
  name: string
  /** 工具描述，LLM 据此判断是否调用该工具 */
  description: string
  /** 执行函数，接收 LLM 输出的字符串 */
  execute: (input: string) => Promise<string>
}

/** 结构化工具 — LLM 根据 Schema 生成结构化 JSON 参数 */
interface StructuredToolDefinition<T extends ZodType = ZodType> {
  /** 工具名称，需全局唯一 */
  name: string
  /** 工具描述 */
  description: string
  /** Zod Schema，定义工具的参数结构，LLM 会看到完整的字段描述 */
  schema: T
  /** 执行函数，接收 schema 解析后的类型安全对象 */
  execute: (input: z.infer<T>) => Promise<string>
}

/** 工具定义联合类型 */
type ToolDefinition = SimpleToolDefinition | StructuredToolDefinition
```

**使用示例：**

```ts
import { z } from 'zod'
import type { ToolDefinition } from '@ai-chat/vue'

// 简单工具
const calculator: ToolDefinition = {
  name: 'calculator',
  description: '计算数学表达式，例如 "2+3*4"',
  execute: async (input: string) => {
    const result = new Function(`"use strict"; return (${input})`)()
    return `结果: ${result}`
  },
}

// 结构化工具
const weatherSchema = z.object({
  city: z.string().describe('城市名称'),
  unit: z.enum(['celsius', 'fahrenheit']).optional().describe('温度单位'),
})

const weatherTool: ToolDefinition = {
  name: 'get_weather',
  description: '查询指定城市的天气信息',
  schema: weatherSchema,
  execute: async (input) => {
    // input 的类型自动推断为 { city: string; unit?: 'celsius' | 'fahrenheit' }
    return `${input.city} 当前温度 25°C`
  },
}
```

### MCP Server（MCP 服务器）

MCP（Model Context Protocol）用于接入外部工具服务。支持三种传输方式：`stdio`（本地进程）、`http`（HTTP 请求）、`sse`（Server-Sent Events）。

```ts
/** MCP 传输类型 */
type MCPTransportType = 'stdio' | 'http' | 'sse'

/** MCP 服务器配置 */
interface MCPServerConfig {
  /** 服务器名称，用于日志和调试 */
  name: string
  /** 传输方式 */
  transport: MCPTransportType

  // ── stdio 传输方式 ──
  /** 可执行文件命令，如 'npx'、'python'（仅 stdio） */
  command?: string
  /** 命令参数列表（仅 stdio） */
  args?: string[]
  /** 子进程环境变量（仅 stdio） */
  env?: Record<string, string>

  // ── http / sse 传输方式 ──
  /** 服务器 URL（仅 http / sse） */
  url?: string
  /** 自定义请求头，如 Authorization（仅 http / sse） */
  headers?: Record<string, string>
}
```

**使用示例：**

```ts
import type { MCPServerConfig } from '@ai-chat/vue'

// 本地 stdio 进程
const localServer: MCPServerConfig = {
  name: 'filesystem',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
  env: {
    NODE_ENV: 'production',
  },
}

// 远程 SSE 服务
const remoteServer: MCPServerConfig = {
  name: 'remote-tools',
  transport: 'sse',
  url: 'https://mcp.example.com/sse',
  headers: {
    Authorization: 'Bearer your-token',
  },
}
```

### Agent（智能体）

```ts
/** 智能体定义 */
interface AgentDefinition {
  /** 智能体唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 描述，用于智能体选择下拉框 */
  description?: string
  /** 国际化 key — 存在时覆盖 name 用于显示 */
  nameKey?: string
  /** 国际化 key — 存在时覆盖 description 用于显示 */
  descriptionKey?: string
  /** 头像 URL */
  avatar?: string
  /** 系统提示词，注入到对话的 system message 中 */
  systemPrompt?: string
  /** 工具列表，LLM 可在对话中调用 */
  tools?: ToolDefinition[]
  /** MCP 服务器列表，连接后自动发现并注册远程工具 */
  mcpServers?: MCPServerConfig[]
  /** 技能列表（需安装 deepagents） */
  skills?: SkillDefinition[]
  /** 可调用的子 Agent ID 列表。未设置时使用所有已注册的 Agent（仅 DeepAgentRunner 有效） */
  allowedAgents?: string[]
  /** 是否在切换 Agent 列表中隐藏。隐藏后仍可正常使用，仅不显示在 UI 选择列表中 */
  hidden?: boolean
}
```

**注册函数签名：**

```ts
/** 注册智能体（配置模式，框架自动创建 Runner） */
function registerAgent(agentDef: AgentDefinition, runner?: AgentRunner): void

/** 注销智能体 */
agentRegistry.unregister(agentId: string): void

/** 获取智能体定义 */
agentRegistry.getDefinition(agentId: string): AgentDefinition | undefined

/** 获取所有已注册智能体 */
agentRegistry.getAllDefinitions(): AgentDefinition[]
```

> 不传 `runner` 时，框架根据 `agentDef.skills` 自动选择 `DeepAgentRunner`（有技能时）或 `LangChainRunner`（无技能时）。

### TokenUsage（Token 用量）

```ts
/** Token 用量信息 */
interface TokenUsage {
  /** 输入 token 数 */
  promptTokens: number
  /** 输出 token 数 */
  completionTokens: number
  /** 总 token 数 */
  totalTokens: number
  /** 推理（思考过程）token 数 */
  reasoningTokens?: number
}
```

### ChatMessage（聊天消息）

```ts
/** 聊天消息 */
interface ChatMessage {
  /** 消息唯一标识 */
  id: string
  /** 所属会话 ID */
  conversationId: string
  /** 消息角色 */
  role: MessageRole // 'user' | 'assistant' | 'system'
  /** 消息内容 */
  content: string
  /** 消息时间戳 (Date.now()) */
  timestamp: number
  /** 是否正在流式输出 */
  isStreaming?: boolean
  /** 附加元数据 */
  metadata?: Record<string, unknown>
  /** 推理内容（推理模型的思考过程） */
  reasoningContent?: string
  /** Token 用量 */
  tokenUsage?: TokenUsage
  /** 有序步骤列表（思考过程、子 Agent 调用等按 LLM 调用顺序排列） */
  steps?: MessageStep[]
}
```

### Conversation（会话）

```ts
/** 会话 */
interface Conversation {
  /** 会话唯一标识 */
  id: string
  /** 会话标题 */
  title: string
  /** 关联的智能体 ID */
  agentId: string
  /** 使用的模型 ID */
  modelId: string
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
  /** 累计 Token 用量 */
  totalTokens?: number
  /** 消息数量（冗余计数，创建消息时递增） */
  messageCount?: number
}
```

### SkillDefinition（技能）

技能是传入 markdown 文档字符串的定义，LLM 通过 `use_skill` 工具按需加载完整指令。仅在 `DeepAgentRunner` 中生效。

```ts
/** 技能定义 */
interface SkillDefinition {
  /** 技能名称（唯一标识，用于 LLM 调用 use_skill 时指定） */
  name: string
  /** 技能描述（LLM 根据此描述判断是否需要使用该技能） */
  description: string
  /** 技能完整指令（markdown 格式），LLM 调用 use_skill 后获取 */
  instructions: string
}
```

### ChatChunk（流式响应块）

```ts
/** 聊天流式响应块 */
interface ChatChunk {
  /** 块类型 */
  type: 'token' | 'done' | 'error' | 'sub_agent_start' | 'sub_agent_log' | 'sub_agent_end' | 'iteration_start'
  /** 文本内容 (type 为 token 时) */
  content?: string
  /** 错误信息 (type 为 error 时) */
  error?: string
  /** 推理内容（推理模型的思考过程，type 为 token 时） */
  reasoningContent?: string
  /** Token 用量（type 为 done 时，或 iteration_start 时携带上一次迭代的用量） */
  tokenUsage?: TokenUsage
  /** 子 Agent 调用信息 (sub_agent_start/log/end 时) */
  subAgent?: SubAgentCallInfo
  /** 日志条目 (sub_agent_log 时) */
  logEntry?: SubAgentLogEntry
  /** 迭代序号（type 为 iteration_start 时使用） */
  iteration?: number
}
```

### SubAgent 相关类型

```ts
/** 子 Agent 调用信息（ChatMessage.metadata 中使用） */
interface SubAgentCallInfo {
  executionId: string
  agentId: string
  agentName: string
  task: string
  status: 'running' | 'completed' | 'failed'
  startTime: number
  endTime: number | null
  depth: number
}

/** 子 Agent 日志条目 */
interface SubAgentLogEntry {
  timestamp: number
  type: 'start' | 'token' | 'reasoning' | 'tool_call' | 'tool_result' | 'done' | 'error'
  content: string
}

/** 子 Agent 执行记录（数据库存储） */
interface SubAgentExecution {
  id: string
  parentExecutionId: string | null
  conversationId: string
  parentMessageId: string
  agentId: string
  agentName: string
  task: string
  status: 'running' | 'completed' | 'failed'
  startTime: number
  endTime: number | null
  output: string | null
  reasoningContent: string | null
  error: string | null
  depth: number
  logs: SubAgentLogEntry[]
  tokenUsage?: TokenUsage
}
```

### MessageStep（消息步骤）

消息步骤按 LLM 调用顺序排列，用于展示思考过程和子 Agent 调用链。

```ts
/** 思考过程步骤 */
interface ThinkingStep {
  type: 'thinking'
  content: string
  tokenUsage?: TokenUsage
}

/** 子 Agent 步骤 */
interface SubAgentStep {
  type: 'sub_agent'
  executionId: string
  agentId: string
  agentName: string
  task: string
  status: 'running' | 'completed' | 'failed'
  startTime: number
  endTime: number | null
  depth: number
  tokenUsage?: TokenUsage
}

/** 消息步骤联合类型 */
type MessageStep = ThinkingStep | SubAgentStep
```

### ChatEventType（聊天事件类型）

```ts
type ChatEventType =
  | 'message:sent'
  | 'message:streaming'
  | 'message:complete'
  | 'message:error'
  | 'conversation:created'
  | 'conversation:deleted'
  | 'model:changed'
  | 'agent:changed'
```

### Model（模型）

```ts
/** 请求上下文 — 拦截器拿到的请求信息 */
interface RequestContext {
  /** 请求 URL */
  url: string
  /** 请求方法 */
  method: string
  /** 已构建好的 headers（包含 Authorization 等） */
  headers: Record<string, string>
  /** 请求 body */
  body?: unknown
}

/** 请求拦截器 — 在每次 LLM API 请求前调用，可修改 URL、headers 等 */
type RequestInterceptor = (
  context: RequestContext,
) => Promise<RequestContext> | RequestContext

/** 模型配置 */
interface ModelConfig {
  /** 模型配置唯一标识 */
  id: string
  /** 模型显示名称 */
  name: string
  /** 模型提供商 */
  provider: string
  /** API 端点地址（OpenAI 兼容格式） */
  endpoint: string
  /** API 密钥 */
  apiKey: string
  /** 实际模型名称（传给 API 的 model 参数） */
  modelName: string
  /** 温度参数 */
  temperature?: number
  /** 最大 token 数 */
  maxTokens?: number
  /** 创建时间戳 */
  createdAt: number
  /** 请求拦截器（函数类型，不可序列化，需通过 :models prop 注入） */
  requestInterceptor?: RequestInterceptor
}
```

## 深度智能体（Deep Agent）

`DeepAgentRunner` 是内置的高级智能体运行器，当 `AgentDefinition` 包含 `skills` 时自动启用。它支持：

- **技能系统** — LLM 通过 `use_skill` 工具按需加载技能指令
- **子 Agent 调度** — LLM 通过 `delegate_task` 工具将任务委派给其他已注册的智能体
- **推理过程展示** — 支持分步思考（ThinkingStep）和子 Agent 调用追踪（SubAgentStep）
- **Token 用量统计** — 自动累计每步和总体的 Token 消耗

```ts
import { registerAgent } from '@ai-chat/vue'

registerAgent({
  id: 'deep-agent',
  name: 'Deep Agent',
  description: '支持技能加载和子 Agent 调度的高级智能体',
  systemPrompt: '你是一个高级助手。',
  skills: [
    {
      name: 'code-review',
      description: '代码审查技能',
      instructions: `# 代码审查指南\n\n1. 检查代码风格\n2. 发现潜在 Bug\n3. 提出优化建议`,
    },
  ],
  // 不设置 allowedAgents 则可调用所有已注册 Agent
  // allowedAgents: ['code-agent', 'test-agent'],
})
```

## 高级导出

除组件和 composables 外，库还导出以下高级 API：

```ts
import {
  // 深度智能体运行器（自定义 Agent 时使用）
  DeepAgentRunner,

  // 标题生成器
  TitleGenerator,

  // 确保至少存在一个默认智能体（AiChat 内部自动调用）
  ensureDefaultAgent,

  // 工具函数
  getAttachmentType,       // 根据 MIME 类型获取 AttachmentType
  isMessageAttachment,     // 判断是否为 MessageAttachment
  isLegacyFileMetadata,    // 判断是否为旧版文件元数据
} from '@ai-chat/vue'
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动 Demo 应用
pnpm dev

# 构建库
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm type-check
```

## License

MIT
