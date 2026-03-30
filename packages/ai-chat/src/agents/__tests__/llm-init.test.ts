import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ModelConfig, ChatOptions } from '../../types'

// Module-level mock — accessible in both vi.mock and tests
const mockBindTools = vi.fn().mockReturnThis()

vi.mock('../chat-model', () => ({
  EnhancedChatModel: vi.fn().mockImplementation(() => ({
    bindTools: mockBindTools,
  })),
}))
import { EnhancedChatModel as MockedEnhancedChatModel } from '../chat-model'
import { createLLM } from '../llm-init'

function makeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'model-1',
    name: 'Test Model',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    modelName: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('createLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create EnhancedChatModel with correct config', () => {
    const model = makeModel({
      endpoint: 'https://custom.api/v1',
      apiKey: 'secret-key',
      modelName: 'gpt-4-turbo',
      temperature: 0.5,
      maxTokens: 2048,
    })

    createLLM(model)

    expect(MockedEnhancedChatModel).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: { baseURL: 'https://custom.api/v1', apiKey: 'secret-key' },
        modelName: 'gpt-4-turbo',
        temperature: 0.5,
        maxTokens: 2048,
        streaming: true,
      }),
    )
  })

  it('should override model defaults with ChatOptions', () => {
    const model = makeModel({ temperature: 0.7, maxTokens: 1000 })
    const options: ChatOptions = { temperature: 0.3, maxTokens: 50 }

    createLLM(model, options)

    expect(MockedEnhancedChatModel).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.3,
        maxTokens: 50,
      }),
    )
  })

  it('should fall back to 0.7 temperature when neither options nor model specifies', () => {
    const model = makeModel({ temperature: undefined })

    createLLM(model)

    expect(MockedEnhancedChatModel).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.7,
      }),
    )
  })

  it('should call bindTools when tools array is provided', () => {
    const model = makeModel()
    const mockTool1 = { name: 'tool1' }
    const mockTool2 = { name: 'tool2' }

    createLLM(model, undefined, [mockTool1, mockTool2] as unknown as import('@langchain/core/tools').StructuredToolInterface[])

    expect(mockBindTools).toHaveBeenCalledWith([mockTool1, mockTool2])
  })

  it('should NOT call bindTools when tools is undefined', () => {
    const model = makeModel()

    createLLM(model, undefined, undefined)

    expect(mockBindTools).not.toHaveBeenCalled()
  })

  it('should NOT call bindTools when tools is empty array', () => {
    const model = makeModel()

    createLLM(model, undefined, [])

    expect(mockBindTools).not.toHaveBeenCalled()
  })

  it('should use model temperature when options does not specify it', () => {
    const model = makeModel({ temperature: 0.9 })
    const options: ChatOptions = { maxTokens: 200 }

    createLLM(model, options)

    expect(MockedEnhancedChatModel).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.9,
        maxTokens: 200,
      }),
    )
  })
})
