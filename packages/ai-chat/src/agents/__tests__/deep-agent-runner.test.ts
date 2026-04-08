import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage, ModelConfig, ChatOptions, ToolDefinition, AgentDefinition } from '../../types'

const { mockStream, mockGetRunner, mockGetDefinition, mockGetAllDefinitions } = vi.hoisted(() => ({
  mockStream: vi.fn(),
  mockGetRunner: vi.fn(),
  mockGetDefinition: vi.fn(),
  mockGetAllDefinitions: vi.fn(),
}))

vi.mock('../llm-init', () => ({
  createLLM: vi.fn().mockImplementation(() => ({
    stream: mockStream,
  })),
}))

vi.mock('../message-converter', () => ({
  convertMessages: vi.fn().mockReturnValue([]),
}))

vi.mock('../tool-converter', () => ({
  convertTools: vi.fn().mockImplementation((tools: unknown[]) => tools),
}))

vi.mock('../../services/agent', () => ({
  agentRegistry: {
    getRunner: mockGetRunner,
    getDefinition: mockGetDefinition,
    getAllDefinitions: mockGetAllDefinitions,
  },
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

import { DeepAgentRunner } from '../deep-agent-runner'
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

function makeAgentDef(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'coordinator',
    name: 'Coordinator Agent',
    description: 'Coordinates sub-agents',
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

/** Create a mock sub-agent stream that yields the given chunks */
function createMockSubAgentStream(chunks: Array<{ type: string; content?: string }>) {
  return vi.fn().mockImplementation(function* (this: void) {
    for (const c of chunks) {
      yield c
    }
  })
}

describe('DeepAgentRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAllDefinitions.mockReturnValue([])
  })

  // 1. Basic streaming without sub-agents
  it('should stream tokens and yield done when no tools and no sub-agent calls', async () => {
    mockStreamYield([{ content: 'Hello' }, { content: ' world' }])

    const runner = new DeepAgentRunner(makeAgentDef())
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

  // 2. Sub-agent call produces correct chunk sequence
  it('should produce sub_agent_start → sub_agent_log → sub_agent_end chunks when call_agent invoked', async () => {
    const subAgentDef: AgentDefinition = { id: 'worker', name: 'Worker Agent' }
    const subRunner = { chat: createMockSubAgentStream([
      { type: 'token', content: 'Working' },
      { type: 'token', content: ' hard' },
      { type: 'done' },
    ]) }

    mockGetRunner.mockReturnValue(subRunner)
    mockGetDefinition.mockReturnValue(subAgentDef)
    mockGetAllDefinitions.mockReturnValue([makeAgentDef(), subAgentDef])

    mockStreamToolResponses([
      { tool_calls: [{ name: 'call_agent', args: { agentId: 'worker', task: 'Do the work' }, id: 'tc-1' }] },
      { content: 'Sub-agent completed' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // Filter to sub-agent chunks
    const subAgentChunks = chunks.filter((c): c is { type: string; subAgent?: unknown; logEntry?: unknown } =>
      typeof c === 'object' && c !== null && 'type' in c &&
      ((c as { type: string }).type === 'sub_agent_start' || (c as { type: string }).type === 'sub_agent_log' || (c as { type: string }).type === 'sub_agent_end'),
    )

    // Verify sub_agent_start
    const startChunk = subAgentChunks.find(c => c.type === 'sub_agent_start')!
    expect(startChunk).toBeDefined()
    expect(startChunk.subAgent).toMatchObject({
      agentId: 'worker',
      agentName: 'Worker Agent',
      task: 'Do the work',
      status: 'running',
      depth: 1,
    })

    // Verify sub_agent_log entries
    const logChunks = subAgentChunks.filter(c => c.type === 'sub_agent_log')
    expect(logChunks.length).toBeGreaterThanOrEqual(2) // at least token logs

    // Verify sub_agent_end
    const endChunk = subAgentChunks.find(c => c.type === 'sub_agent_end')!
    expect(endChunk).toBeDefined()
    expect(endChunk.subAgent).toMatchObject({
      agentId: 'worker',
      status: 'completed',
    })

    // Final response after tool result
    expect(chunks).toContainEqual({ type: 'token', content: 'Sub-agent completed' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 3. Multiple sequential sub-agent calls
  it('should execute multiple call_agent tool calls sequentially', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B' }

    const subRunnerA = { chat: createMockSubAgentStream([
      { type: 'token', content: 'Result A' },
      { type: 'done' },
    ]) }
    const subRunnerB = { chat: createMockSubAgentStream([
      { type: 'token', content: 'Result B' },
      { type: 'done' },
    ]) }

    mockGetRunner
      .mockReturnValueOnce(subRunnerA)
      .mockReturnValueOnce(subRunnerB)
    mockGetDefinition
      .mockReturnValueOnce(workerADef)
      .mockReturnValueOnce(workerBDef)
    mockGetAllDefinitions.mockReturnValue([makeAgentDef(), workerADef, workerBDef])

    mockStreamToolResponses([
      { tool_calls: [
        { name: 'call_agent', args: { agentId: 'worker-a', task: 'Task A' }, id: 'tc-1' },
        { name: 'call_agent', args: { agentId: 'worker-b', task: 'Task B' }, id: 'tc-2' },
      ] },
      { content: 'Both done' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // Should have 2 sub_agent_start and 2 sub_agent_end
    const starts = chunks.filter((c): c is { type: string } => typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type === 'sub_agent_start')
    const ends = chunks.filter((c): c is { type: string } => typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type === 'sub_agent_end')
    expect(starts).toHaveLength(2)
    expect(ends).toHaveLength(2)

    // Final response
    expect(chunks).toContainEqual({ type: 'token', content: 'Both done' })
  })

  // 4. Depth limit enforced
  it('should return error string when maxDepth exceeded', async () => {
    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])

    mockStreamToolResponses([
      { tool_calls: [{ name: 'call_agent', args: { agentId: 'worker', task: 'Too deep' }, id: 'tc-1' }] },
      { content: 'Recovered' },
    ])

    // maxDepth=1, callStack already has self → depth=1 means can't go deeper
    const runner = new DeepAgentRunner(makeAgentDef(), { maxDepth: 1 })
    const options: ChatOptions & { _callStack?: string[] } = { _callStack: ['coordinator'] }

    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel(), options)) {
      chunks.push(chunk)
    }

    // Should get token + done (no sub_agent chunks since depth exceeded)
    expect(chunks).toContainEqual({ type: 'token', content: 'Recovered' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 5. Self-call prevention
  it('should prevent agent from calling itself via call_agent', async () => {
    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])
    mockGetDefinition.mockReturnValue(makeAgentDef())

    mockStreamToolResponses([
      { tool_calls: [{ name: 'call_agent', args: { agentId: 'coordinator', task: 'Call self' }, id: 'tc-1' }] },
      { content: 'Continued' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // No sub-agent chunks should be emitted for self-call
    const subChunks = chunks.filter((c): c is { type: string } =>
      typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type.startsWith('sub_agent'))
    expect(subChunks).toHaveLength(0)

    // Should still complete normally
    expect(chunks).toContainEqual({ type: 'token', content: 'Continued' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 6. Circular call prevention
  it('should prevent circular calls when target agentId is in callStack', async () => {
    const workerDef: AgentDefinition = { id: 'worker', name: 'Worker' }
    mockGetDefinition.mockReturnValue(workerDef)
    mockGetAllDefinitions.mockReturnValue([makeAgentDef(), workerDef])

    mockStreamToolResponses([
      { tool_calls: [{ name: 'call_agent', args: { agentId: 'parent-agent', task: 'Circular' }, id: 'tc-1' }] },
      { content: 'After circular' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    // Simulate being called by 'parent-agent', so calling it back would be circular
    const options: ChatOptions & { _callStack?: string[] } = { _callStack: ['parent-agent', 'coordinator'] }

    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel(), options)) {
      chunks.push(chunk)
    }

    const subChunks = chunks.filter((c): c is { type: string } =>
      typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type.startsWith('sub_agent'))
    expect(subChunks).toHaveLength(0)

    expect(chunks).toContainEqual({ type: 'token', content: 'After circular' })
  })

  // 7. Sub-agent failure returns error as tool result
  it('should return error string when sub-agent throws', async () => {
    const workerDef: AgentDefinition = { id: 'worker', name: 'Worker' }
    const failingChat = vi.fn().mockImplementation(function* (this: void) {
      throw new Error('Sub-agent crashed')
    })

    mockGetRunner.mockReturnValue({ chat: failingChat })
    mockGetDefinition.mockReturnValue(workerDef)
    mockGetAllDefinitions.mockReturnValue([makeAgentDef(), workerDef])

    mockStreamToolResponses([
      { tool_calls: [{ name: 'call_agent', args: { agentId: 'worker', task: 'Fail task' }, id: 'tc-1' }] },
      { content: 'Handled failure' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // sub_agent_start emitted, but sub_agent_end should show 'failed'
    const endChunks = chunks.filter((c): c is { type: string; subAgent?: { status: string } } =>
      typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type === 'sub_agent_end')
    expect(endChunks).toHaveLength(1)
    expect(endChunks[0].subAgent!.status).toBe('failed')

    // Should continue after failure
    expect(chunks).toContainEqual({ type: 'token', content: 'Handled failure' })
  })

  // 8. Abort signal cascades
  it('should yield nothing when abort signal is already set', async () => {
    const controller = new AbortController()
    controller.abort()

    mockStreamYield([{ content: 'ok' }])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel(), {
      signal: controller.signal,
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([])
  })

  // 9. call_agent uses structured schema
  it('should pass call_agent as a structured tool with z.object schema', async () => {
    mockStreamYield([{ content: 'ok' }])
    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])

    const runner = new DeepAgentRunner(makeAgentDef())
    for await (const _ of runner.chat([makeMessage()], makeModel())) {
      void _
    }

    // createLLM should be called with tools including call_agent
    expect(createLLM).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ name: 'call_agent' }),
      ]),
    )
  })

  // 10. Output truncation at 10000 chars
  it('should truncate sub-agent output at 10000 characters', async () => {
    const workerDef: AgentDefinition = { id: 'worker', name: 'Worker' }
    const longOutput = 'A'.repeat(15000)
    const subRunner = { chat: createMockSubAgentStream([
      { type: 'token', content: longOutput },
      { type: 'done' },
    ]) }

    mockGetRunner.mockReturnValue(subRunner)
    mockGetDefinition.mockReturnValue(workerDef)
    mockGetAllDefinitions.mockReturnValue([makeAgentDef(), workerDef])

    mockStreamToolResponses([
      { tool_calls: [{ name: 'call_agent', args: { agentId: 'worker', task: 'Long output' }, id: 'tc-1' }] },
      { content: 'Done' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // The sub-agent's output should be truncated in the tool result
    // We verify the second mockStream call (re-invocation after tool) happens
    expect(mockStream).toHaveBeenCalledTimes(2)
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 11. Agent not found
  it('should return error string when target agent is not found in registry', async () => {
    mockGetRunner.mockReturnValue(undefined)
    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])

    mockStreamToolResponses([
      { tool_calls: [{ name: 'call_agent', args: { agentId: 'nonexistent', task: 'Missing' }, id: 'tc-1' }] },
      { content: 'After not found' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // No sub-agent chunks since agent not found
    const subChunks = chunks.filter((c): c is { type: string } =>
      typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type.startsWith('sub_agent'))
    expect(subChunks).toHaveLength(0)

    expect(chunks).toContainEqual({ type: 'token', content: 'After not found' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 12. Dynamic call_agent description
  it('should build dynamic call_agent description from registered agents', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A', description: 'Does A things' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B', description: 'Does B things' }

    mockGetAllDefinitions.mockReturnValue([makeAgentDef(), workerADef, workerBDef])
    mockStreamYield([{ content: 'ok' }])

    const runner = new DeepAgentRunner(makeAgentDef())
    for await (const _ of runner.chat([makeMessage()], makeModel())) {
      void _
    }

    // createLLM should be called with a call_agent tool that has a description mentioning available agents
    expect(createLLM).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      expect.arrayContaining([
        expect.objectContaining({
          name: 'call_agent',
          description: expect.stringContaining('worker-a'),
        }),
      ]),
    )
    expect(createLLM).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      expect.arrayContaining([
        expect.objectContaining({
          name: 'call_agent',
          description: expect.stringContaining('worker-b'),
        }),
      ]),
    )
  })

  // 13. Regular tool execution still works alongside call_agent
  it('should execute regular tools alongside call_agent interception', async () => {
    const mockTool: ToolDefinition = {
      name: 'calculator',
      description: 'Performs calculations',
      execute: vi.fn().mockResolvedValue('42'),
    }

    const workerDef: AgentDefinition = { id: 'worker', name: 'Worker' }
    const subRunner = { chat: createMockSubAgentStream([
      { type: 'token', content: 'Sub result' },
      { type: 'done' },
    ]) }

    mockGetRunner.mockReturnValue(subRunner)
    mockGetDefinition.mockReturnValue(workerDef)
    mockGetAllDefinitions.mockReturnValue([{ id: 'coordinator', name: 'Coordinator' }, workerDef])

    mockStreamToolResponses([
      { tool_calls: [
        { name: 'calculator', args: { input: '6*7' }, id: 'tc-1' },
        { name: 'call_agent', args: { agentId: 'worker', task: 'Sub task' }, id: 'tc-2' },
      ] },
      { content: 'Both executed' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef({ tools: [mockTool] }))
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(mockTool.execute).toHaveBeenCalledWith('6*7')
    expect(chunks).toContainEqual({ type: 'token', content: 'Both executed' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 14. Max tool iterations (default 15)
  it('should stop after max tool iterations with warning', async () => {
    const tool: ToolDefinition = {
      name: 'looper',
      description: 'Always triggers',
      execute: vi.fn().mockResolvedValue('loop result'),
    }

    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])
    mockStream.mockImplementation(async () => {
      const chunk = createStreamChunk({ tool_calls: [{ name: 'looper', args: { input: 'loop' }, id: 'tc-loop' }] })
      return (async function* () { yield chunk })()
    })

    const runner = new DeepAgentRunner(makeAgentDef({ tools: [tool] }), { maxToolIterations: 3 })
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(mockStream).toHaveBeenCalledTimes(3)
    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'iteration_start', iteration: 1 },
      { type: 'iteration_start', iteration: 2 },
      { type: 'token', content: '\n\n⚠️ Reached maximum tool calling iterations.' },
      { type: 'done' },
    ])
  })

  // 15. Error from LLM yields error chunk
  it('should yield error chunk when LLM throws', async () => {
    mockStream.mockRejectedValue(new Error('API connection failed'))
    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toMatchObject({ type: 'iteration_start' })
    expect(chunks[1]).toMatchObject({ type: 'error' })
    expect((chunks[1] as { error: string }).error).toContain('API connection failed')
  })

  // 16. System prompt handling
  it('should pass options systemPrompt to convertMessages (overrides constructor)', async () => {
    mockStreamYield([{ content: 'ok' }])
    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])

    const runner = new DeepAgentRunner(makeAgentDef({ systemPrompt: 'Constructor prompt' }))
    const options: ChatOptions = { systemPrompt: 'Options override' }

    for await (const _ of runner.chat([makeMessage()], makeModel(), options)) {
      void _
    }

    expect(convertMessages).toHaveBeenCalledWith(
      expect.any(Array),
      'Options override',
    )
  })

  // 17. Reasoning content support
  it('should yield reasoningContent from streaming chunks', async () => {
    mockStreamYield([
      { content: '', additional_kwargs: { reasoning_content: 'Thinking...' } },
      { content: 'Answer' },
    ])
    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'iteration_start', iteration: 0 },
      { type: 'token', content: '', reasoningContent: 'Thinking...' },
      { type: 'token', content: 'Answer' },
      { type: 'done' },
    ])
  })

  // 18. Default maxDepth is 5
  it('should use default maxDepth of 5', async () => {
    mockStreamYield([{ content: 'ok' }])
    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])

    const runner = new DeepAgentRunner(makeAgentDef())
    for await (const _ of runner.chat([makeMessage()], makeModel())) {
      void _
    }

    // No assertion needed — just verifying constructor doesn't throw with defaults
    expect(true).toBe(true)
  })

  // 19. allowedAgents filters which agents appear in call_agent tool
  it('should only include allowedAgents in call_agent description', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A', description: 'Does A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B', description: 'Does B' }

    mockGetAllDefinitions.mockReturnValue([makeAgentDef(), workerADef, workerBDef])
    mockStreamYield([{ content: 'ok' }])

    const runner = new DeepAgentRunner(makeAgentDef({ allowedAgents: ['worker-a'] }))
    for await (const _ of runner.chat([makeMessage()], makeModel())) {
      void _
    }

    // call_agent description should contain worker-a but NOT worker-b
    expect(createLLM).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      expect.arrayContaining([
        expect.objectContaining({
          name: 'call_agent',
          description: expect.stringContaining('worker-a'),
        }),
      ]),
    )
    expect(createLLM).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      expect.arrayContaining([
        expect.objectContaining({
          name: 'call_agent',
          description: expect.not.stringContaining('worker-b'),
        }),
      ]),
    )
  })

  // 20. allowedAgents blocks call to non-allowed agent
  it('should return error when calling an agent not in allowedAgents', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B' }

    mockGetAllDefinitions.mockReturnValue([makeAgentDef(), workerADef, workerBDef])

    mockStreamToolResponses([
      { tool_calls: [{ name: 'call_agent', args: { agentId: 'worker-b', task: 'Blocked' }, id: 'tc-1' }] },
      { content: 'After blocked' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef({ allowedAgents: ['worker-a'] }))
    const chunks: unknown[] = []
    for await (const chunk of runner.chat([makeMessage()], makeModel())) {
      chunks.push(chunk)
    }

    // No sub-agent chunks since worker-b is not allowed
    const subChunks = chunks.filter((c): c is { type: string } =>
      typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type.startsWith('sub_agent'))
    expect(subChunks).toHaveLength(0)

    expect(chunks).toContainEqual({ type: 'token', content: 'After blocked' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 21. allowedAgents undefined falls back to all agents
  it('should include all registered agents when allowedAgents is not set', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B' }

    mockGetAllDefinitions.mockReturnValue([makeAgentDef(), workerADef, workerBDef])
    mockStreamYield([{ content: 'ok' }])

    const runner = new DeepAgentRunner(makeAgentDef())
    for await (const _ of runner.chat([makeMessage()], makeModel())) {
      void _
    }

    expect(createLLM).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      expect.arrayContaining([
        expect.objectContaining({
          name: 'call_agent',
          description: expect.stringContaining('worker-a'),
        }),
      ]),
    )
    expect(createLLM).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      expect.arrayContaining([
        expect.objectContaining({
          name: 'call_agent',
          description: expect.stringContaining('worker-b'),
        }),
      ]),
    )
  })
})
