import type { ModelConfig } from '../types'

/** 内置模型模板（不含 id / createdAt，运行时填充） */
export interface BuiltinModelTemplate {
  /** 用作内置模型唯一标识（也作为 DB 主键前缀） */
  id: string
  name: string
  provider: string
  endpoint: string
  modelName: string
  temperature?: number
  maxTokens?: number
}

/**
 * 内置免费模型列表
 *
 * 全部使用 OpenAI 兼容接口，用户只需填入自己的 API Key 即可使用。
 */
export const BUILTIN_MODELS: BuiltinModelTemplate[] = [
  {
    id: 'builtin-qwen-turbo',
    name: '通义千问 Qwen Turbo',
    provider: 'qwen',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen-turbo',
    temperature: 0.7,
    maxTokens: 8192,
  },
  {
    id: 'builtin-zhipu-glm4-flash',
    name: '智谱 GLM-4-Flash',
    provider: 'zhipu',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    modelName: 'glm-4-flash',
    temperature: 0.7,
    maxTokens: 8192,
  },
  {
    id: 'builtin-deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    endpoint: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 8192,
  },
]
