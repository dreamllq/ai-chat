import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage, ModelConfig, ChatOptions } from '../../types'

// Module-level mock stream function — accessible in both vi.mock and tests
const mockStream = vi.fn()

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    stream: mockStream,
  })),
}))

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { LangChainChatAgent } from '../langchain-chat-agent'

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

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  }
}

/** Helper that sets up mockStream to yield the given chunks */
function mockStreamYield(chunks: { content: string }[]) {
  mockStream.mockImplementation(async () => {
    return (async function* () {
      for (const c of chunks) {
        yield c
      }
    })()
  })
}

describe('LangChainChatAgent', () => {
  let agent: LangChainChatAgent

  beforeEach(() => {
    vi.clearAllMocks()
    agent = new LangChainChatAgent()
  })

  it('should implement AgentRunner interface', () => {
    expect(typeof agent.chat).toBe('function')
  })

  it('should pass correct messages to ChatOpenAI including system prompt', async () => {
    const capturedMessages: unknown[] = []

    mockStream.mockImplementation(async (messages: unknown[]) => {
      capturedMessages.push(...(messages as unknown[]))
      return (async function* () {
        yield { content: 'response' }
      })()
    })

    const messages = [
      makeMessage({ role: 'user', content: 'Hello' }),
      makeMessage({ role: 'assistant', content: 'Hi there' }),
    ]
    const options: ChatOptions = { systemPrompt: 'You are helpful.' }

    const chunks: unknown[] = []
    for await (const chunk of agent.chat(messages, makeModel(), options)) {
      chunks.push(chunk)
    }

    expect(capturedMessages).toHaveLength(3)
    expect(capturedMessages[0]).toBeInstanceOf(SystemMessage)
    expect(capturedMessages[1]).toBeInstanceOf(HumanMessage)
    expect(capturedMessages[2]).toBeInstanceOf(AIMessage)
  })

  it('should yield token and done chunks on successful stream', async () => {
    mockStreamYield([{ content: 'Hello' }, { content: ' world' }])

    const chunks: unknown[] = []
    for await (const chunk of agent.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'token', content: 'Hello' },
      { type: 'token', content: ' world' },
      { type: 'done' },
    ])
  })

  it('should yield error chunk when stream throws', async () => {
    mockStream.mockRejectedValue(new Error('API error'))

    const chunks: unknown[] = []
    for await (const chunk of agent.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({ type: 'error' })
    expect((chunks[0] as { error: string }).error).toContain('API error')
  })

  it('should use ChatOptions.temperature and maxTokens over model defaults', async () => {
    mockStreamYield([{ content: 'ok' }])

    const options: ChatOptions = { temperature: 0.3, maxTokens: 50 }
    for await (const _ of agent.chat([makeMessage()], makeModel(), options)) {
      void _
    }

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.3,
        maxTokens: 50,
      }),
    )
  })

  it('should construct ChatOpenAI with model endpoint and apiKey from configuration', async () => {
    mockStreamYield([{ content: 'ok' }])

    const model = makeModel({ endpoint: 'https://custom.api/v1', apiKey: 'secret' })
    for await (const _ of agent.chat([makeMessage()], model)) {
      void _
    }

    expect(ChatOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: { baseURL: 'https://custom.api/v1', apiKey: 'secret' },
      }),
    )
  })

  it('should skip system message when systemPrompt is not provided', async () => {
    const capturedMessages: unknown[] = []

    mockStream.mockImplementation(async (messages: unknown[]) => {
      capturedMessages.push(...(messages as unknown[]))
      return (async function* () {
        yield { content: 'ok' }
      })()
    })

    const messages = [makeMessage({ role: 'user', content: 'Hi' })]
    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    expect(capturedMessages).toHaveLength(1)
    expect(capturedMessages[0]).toBeInstanceOf(HumanMessage)
  })
})
