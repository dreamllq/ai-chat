// === 消息 ===

/** 聊天消息角色类型 */
export type MessageRole = 'user' | 'assistant' | 'system'

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
}

// === 模型配置 ===

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
  /** 是否为内置模型 */
  isBuiltin?: boolean
  /** 创建时间戳 */
  createdAt: number
}

// === 工具 ===

/** 框架无关的工具定义 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string
  /** 工具描述 */
  description: string
  /** 工具参数 JSON Schema */
  parameters?: Record<string, unknown>
  /** 工具执行函数 */
  execute: (input: string) => Promise<string>
}

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

// === Agent ===

/** 智能体定义 */
export interface AgentDefinition {
  /** 智能体唯一标识 */
  id: string
  /** 智能体名称 */
  name: string
  /** 智能体描述 */
  description?: string
  /** 头像 URL */
  avatar?: string
  /** 系统提示词 */
  systemPrompt?: string
  /** 是否为内置智能体 */
  isBuiltin?: boolean
  /** 工具列表 */
  tools?: ToolDefinition[]
  /** MCP 服务器列表 */
  mcpServers?: MCPServerConfig[]
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

/** 聊天流式响应块 */
export interface ChatChunk {
  /** 块类型 */
  type: 'token' | 'done' | 'error'
  /** 文本内容 (type 为 token 时) */
  content?: string
  /** 错误信息 (type 为 error 时) */
  error?: string
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
