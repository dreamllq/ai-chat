/** 聊天消息角色类型 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** Token 用量信息 */
export interface TokenUsage {
  /** 输入 token 数 */
  promptTokens: number
  /** 输出 token 数 */
  completionTokens: number
  /** 总 token 数 */
  totalTokens: number
  /** 推理（思考过程）token 数 */
  reasoningTokens?: number
}

/** 聊天消息 */
export interface ChatMessage {
  /** 消息唯一标识 */
  id: string
  /** 所属会话 ID */
  conversationId: string
  /** 消息角色 */
  role: MessageRole
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

// === 会话 ===

/** 会话 */
export interface Conversation {
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

// === 模型配置 ===

/** 请求上下文 — 拦截器拿到的请求信息 */
export interface RequestContext {
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
export type RequestInterceptor = (
  context: RequestContext,
) => Promise<RequestContext> | RequestContext

/** 模型配置 */
export interface ModelConfig {
  /** 模型配置唯一标识 */
  id: string
  /** 模型显示名称 */
  name: string
  /** 模型提供商 */
  provider: string
  /** API 端点地址 */
  endpoint: string
  /** API 密钥 */
  apiKey: string
  /** 实际模型名称 */
  modelName: string
  /** 温度参数 */
  temperature?: number
  /** 最大 token 数 */
  maxTokens?: number
  /** 创建时间戳 */
  createdAt: number
  /**
   * 请求拦截器 — 在每次 LLM API 请求前调用。
   * 可用于：替换 URL 为代理地址（解决跨域）、动态注入/替换 headers（解决 token 过期）等。
   * 注意：函数类型不可序列化，带拦截器的模型需通过 AiChat 的 :models prop 注入，不能存入 IndexedDB。
   */
  requestInterceptor?: RequestInterceptor
}

// === 工具 ===

import type { ZodType, z } from 'zod'

/** 没有 schema 的简单工具（纯字符串输入） */
export interface SimpleToolDefinition {
  /** 工具名称 */
  name: string
  /** 工具描述 */
  description: string
  /** 工具执行函数，接收字符串输入 */
  execute: (input: string) => Promise<string>
}

/** 有 Zod Schema 的结构化工具 */
export interface StructuredToolDefinition<T extends ZodType = ZodType> {
  /** 工具名称 */
  name: string
  /** 工具描述 */
  description: string
  /** Zod Schema，定义工具参数结构 */
  schema: T
  /** 工具执行函数，接收 schema 解析后的结构化参数 */
  execute: (input: z.infer<T>) => Promise<string>
}

/** 工具定义 — 有 schema 时 LLM 看到参数结构，无 schema 时接收纯字符串 */
export type ToolDefinition = SimpleToolDefinition | StructuredToolDefinition

// === MCP 服务器 ===

/** MCP 服务器传输类型 */
export type MCPTransportType = 'stdio' | 'http' | 'sse'

/** MCP 服务器配置 */
export interface MCPServerConfig {
  /** 服务器名称 */
  name: string
  /** 传输类型 */
  transport: MCPTransportType
  /** 可执行文件命令 (stdio transport) */
  command?: string
  /** 命令参数 (stdio transport) */
  args?: string[]
  /** 服务器 URL (http/sse transport) */
  url?: string
  /** 请求头 (http/sse transport) */
  headers?: Record<string, string>
  /** 环境变量 (stdio transport) */
  env?: Record<string, string>
}

// === Skill ===

/** 技能定义 — 传入 markdown 文档字符串，LLM 按需加载完整指令 */
export interface SkillDefinition {
  /** 技能名称（唯一标识，用于 LLM 调用 use_skill 时指定） */
  name: string
  /** 技能描述（LLM 根据此描述判断是否需要使用该技能） */
  description: string
  /** 技能完整指令（markdown 格式），LLM 调用 use_skill 后获取 */
  instructions: string
}

// === Agent ===

/** 智能体定义 */
export interface AgentDefinition {
  /** 智能体唯一标识 */
  id: string
  /** 智能体名称 */
  name: string
  /** 智能体描述 */
  description?: string
  /** 国际化 key — 存在时覆盖 name 用于显示 */
  nameKey?: string
  /** 国际化 key — 存在时覆盖 description 用于显示 */
  descriptionKey?: string
  /** 头像 URL */
  avatar?: string
  /** 系统提示词 */
  systemPrompt?: string
  /** 工具列表 */
  tools?: ToolDefinition[]
  /** MCP 服务器列表 */
  mcpServers?: MCPServerConfig[]
  /** 技能列表 — 传入 markdown 文档字符串，LLM 通过 use_skill 工具按需加载（仅 DeepAgentRunner 有效） */
  skills?: SkillDefinition[]
  /** 可调用的子 Agent ID 列表。未设置时使用所有已注册的 Agent（仅 DeepAgentRunner 有效） */
  allowedAgents?: string[]
  /** 是否在切换 Agent 列表中隐藏。隐藏后仍可正常使用，仅不显示在 UI 选择列表中 */
  hidden?: boolean
}

/** @internal 智能体运行器接口 — 内部使用，用户不再需要实现此接口 */
export interface AgentRunner {
  /** 执行聊天，返回流式响应 */
  chat(
    messages: ChatMessage[],
    model: ModelConfig,
    options?: ChatOptions
  ): AsyncGenerator<ChatChunk, void, unknown>
}

/** 聊天选项 */
export interface ChatOptions {
  /** 系统提示词 */
  systemPrompt?: string
  /** 温度参数 */
  temperature?: number
  /** 最大 token 数 */
  maxTokens?: number
  /** 中止信号 */
  signal?: AbortSignal
  /** token 回调 */
  onToken?: (token: string) => void
}

// === 子 Agent ===

/** 子 Agent 日志条目 */
export interface SubAgentLogEntry {
  /** 时间戳 */
  timestamp: number
  /** 日志类型 */
  type: 'start' | 'token' | 'reasoning' | 'tool_call' | 'tool_result' | 'done' | 'error'
  /** 日志内容 */
  content: string
}

/** 子 Agent 执行记录（数据库存储） */
export interface SubAgentExecution {
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

/** 子 Agent 调用信息（ChatMessage.metadata 中使用） */
export interface SubAgentCallInfo {
  /** 执行记录 ID */
  executionId: string
  /** 子 Agent ID */
  agentId: string
  /** 子 Agent 名称 */
  agentName: string
  /** 任务描述 */
  task: string
  /** 执行状态 */
  status: 'running' | 'completed' | 'failed'
  /** 开始时间 */
  startTime: number
  /** 结束时间 */
  endTime: number | null
  /** 嵌套深度 */
  depth: number
}

/** 思考过程步骤（一次 LLM 调用的推理内容） */
export interface ThinkingStep {
  type: 'thinking'
  content: string
  tokenUsage?: TokenUsage
}

/** 子 Agent 步骤（一次子 Agent 调用） */
export interface SubAgentStep {
  type: 'sub_agent'
  executionId: string
  agentId: string
  agentName: string
  task: string
  status: 'running' | 'completed' | 'failed'
  startTime: number
  endTime: number | null
  depth: number
  /** 子 Agent 调用消耗的 Token 用量 */
  tokenUsage?: TokenUsage
}

/** 消息步骤 — 按 LLM 调用顺序排列 */
export type MessageStep = ThinkingStep | SubAgentStep

/** 聊天流式响应块 */
export interface ChatChunk {
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

// === 文件上传 ===

/** 文件上传服务接口 */
export interface FileUploadService {
  /** 上传文件 */
  upload(file: File, options?: FileUploadOptions): Promise<UploadedFile>
  /** 获取文件访问 URL */
  getFileUrl(fileId: string): Promise<string>
}

/** 已上传文件信息 */
export interface UploadedFile {
  /** 文件唯一标识 */
  id: string
  /** 文件名 */
  name: string
  /** 文件访问 URL */
  url: string
  /** 文件大小 (字节) */
  size: number
  /** MIME 类型 */
  mimeType: string
}

/** 文件上传进度事件 */
export interface FileUploadProgressEvent {
  /** 已上传字节 */
  loaded: number
  /** 总字节 */
  total: number
  /** 进度百分比 (0-100) */
  percent: number
}

/** 文件上传选项（传给 FileUploadService.upload 的第二参数） */
export interface FileUploadOptions {
  /** 上传进度回调 */
  onProgress?: (event: FileUploadProgressEvent) => void
  /** 取消信号 */
  signal?: AbortSignal
}

/** UI 层文件上传状态（不持久化，仅组件内部使用） */
export interface FileUploadState {
  /** 状态唯一标识 */
  id: string
  /** 原始文件对象 */
  file: File
  /** 上传状态 */
  status: 'pending' | 'uploading' | 'success' | 'failed'
  /** 上传进度 (0-100) */
  progress: number
  /** 上传成功后的文件信息 */
  result?: UploadedFile
  /** 上传失败的错误信息 */
  error?: Error
  /** 用于取消上传的 AbortController */
  abortController?: AbortController
}

// === 消息附件 ===

/** 附件类型 */
export type AttachmentType = 'image' | 'document' | 'audio' | 'video'

/** 消息附件 */
export interface MessageAttachment {
  /** 附件唯一标识 */
  id: string
  /** 文件名 */
  name: string
  /** 文件访问 URL */
  url?: string
  /** Base64 数据 */
  data?: string
  /** 文件大小 (字节) */
  size: number
  /** MIME 类型 */
  mimeType: string
  /** 附件类型 */
  type: AttachmentType
}

/** 根据 MIME 类型推断附件类型 */
export function getAttachmentType(mimeType: string): AttachmentType {
  if (!mimeType) return 'document'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  return 'document'
}

/** 判断对象是否为 MessageAttachment 类型 */
export function isMessageAttachment(obj: unknown): obj is MessageAttachment {
  if (typeof obj !== 'object' || obj === null) return false
  const record = obj as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.size === 'number' &&
    typeof record.mimeType === 'string' &&
    typeof record.type === 'string' &&
    (typeof record.url === 'string' || typeof record.data === 'string')
  )
}

/** 判断对象是否为旧版文件元数据格式 */
export function isLegacyFileMetadata(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false
  const keys = Object.keys(obj)
  return (
    keys.length === 3 &&
    typeof (obj as Record<string, unknown>).name === 'string' &&
    typeof (obj as Record<string, unknown>).size === 'number' &&
    typeof (obj as Record<string, unknown>).type === 'string'
  )
}

// === 事件 ===

/** 聊天事件类型 */
export type ChatEventType =
  | 'message:sent'
  | 'message:streaming'
  | 'message:complete'
  | 'message:error'
  | 'conversation:created'
  | 'conversation:deleted'
  | 'model:changed'
  | 'agent:changed'
