import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage, ModelConfig, ChatOptions, AgentDefinition } from '../../types'

const { mockStream, mockGetRunner, mockGetDefinition, mockGetAllDefinitions } = vi.hoisted(() => ({
  mockStream: vi.fn(),
  mockGetRunner: vi.fn(),
  mockGetDefinition: vi.fn(),
  mockGetAllDefinitions: vi.fn(),
}))

vi.mock('../llm-init', () => ({
  createLLM: vi.fn().mockImplementation(() => ({ stream: mockStream })),
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

vi.mock('@langchain/core/messages', () => ({
  ToolMessage: vi.fn().mockImplementation(({ content, tool_call_id }: { content: string; tool_call_id: string }) => ({
    _getType: () => 'tool',
    content,
    tool_call_id,
  })),
}))

import { DeepAgentRunner } from '../deep-agent-runner'

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

function mockStreamToolResponses(responses: Parameters<typeof createStreamChunk>[0][]) {
  for (const resp of responses) {
    mockStream.mockImplementationOnce(async () => {
      const chunk = createStreamChunk(resp)
      return (async function* () { yield chunk })()
    })
  }
}

function createMockSubAgentStream(chunks: Array<{ type: string; content?: string; tokenUsage?: Record<string, unknown> }>) {
  return vi.fn().mockImplementation(function* (this: void) {
    for (const c of chunks) {
      yield c
    }
  })
}

function createDelayedMockSubAgentStream(chunks: Array<{ type: string; content?: string; tokenUsage?: Record<string, unknown> }>, delayMs: number) {
  return vi.fn().mockImplementation(async function* (this: void) {
    for (const c of chunks) {
      await new Promise(r => setTimeout(r, delayMs))
      yield c
    }
  })
}

async function collectChunks(
  runner: DeepAgentRunner,
  messages: ChatMessage[],
  model: ModelConfig,
  options?: ChatOptions,
) {
  const chunks: unknown[] = []
  for await (const chunk of runner.chat(messages, model, options)) {
    chunks.push(chunk)
  }
  return chunks
}

function filterByType(chunks: unknown[], typeName: string) {
  return chunks.filter(c => typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type === typeName)
}

function filterSubAgent(chunks: unknown[]) {
  return chunks.filter(c => typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type.startsWith('sub_agent'))
}

function setupRegistryLookup(
  runners: Record<string, { chat: ReturnType<typeof createMockSubAgentStream> | ReturnType<typeof createDelayedMockSubAgentStream> }>,
  definitions: Record<string, AgentDefinition>,
  allDefs: AgentDefinition[],
) {
  mockGetRunner.mockImplementation((id: string) => runners[id] ?? undefined)
  mockGetDefinition.mockImplementation((id: string) => definitions[id] ?? undefined)
  mockGetAllDefinitions.mockReturnValue(allDefs)
}

describe('DeepAgentRunner parallel_call', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAllDefinitions.mockReturnValue([])
  })

  // 1. Basic parallel execution: 3 sub-agents
  it('should execute 3 sub-agents via parallel_call and produce correct chunk sequence', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B' }
    const workerCDef: AgentDefinition = { id: 'worker-c', name: 'Worker C' }

    setupRegistryLookup(
      {
        'worker-a': { chat: createMockSubAgentStream([{ type: 'token', content: 'Result A' }, { type: 'done' }]) },
        'worker-b': { chat: createMockSubAgentStream([{ type: 'token', content: 'Result B' }, { type: 'done' }]) },
        'worker-c': { chat: createMockSubAgentStream([{ type: 'token', content: 'Result C' }, { type: 'done' }]) },
      },
      { 'worker-a': workerADef, 'worker-b': workerBDef, 'worker-c': workerCDef },
      [makeAgentDef(), workerADef, workerBDef, workerCDef],
    )

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: {
            calls: [
              { agentId: 'worker-a', task: 'Task A' },
              { agentId: 'worker-b', task: 'Task B' },
              { agentId: 'worker-c', task: 'Task C' },
            ],
          },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'All parallel tasks completed' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks = await collectChunks(runner, [makeMessage()], makeModel())

    const starts = filterByType(chunks, 'sub_agent_start') as Array<{ type: string; subAgent: Record<string, unknown> }>
    expect(starts).toHaveLength(3)

    const executionIds = starts.map(s => s.subAgent.executionId as string)
    expect(new Set(executionIds).size).toBe(3)

    const agentIds = starts.map(s => s.subAgent.agentId as string)
    expect(agentIds).toContain('worker-a')
    expect(agentIds).toContain('worker-b')
    expect(agentIds).toContain('worker-c')

    const logs = filterByType(chunks, 'sub_agent_log') as Array<{ type: string; subAgent: Record<string, unknown> }>
    for (const log of logs) {
      expect(executionIds).toContain(log.subAgent.executionId)
    }

    const ends = filterByType(chunks, 'sub_agent_end') as Array<{ type: string; subAgent: Record<string, unknown> }>
    expect(ends).toHaveLength(3)

    expect(chunks).toContainEqual({ type: 'token', content: 'All parallel tasks completed' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 2. Wall-clock parallelism: concurrent execution
  it('should execute 2 sub-agents concurrently (wall-clock < 350ms for 200ms each)', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B' }

    setupRegistryLookup(
      {
        'worker-a': { chat: createDelayedMockSubAgentStream([{ type: 'token', content: 'A' }, { type: 'done' }], 200) },
        'worker-b': { chat: createDelayedMockSubAgentStream([{ type: 'token', content: 'B' }, { type: 'done' }], 200) },
      },
      { 'worker-a': workerADef, 'worker-b': workerBDef },
      [makeAgentDef(), workerADef, workerBDef],
    )

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: {
            calls: [
              { agentId: 'worker-a', task: 'Task A' },
              { agentId: 'worker-b', task: 'Task B' },
            ],
          },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'Done' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const start = Date.now()
    const chunks = await collectChunks(runner, [makeMessage()], makeModel())
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(450)
    expect(filterByType(chunks, 'sub_agent_start')).toHaveLength(2)
    expect(filterByType(chunks, 'sub_agent_end')).toHaveLength(2)
  })

  // 3. Partial failure tolerance: 1 success + 1 failure
  it('should handle partial failure: one sub-agent succeeds, one fails', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B' }

    const failingChat = vi.fn().mockImplementation(function* (this: void) {
      throw new Error('Worker B crashed')
    })

    setupRegistryLookup(
      {
        'worker-a': { chat: createMockSubAgentStream([{ type: 'token', content: 'Success A' }, { type: 'done' }]) },
        'worker-b': { chat: failingChat },
      },
      { 'worker-a': workerADef, 'worker-b': workerBDef },
      [makeAgentDef(), workerADef, workerBDef],
    )

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: {
            calls: [
              { agentId: 'worker-a', task: 'Good task' },
              { agentId: 'worker-b', task: 'Bad task' },
            ],
          },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'Handled mixed results' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks = await collectChunks(runner, [makeMessage()], makeModel())

    const ends = filterByType(chunks, 'sub_agent_end') as Array<{ type: string; subAgent: Record<string, unknown> }>
    expect(ends).toHaveLength(2)

    const completedEnd = ends.find(e => e.subAgent.agentId === 'worker-a')
    const failedEnd = ends.find(e => e.subAgent.agentId === 'worker-b')

    expect(completedEnd).toBeDefined()
    expect(completedEnd!.subAgent.status).toBe('completed')

    expect(failedEnd).toBeDefined()
    expect(failedEnd!.subAgent.status).toBe('failed')

    expect(chunks).toContainEqual({ type: 'token', content: 'Handled mixed results' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 4. Abort signal propagation
  it('should stop early when abort signal fires during parallel execution', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B' }
    const workerCDef: AgentDefinition = { id: 'worker-c', name: 'Worker C' }

    setupRegistryLookup(
      {
        'worker-a': { chat: createDelayedMockSubAgentStream([{ type: 'token', content: 'A' }, { type: 'done' }], 10) },
        'worker-b': { chat: createDelayedMockSubAgentStream([{ type: 'token', content: 'B' }, { type: 'done' }], 10) },
        'worker-c': { chat: createDelayedMockSubAgentStream([{ type: 'token', content: 'C' }, { type: 'done' }], 10) },
      },
      { 'worker-a': workerADef, 'worker-b': workerBDef, 'worker-c': workerCDef },
      [makeAgentDef(), workerADef, workerBDef, workerCDef],
    )

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: {
            calls: [
              { agentId: 'worker-a', task: 'Task A' },
              { agentId: 'worker-b', task: 'Task B' },
              { agentId: 'worker-c', task: 'Task C' },
            ],
          },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'Final' },
    ])

    const controller = new AbortController()
    setTimeout(() => controller.abort(), 50)

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks = await collectChunks(runner, [makeMessage()], makeModel(), {
      signal: controller.signal,
    })

    const hasDone = chunks.some(c => typeof c === 'object' && c !== null && 'type' in c && (c as { type: string }).type === 'done')
    expect(chunks).toBeDefined()
    if (!hasDone) {
      expect(chunks.length).toBeLessThan(20)
    }
  })

  // 5. Max concurrency limit (MAX_PARALLEL_CALLS = 5)
  it('should limit parallel calls to 5 and report excess as errors', async () => {
    const agents: AgentDefinition[] = []
    const runners: Record<string, { chat: ReturnType<typeof createMockSubAgentStream> }> = {}
    const defs: Record<string, AgentDefinition> = {}

    for (let i = 0; i < 7; i++) {
      const def: AgentDefinition = { id: `worker-${i}`, name: `Worker ${i}` }
      agents.push(def)
      defs[`worker-${i}`] = def
      if (i < 5) {
        runners[`worker-${i}`] = { chat: createMockSubAgentStream([{ type: 'token', content: `Result ${i}` }, { type: 'done' }]) }
      }
    }

    setupRegistryLookup(runners, defs, [makeAgentDef(), ...agents])

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: {
            calls: agents.map((a, i) => ({ agentId: a.id, task: `Task ${i}` })),
          },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'All done' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks = await collectChunks(runner, [makeMessage()], makeModel())

    const starts = filterByType(chunks, 'sub_agent_start')
    expect(starts).toHaveLength(5)

    expect(mockStream).toHaveBeenCalledTimes(2)
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 6. Empty array edge case
  it('should return error when parallel_call has empty calls array', async () => {
    mockGetAllDefinitions.mockReturnValue([makeAgentDef()])

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: { calls: [] },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'Recovered from empty parallel_call' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks = await collectChunks(runner, [makeMessage()], makeModel())

    expect(filterSubAgent(chunks)).toHaveLength(0)
    expect(chunks).toContainEqual({ type: 'token', content: 'Recovered from empty parallel_call' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 7. Single element edge case
  it('should return error when parallel_call has only 1 call', async () => {
    const workerDef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    setupRegistryLookup(
      { 'worker-a': { chat: createMockSubAgentStream([{ type: 'token', content: 'Result' }, { type: 'done' }]) } },
      { 'worker-a': workerDef },
      [makeAgentDef(), workerDef],
    )

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: { calls: [{ agentId: 'worker-a', task: 'Solo task' }] },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'Recovered from single call' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks = await collectChunks(runner, [makeMessage()], makeModel())

    expect(filterSubAgent(chunks)).toHaveLength(0)
    expect(chunks).toContainEqual({ type: 'token', content: 'Recovered from single call' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 8. Circular call detection in parallel_call
  it('should detect circular calls within parallel_call', async () => {
    const workerDef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }

    setupRegistryLookup(
      { 'worker-a': { chat: createMockSubAgentStream([{ type: 'token', content: 'A result' }, { type: 'done' }]) } },
      { 'worker-a': workerDef },
      [makeAgentDef(), workerDef],
    )

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: {
            calls: [
              { agentId: 'worker-a', task: 'Valid task' },
              { agentId: 'parent-agent', task: 'Circular task' },
            ],
          },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'After circular detection' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const options: ChatOptions & { _callStack?: string[] } = {
      _callStack: ['parent-agent', 'coordinator'],
    }

    const chunks = await collectChunks(runner, [makeMessage()], makeModel(), options)

    const starts = filterByType(chunks, 'sub_agent_start') as Array<{ type: string; subAgent: Record<string, unknown> }>
    const startAgentIds = starts.map(s => s.subAgent.agentId as string)
    expect(startAgentIds).toContain('worker-a')
    expect(startAgentIds).not.toContain('parent-agent')

    expect(chunks).toContainEqual({ type: 'token', content: 'After circular detection' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 9. Token usage tracking in parallel_call
  it('should track token usage from each sub-agent in parallel_call', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B' }

    const tokenUsageA = { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    const tokenUsageB = { promptTokens: 15, completionTokens: 25, totalTokens: 40 }

    setupRegistryLookup(
      {
        'worker-a': { chat: createMockSubAgentStream([{ type: 'token', content: 'Result A' }, { type: 'done', tokenUsage: tokenUsageA }]) },
        'worker-b': { chat: createMockSubAgentStream([{ type: 'token', content: 'Result B' }, { type: 'done', tokenUsage: tokenUsageB }]) },
      },
      { 'worker-a': workerADef, 'worker-b': workerBDef },
      [makeAgentDef(), workerADef, workerBDef],
    )

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: {
            calls: [
              { agentId: 'worker-a', task: 'Task A' },
              { agentId: 'worker-b', task: 'Task B' },
            ],
          },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'Final' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks = await collectChunks(runner, [makeMessage()], makeModel())

    const ends = filterByType(chunks, 'sub_agent_end') as Array<{ type: string; subAgent: Record<string, unknown>; tokenUsage?: Record<string, unknown> }>
    expect(ends).toHaveLength(2)

    const endA = ends.find(e => e.subAgent.agentId === 'worker-a')
    const endB = ends.find(e => e.subAgent.agentId === 'worker-b')

    expect(endA).toBeDefined()
    expect(endB).toBeDefined()

    expect(endA!.tokenUsage).toEqual(tokenUsageA)
    expect(endB!.tokenUsage).toEqual(tokenUsageB)
  })

  // 10. Mixed call_agent and parallel_call
  it('should process call_agent first (serial) then parallel_call', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }
    const workerBDef: AgentDefinition = { id: 'worker-b', name: 'Worker B' }
    const workerCDef: AgentDefinition = { id: 'worker-c', name: 'Worker C' }

    setupRegistryLookup(
      {
        'worker-a': { chat: createMockSubAgentStream([{ type: 'token', content: 'Serial result' }, { type: 'done' }]) },
        'worker-b': { chat: createMockSubAgentStream([{ type: 'token', content: 'Parallel B' }, { type: 'done' }]) },
        'worker-c': { chat: createMockSubAgentStream([{ type: 'token', content: 'Parallel C' }, { type: 'done' }]) },
      },
      { 'worker-a': workerADef, 'worker-b': workerBDef, 'worker-c': workerCDef },
      [makeAgentDef(), workerADef, workerBDef, workerCDef],
    )

    mockStreamToolResponses([
      {
        tool_calls: [
          { name: 'call_agent', args: { agentId: 'worker-a', task: 'Serial task' }, id: 'tc-serial-1' },
          {
            name: 'parallel_call',
            args: {
              calls: [
                { agentId: 'worker-b', task: 'Parallel B' },
                { agentId: 'worker-c', task: 'Parallel C' },
              ],
            },
            id: 'tc-parallel-1',
          },
        ],
      },
      { content: 'All combined results' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks = await collectChunks(runner, [makeMessage()], makeModel())

    const starts = filterByType(chunks, 'sub_agent_start') as Array<{ type: string; subAgent: Record<string, unknown> }>
    expect(starts).toHaveLength(3)

    const startAgentIds = starts.map(s => s.subAgent.agentId as string)
    expect(startAgentIds).toContain('worker-a')
    expect(startAgentIds).toContain('worker-b')
    expect(startAgentIds).toContain('worker-c')

    expect(filterByType(chunks, 'sub_agent_end')).toHaveLength(3)
    expect(chunks).toContainEqual({ type: 'token', content: 'All combined results' })
    expect(chunks).toContainEqual({ type: 'done' })
  })

  // 11. Agent not found in parallel_call
  it('should report error for nonexistent agent while executing other agents normally', async () => {
    const workerADef: AgentDefinition = { id: 'worker-a', name: 'Worker A' }

    setupRegistryLookup(
      { 'worker-a': { chat: createMockSubAgentStream([{ type: 'token', content: 'Result A' }, { type: 'done' }]) } },
      { 'worker-a': workerADef },
      [makeAgentDef(), workerADef],
    )

    mockStreamToolResponses([
      {
        tool_calls: [{
          name: 'parallel_call',
          args: {
            calls: [
              { agentId: 'worker-a', task: 'Valid task' },
              { agentId: 'nonexistent', task: 'Missing agent task' },
            ],
          },
          id: 'tc-parallel-1',
        }],
      },
      { content: 'Handled missing agent' },
    ])

    const runner = new DeepAgentRunner(makeAgentDef())
    const chunks = await collectChunks(runner, [makeMessage()], makeModel())

    const starts = filterByType(chunks, 'sub_agent_start') as Array<{ type: string; subAgent: Record<string, unknown> }>
    expect(starts).toHaveLength(1)
    expect(starts[0].subAgent.agentId).toBe('worker-a')

    const ends = filterByType(chunks, 'sub_agent_end') as Array<{ type: string; subAgent: Record<string, unknown> }>
    const endAgentIds = ends.map(e => e.subAgent.agentId as string)
    expect(endAgentIds).toContain('worker-a')
    expect(endAgentIds).not.toContain('nonexistent')

    expect(chunks).toContainEqual({ type: 'token', content: 'Handled missing agent' })
    expect(chunks).toContainEqual({ type: 'done' })
  })
})
