import { EnhancedChatModel } from './chat-model'
import type { StructuredToolInterface } from '@langchain/core/tools'
import type { ModelConfig, ChatOptions } from '../types'

/**
 * Create a EnhancedChatModel instance from a ModelConfig, with optional overrides and tool binding.
 *
 * Temperature priority: options?.temperature ?? model.temperature ?? 0.7
 * MaxTokens priority:   options?.maxTokens ?? model.maxTokens
 */
export function createLLM(
  model: ModelConfig,
  options?: ChatOptions,
  tools?: StructuredToolInterface[],
): EnhancedChatModel {
  const llm = new EnhancedChatModel({
    configuration: { baseURL: model.endpoint, apiKey: model.apiKey },
    modelName: model.modelName,
    temperature: options?.temperature ?? model.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? model.maxTokens,
    streaming: true,
    streamUsage: true,
  })

  if (tools && tools.length > 0) {
    return llm.bindTools(tools) as unknown as EnhancedChatModel
  }

  return llm
}
