import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import type { ChatMessage, ModelConfig, ChatOptions, ToolDefinition, StructuredToolDefinition } from '../../types'

// Module-level mock functions — accessible in both vi.mock and tests
const mockStream = vi.fn()

vi.mock('../llm-init', () => ({
  createLLM: vi.fn().mockImplementation(() => ({
    stream: mockStream,
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
    _getType: () => 'tool',
  })),
  DynamicStructuredTool: vi.fn().mockImplementation(({ name, description, schema, func }: { name: string; description: string; schema: unknown; func: (input: unknown) => Promise<string> }) => ({
    name,
    description,
    schema,
    func,
    _getType: () => 'structured_tool',
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
function mockStreamYield(chunks: { content: string; additional_kwargs?: Record<string, unknown>; usage_metadata?: Record<string, unknown> }[]) {
  mockStream.mockImplementation(async () => {
    return (async function* () {
      for (const c of chunks) {
        yield { ...c, concat: (other: unknown) => ({ ...c, ...(other as Record<string, unknown>) }) }
      }
    })()
  })
}

/** Mock streaming chunk with concat() and tool_calls support for tool-calling tests */
interface MockStreamChunk {
  content: string
  tool_calls: Array<{ name: string; args: Record<string, unknown>; id: string }>
  additional_kwargs: Record<string, unknown>
  usage_metadata?: Record<string, unknown>
  concat: (other: MockStreamChunk) => MockStreamChunk
}

function createStreamChunk(data: {
  content?: string
  tool_calls?: MockStreamChunk['tool_calls']
  additional_kwargs?: Record<string, unknown>
  usage_metadata?: Record<string, unknown>
}): MockStreamChunk {
  const content = data.content ?? ''
  const tool_calls = data.tool_calls ?? []
  const additional_kwargs = data.additional_kwargs ?? {}
  const usage_metadata = data.usage_metadata

  return {
    content,
    tool_calls,
    additional_kwargs,
    usage_metadata,
    concat(other: MockStreamChunk): MockStreamChunk {
      return createStreamChunk({
        content: content + other.content,
        tool_calls: other.tool_calls.length > 0 ? other.tool_calls : tool_calls,
        additional_kwargs: { ...additional_kwargs, ...other.additional_kwargs },
        usage_metadata: other.usage_metadata ?? usage_metadata,
      })
    },
  }
}

/** Helper that sets up mockStream to yield tool-calling stream responses in sequence */
function mockStreamToolResponses(responses: Parameters<typeof createStreamChunk>[0][]) {
  for (const resp of responses) {
    mockStream.mockImplementationOnce(async () => {
      const chunk = createStreamChunk(resp)
      return (async function* () { yield chunk })()
    })
  }
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
      { type: 'iteration_start', iteration: 0 },
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

    mockStreamToolResponses([
      { tool_calls: [{ name: 'calculator', args: { input: '6*7' }, id: 'tc-1' }] },
      { content: 'The answer is 42' },
    ])

    const runner = new LangChainRunner({ tools: [mockTool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(mockTool.execute).toHaveBeenCalledWith('6*7')
    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'iteration_start', iteration: 1 },
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

    mockStreamToolResponses([
      { tool_calls: [{ name: 'tool1', args: { input: 'a' }, id: 'tc-1' }, { name: 'tool2', args: { input: 'b' }, id: 'tc-2' }] },
      { content: 'Combined results' },
    ])

    const runner = new LangChainRunner({ tools: [tool1, tool2] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(tool1.execute).toHaveBeenCalledWith('a')
    expect(tool2.execute).toHaveBeenCalledWith('b')
    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'iteration_start', iteration: 1 },
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

    mockStreamToolResponses([
      { tool_calls: [{ name: 'failing', args: { input: 'test' }, id: 'tc-1' }] },
      { content: 'Handled error' },
    ])

    const runner = new LangChainRunner({ tools: [failingTool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // Tool error is caught; loop continues and yields final response
    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'iteration_start', iteration: 1 },
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

    // Every stream returns a tool call — loop never exits naturally
    mockStream.mockImplementation(async () => {
      const chunk = createStreamChunk({ tool_calls: [{ name: 'looper', args: { input: 'loop' }, id: 'tc-loop' }] })
      return (async function* () { yield chunk })()
    })

    const runner = new LangChainRunner({ tools: [tool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(mockStream).toHaveBeenCalledTimes(5)
    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'iteration_start', iteration: 1 },
      { type: 'iteration_start', iteration: 2 },
      { type: 'iteration_start', iteration: 3 },
      { type: 'iteration_start', iteration: 4 },
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

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toMatchObject({ type: 'iteration_start' })
    expect(chunks[1]).toMatchObject({ type: 'error' })
    expect((chunks[1] as { error: string }).error).toContain('API connection failed')
  })

  it('should handle unknown tool name gracefully and continue loop', async () => {
    const knownTool: ToolDefinition = {
      name: 'known_tool',
      description: 'A known tool',
      execute: vi.fn().mockResolvedValue('known result'),
    }

    mockStreamToolResponses([
      { tool_calls: [{ name: 'unknown_tool', args: { input: 'test' }, id: 'tc-1' }] },
      { content: 'Final response after unknown tool' },
    ])

    const runner = new LangChainRunner({ tools: [knownTool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // The known tool should NOT be called since LLM requested an unknown tool
    expect(knownTool.execute).not.toHaveBeenCalled()
    // The loop should still continue and produce a final response
    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'iteration_start', iteration: 1 },
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

    mockStreamToolResponses([
      { tool_calls: [{ name: 'search', args: { input: 'test' }, id: 'tc-1' }] },
      { content: 'Done' },
    ])

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

  // --- Reasoning content tests ---

  it('should yield reasoningContent from streaming chunks', async () => {
    mockStreamYield([
      { content: '', additional_kwargs: { reasoning_content: 'Let me think...' } },
      { content: 'The answer', additional_kwargs: {} },
    ])

    const runner = new LangChainRunner({})
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'token', content: '', reasoningContent: 'Let me think...' },
      { type: 'token', content: 'The answer' },
      { type: 'done' },
    ])
  })

  it('should accumulate reasoningContent across multiple streaming chunks', async () => {
    mockStreamYield([
      { content: '', additional_kwargs: { reasoning_content: 'Step 1: ' } },
      { content: '', additional_kwargs: { reasoning_content: 'Step 2: ' } },
      { content: '', additional_kwargs: { reasoning_content: 'Done.' } },
      { content: 'Final answer', additional_kwargs: {} },
    ])

    const runner = new LangChainRunner({})
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'token', content: '', reasoningContent: 'Step 1: ' },
      { type: 'token', content: '', reasoningContent: 'Step 2: ' },
      { type: 'token', content: '', reasoningContent: 'Done.' },
      { type: 'token', content: 'Final answer' },
      { type: 'done' },
    ])
  })

  it('should handle streaming chunks without reasoningContent (no regression)', async () => {
    mockStreamYield([{ content: 'Hello' }, { content: ' world' }])

    const runner = new LangChainRunner({})
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'token', content: 'Hello' },
      { type: 'token', content: ' world' },
      { type: 'done' },
    ])
  })

  it('should stream reasoningContent from tool-calling path', async () => {
    const mockTool: ToolDefinition = {
      name: 'calc',
      description: 'Calculator',
      execute: vi.fn().mockResolvedValue('42'),
    }

    mockStreamToolResponses([
      { tool_calls: [{ name: 'calc', args: { input: '6*7' }, id: 'tc-1' }] },
      { content: 'The answer is 42', additional_kwargs: { reasoning_content: 'I used the calculator.' } },
    ])

    const runner = new LangChainRunner({ tools: [mockTool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'iteration_start', iteration: 1 },
      { type: 'token', content: 'The answer is 42', reasoningContent: 'I used the calculator.' },
      { type: 'done' },
    ])
  })

  it('should use DynamicStructuredTool for tools with schema', async () => {
    const structuredTool: StructuredToolDefinition = {
      name: 'search',
      description: 'Search with structured params',
      schema: z.object({ query: z.string(), limit: z.number().optional() }),
      execute: vi.fn().mockResolvedValue('search results'),
    }

    mockStreamToolResponses([
      { tool_calls: [{ name: 'search', args: { query: 'test', limit: 5 }, id: 'tc-1' }] },
      { content: 'Found results' },
    ])

    const runner = new LangChainRunner({ tools: [structuredTool] })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // Structured tool receives raw args object, not extracted string
    expect(structuredTool.execute).toHaveBeenCalledWith({ query: 'test', limit: 5 })
    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'iteration_start', iteration: 1 },
      { type: 'token', content: 'Found results' },
      { type: 'done' },
    ])
  })
})
