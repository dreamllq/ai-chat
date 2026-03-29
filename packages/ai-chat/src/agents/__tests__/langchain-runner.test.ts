import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage, ModelConfig, ChatOptions, ToolDefinition } from '../../types'

// Module-level mock functions — accessible in both vi.mock and tests
const mockStream = vi.fn()
const mockInvoke = vi.fn()

vi.mock('../llm-init', () => ({
  createLLM: vi.fn().mockImplementation(() => ({
    stream: mockStream,
    invoke: mockInvoke,
  })),
}))

vi.mock('../message-converter', () => ({
  convertMessages: vi.fn().mockReturnValue([]),
}))

vi.mock('@langchain/core/tools', () => ({
  DynamicTool: vi.fn().mockImplementation(({ name, description, func }: { name: string; description: string; func: (input: string) => Promise<string> }) => ({
    name,
    description,
    func,
  })),
}))

vi.mock('@langchain/core/messages', () => ({
  ToolMessage: vi.fn().mockImplementation(({ content, tool_call_id }: { content: string; tool_call_id: string }) => ({
    _getType: () => 'tool',
    content,
    tool_call_id,
  })),
}))

import { LangChainRunner } from '../langchain-runner'
import { createLLM } from '../llm-init'
import { convertMessages } from '../message-converter'

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

describe('LangChainRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should stream tokens and yield done when no tools configured', async () => {
    mockStreamYield([{ content: 'Hello' }, { content: ' world' }])

    const runner = new LangChainRunner({})
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'token', content: 'Hello' },
      { type: 'token', content: ' world' },
      { type: 'done' },
    ])
  })

  it('should pass options systemPrompt to convertMessages (overrides constructor)', async () => {
    mockStreamYield([{ content: 'ok' }])

    const runner = new LangChainRunner({ systemPrompt: 'Constructor prompt' })
    const options: ChatOptions = { systemPrompt: 'Options override' }

    for await (const _ of runner.chat([makeMessage()], makeModel(), options)) {
      void _
    }

    expect(convertMessages).toHaveBeenCalledWith(
      expect.any(Array),
      'Options override',
    )
  })

  it('should fall back to constructor systemPrompt when options does not provide one', async () => {
    mockStreamYield([{ content: 'ok' }])

    const runner = new LangChainRunner({ systemPrompt: 'Constructor prompt' })

    for await (const _ of runner.chat([makeMessage()], makeModel())) {
      void _
    }

    expect(convertMessages).toHaveBeenCalledWith(
      expect.any(Array),
      'Constructor prompt',
    )
  })

  it('should execute a single tool call and yield final response', async () => {
    const mockTool: ToolDefinition = {
      name: 'calculator',
      description: 'Performs calculations',
      execute: vi.fn().mockResolvedValue('42'),
    }

    mockInvoke
      .mockResolvedValueOnce({
        tool_calls: [{ name: 'calculator', args: { input: '6*7' }, id: 'tc-1' }],
        content: '',
      })
      .mockResolvedValueOnce({
        tool_calls: [],
        content: 'The answer is 42',
      })

    const runner = new LangChainRunner({ tools: [mockTool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(mockTool.execute).toHaveBeenCalledWith('6*7')
    expect(chunks).toEqual([
      { type: 'token', content: 'The answer is 42' },
      { type: 'done' },
    ])
  })

  it('should execute multiple tool calls from a single LLM response', async () => {
    const tool1: ToolDefinition = {
      name: 'tool1',
      description: 'First tool',
      execute: vi.fn().mockResolvedValue('result1'),
    }
    const tool2: ToolDefinition = {
      name: 'tool2',
      description: 'Second tool',
      execute: vi.fn().mockResolvedValue('result2'),
    }

    mockInvoke
      .mockResolvedValueOnce({
        tool_calls: [
          { name: 'tool1', args: { input: 'a' }, id: 'tc-1' },
          { name: 'tool2', args: { input: 'b' }, id: 'tc-2' },
        ],
        content: '',
      })
      .mockResolvedValueOnce({
        tool_calls: [],
        content: 'Combined results',
      })

    const runner = new LangChainRunner({ tools: [tool1, tool2] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(tool1.execute).toHaveBeenCalledWith('a')
    expect(tool2.execute).toHaveBeenCalledWith('b')
    expect(chunks).toEqual([
      { type: 'token', content: 'Combined results' },
      { type: 'done' },
    ])
  })

  it('should handle tool execution errors gracefully and continue', async () => {
    const failingTool: ToolDefinition = {
      name: 'failing',
      description: 'Fails on execution',
      execute: vi.fn().mockRejectedValue(new Error('Tool crashed')),
    }

    mockInvoke
      .mockResolvedValueOnce({
        tool_calls: [{ name: 'failing', args: { input: 'test' }, id: 'tc-1' }],
        content: '',
      })
      .mockResolvedValueOnce({
        tool_calls: [],
        content: 'Handled error',
      })

    const runner = new LangChainRunner({ tools: [failingTool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // Tool error is caught; loop continues and yields final response
    expect(chunks).toEqual([
      { type: 'token', content: 'Handled error' },
      { type: 'done' },
    ])
  })

  it('should stop after 5 tool calling iterations with warning', async () => {
    const tool: ToolDefinition = {
      name: 'looper',
      description: 'Always triggers a tool call',
      execute: vi.fn().mockResolvedValue('loop result'),
    }

    // Every invoke returns a tool call — loop never exits naturally
    mockInvoke.mockResolvedValue({
      tool_calls: [{ name: 'looper', args: { input: 'loop' }, id: 'tc-loop' }],
      content: '',
    })

    const runner = new LangChainRunner({ tools: [tool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(mockInvoke).toHaveBeenCalledTimes(5)
    expect(chunks).toEqual([
      { type: 'token', content: '\n\n⚠️ Reached maximum tool calling iterations.' },
      { type: 'done' },
    ])
  })

  it('should yield nothing when abort signal is already set', async () => {
    const controller = new AbortController()
    controller.abort()

    mockStreamYield([{ content: 'ok' }])

    const runner = new LangChainRunner({})
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel(), {
      signal: controller.signal,
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([])
  })

  it('should yield error chunk when LLM throws', async () => {
    mockStream.mockRejectedValue(new Error('API connection failed'))

    const runner = new LangChainRunner({})
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({ type: 'error' })
    expect((chunks[0] as { error: string }).error).toContain('API connection failed')
  })

  it('should handle unknown tool name gracefully and continue loop', async () => {
    const knownTool: ToolDefinition = {
      name: 'known_tool',
      description: 'A known tool',
      execute: vi.fn().mockResolvedValue('known result'),
    }

    mockInvoke
      .mockResolvedValueOnce({
        tool_calls: [{ name: 'unknown_tool', args: { input: 'test' }, id: 'tc-1' }],
        content: '',
      })
      .mockResolvedValueOnce({
        tool_calls: [],
        content: 'Final response after unknown tool',
      })

    const runner = new LangChainRunner({ tools: [knownTool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // The known tool should NOT be called since LLM requested an unknown tool
    expect(knownTool.execute).not.toHaveBeenCalled()
    // The loop should still continue and produce a final response
    expect(chunks).toEqual([
      { type: 'token', content: 'Final response after unknown tool' },
      { type: 'done' },
    ])
  })

  it('should call createLLM with converted tools when tools are configured', async () => {
    const tool: ToolDefinition = {
      name: 'search',
      description: 'Search the web',
      execute: vi.fn().mockResolvedValue('results'),
    }

    mockInvoke
      .mockResolvedValueOnce({
        tool_calls: [{ name: 'search', args: { input: 'test' }, id: 'tc-1' }],
        content: '',
      })
      .mockResolvedValueOnce({
        tool_calls: [],
        content: 'Done',
      })

    const runner = new LangChainRunner({ tools: [tool] })
    for await (const _ of runner.chat([makeMessage()], makeModel())) {
      void _
    }

    // createLLM should be called with model, options, AND tools array
    expect(createLLM).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ name: 'search', description: 'Search the web' }),
      ]),
    )
  })
})
