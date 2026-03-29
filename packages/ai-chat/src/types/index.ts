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
}

/** 智能体运行器接口 */
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
  upload(file: File): Promise<UploadedFile>
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
