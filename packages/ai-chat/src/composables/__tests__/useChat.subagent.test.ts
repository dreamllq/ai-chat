import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useChat } from '../useChat'
import { MessageService } from '../../services/database'
import { db } from '../../database/db'
import type {
  ChatMessage,
  Conversation,
  ModelConfig,
  AgentRunner,
  ChatChunk,
  SubAgentCallInfo,
} from '../../types'

// --- Mocks ---
const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useModel: vi.fn(),
  getRunner: vi.fn(),
}))

vi.mock('../useSession', () => ({ useSession: mocks.useSession }))
vi.mock('../useModel', () => ({ useModel: mocks.useModel }))
vi.mock('../../services/agent', () => ({
  agentRegistry: { getRunner: mocks.getRunner },
}))

// --- Helpers ---

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T
  const App = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  const wrapper = mount(App)
  return { result, unmount: () => wrapper.unmount() }
}

async function flushLiveQuery(): Promise<void> {
  await vi.waitFor(() => {}, { timeout: 200 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 50))
  await nextTick()
}

async function* createMockStream(
  chunks: ChatChunk[],
): AsyncGenerator<ChatChunk, void, unknown> {
  for (const chunk of chunks) {
    yield chunk
  }
}

// --- Test Suite ---

describe('useChat — sub-agent events', () => {
  let chat: ReturnType<typeof useChat>
  let unmount: () => void
  let messageService: MessageService

  let currentConversationId: ReturnType<typeof ref<string | null>>
  let currentConversation: ReturnType<typeof ref<Conversation | undefined>>
  let currentMessages: ReturnType<typeof ref<ChatMessage[]>>
  let models: ReturnType<typeof ref<ModelConfig[] | undefined>>

  beforeEach(async () => {
    await db.messages.clear()
    await db.conversations.clear()

    messageService = new MessageService()

    currentConversationId = ref<string | null>('conv-1')
    currentConversation = ref<Conversation | undefined>({
      id: 'conv-1',
      title: 'Test Chat',
      agentId: 'agent-1',
      modelId: 'model-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    currentMessages = ref<ChatMessage[]>([])
    models = ref<ModelConfig[] | undefined>([
      {
        id: 'model-1',
        name: 'Test Model',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        modelName: 'gpt-4',
        createdAt: Date.now(),
      },
    ])

    mocks.useSession.mockReturnValue({
      currentConversationId,
      currentConversation,
      currentMessages,
    })
    mocks.useModel.mockReturnValue({ models })

    const setup = withSetup(useChat)
    chat = setup.result
    unmount = setup.unmount
    await flushLiveQuery()
  })

  afterEach(() => {
    unmount()
  })

  it('sub_agent_start adds SubAgentCallInfo to metadata.subAgentCalls', async () => {
    const subAgent: SubAgentCallInfo = {
      executionId: 'exec-1',
      agentId: 'sub-agent-1',
      agentName: 'Researcher',
      task: 'Search for information',
      status: 'running',
      startTime: 1000,
      endTime: null,
      depth: 1,
    }

    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'sub_agent_start', subAgent },
          { type: 'token', content: 'Working on it...' },
          { type: 'done' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Search for X')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()

    const calls = assistantMsg!.metadata?.subAgentCalls as SubAgentCallInfo[] | undefined
    expect(calls).toBeDefined()
    expect(calls).toHaveLength(1)
    expect(calls![0]).toEqual(subAgent)
  })

  it('sub_agent_end updates matching SubAgentCallInfo status and endTime', async () => {
    const startAgent: SubAgentCallInfo = {
      executionId: 'exec-2',
      agentId: 'sub-agent-2',
      agentName: 'Coder',
      task: 'Write code',
      status: 'running',
      startTime: 2000,
      endTime: null,
      depth: 1,
    }

    const endAgent: SubAgentCallInfo = {
      executionId: 'exec-2',
      agentId: 'sub-agent-2',
      agentName: 'Coder',
      task: 'Write code',
      status: 'completed',
      startTime: 2000,
      endTime: 3000,
      depth: 1,
    }

    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'sub_agent_start', subAgent: startAgent },
          { type: 'sub_agent_end', subAgent: endAgent },
          { type: 'done' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Write some code')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()

    const calls = assistantMsg!.metadata?.subAgentCalls as SubAgentCallInfo[]
    expect(calls).toHaveLength(1)
    expect(calls[0].status).toBe('completed')
    expect(calls[0].endTime).toBe(3000)
  })

  it('sub_agent_log does not cause heavy DB writes', async () => {
    const subAgent: SubAgentCallInfo = {
      executionId: 'exec-3',
      agentId: 'sub-agent-3',
      agentName: 'Analyst',
      task: 'Analyze data',
      status: 'running',
      startTime: 4000,
      endTime: null,
      depth: 1,
    }

    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'sub_agent_start', subAgent },
          { type: 'sub_agent_log', subAgent, logEntry: { timestamp: 4500, type: 'token', content: 'Analyzing...' } },
          { type: 'sub_agent_log', subAgent, logEntry: { timestamp: 4600, type: 'tool_call', content: 'Using tool X' } },
          { type: 'sub_agent_end', subAgent: { ...subAgent, status: 'completed', endTime: 5000 } },
          { type: 'token', content: 'Analysis complete.' },
          { type: 'done' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Analyze this')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg!.content).toBe('Analysis complete.')
    const calls = assistantMsg!.metadata?.subAgentCalls as SubAgentCallInfo[]
    expect(calls).toHaveLength(1)
    expect(calls[0].status).toBe('completed')
  })

  it('handles multiple sub-agent calls', async () => {
    const sub1: SubAgentCallInfo = {
      executionId: 'exec-a',
      agentId: 'agent-a',
      agentName: 'Agent A',
      task: 'Task A',
      status: 'running',
      startTime: 1000,
      endTime: null,
      depth: 1,
    }
    const sub2: SubAgentCallInfo = {
      executionId: 'exec-b',
      agentId: 'agent-b',
      agentName: 'Agent B',
      task: 'Task B',
      status: 'running',
      startTime: 2000,
      endTime: null,
      depth: 1,
    }

    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'sub_agent_start', subAgent: sub1 },
          { type: 'sub_agent_start', subAgent: sub2 },
          { type: 'sub_agent_end', subAgent: { ...sub1, status: 'completed', endTime: 1500 } },
          { type: 'sub_agent_end', subAgent: { ...sub2, status: 'completed', endTime: 2500 } },
          { type: 'token', content: 'All done' },
          { type: 'done' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Run tasks')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    const calls = assistantMsg!.metadata?.subAgentCalls as SubAgentCallInfo[]

    expect(calls).toHaveLength(2)
    expect(calls.find((c) => c.executionId === 'exec-a')?.status).toBe('completed')
    expect(calls.find((c) => c.executionId === 'exec-a')?.endTime).toBe(1500)
    expect(calls.find((c) => c.executionId === 'exec-b')?.status).toBe('completed')
    expect(calls.find((c) => c.executionId === 'exec-b')?.endTime).toBe(2500)
  })

  it('handles sub-agent events interleaved with token and done events', async () => {
    const subAgent: SubAgentCallInfo = {
      executionId: 'exec-mixed',
      agentId: 'sub-agent-mixed',
      agentName: 'Mixed Agent',
      task: 'Mixed task',
      status: 'running',
      startTime: 1000,
      endTime: null,
      depth: 1,
    }

    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'token', content: 'Starting...' },
          { type: 'sub_agent_start', subAgent },
          { type: 'token', content: ' processing...' },
          { type: 'sub_agent_end', subAgent: { ...subAgent, status: 'completed', endTime: 2000 } },
          { type: 'token', content: ' done!' },
          { type: 'done' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Mixed test')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const assistantMsg = msgs.find((m) => m.role === 'assistant')

    expect(assistantMsg!.content).toBe('Starting... processing... done!')
    expect(assistantMsg!.isStreaming).toBe(false)

    const calls = assistantMsg!.metadata?.subAgentCalls as SubAgentCallInfo[]
    expect(calls).toHaveLength(1)
    expect(calls[0].executionId).toBe('exec-mixed')
    expect(calls[0].status).toBe('completed')
    expect(calls[0].endTime).toBe(2000)
  })

  it('handles sub_agent_end for failed status', async () => {
    const startAgent: SubAgentCallInfo = {
      executionId: 'exec-fail',
      agentId: 'sub-agent-fail',
      agentName: 'Fail Agent',
      task: 'Will fail',
      status: 'running',
      startTime: 1000,
      endTime: null,
      depth: 1,
    }

    const endAgent: SubAgentCallInfo = {
      executionId: 'exec-fail',
      agentId: 'sub-agent-fail',
      agentName: 'Fail Agent',
      task: 'Will fail',
      status: 'failed',
      startTime: 1000,
      endTime: 2000,
      depth: 1,
    }

    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'sub_agent_start', subAgent: startAgent },
          { type: 'sub_agent_end', subAgent: endAgent },
          { type: 'token', content: 'Task failed but continuing...' },
          { type: 'done' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Try failing task')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    const calls = assistantMsg!.metadata?.subAgentCalls as SubAgentCallInfo[]

    expect(calls).toHaveLength(1)
    expect(calls[0].status).toBe('failed')
    expect(calls[0].endTime).toBe(2000)
  })

  it('preserves existing metadata when adding subAgentCalls', async () => {
    const subAgent: SubAgentCallInfo = {
      executionId: 'exec-meta',
      agentId: 'sub-agent-meta',
      agentName: 'Meta Agent',
      task: 'Meta task',
      status: 'running',
      startTime: 1000,
      endTime: null,
      depth: 1,
    }

    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'token', content: '', reasoningContent: 'Thinking...' },
          { type: 'sub_agent_start', subAgent },
          { type: 'token', content: 'Result' },
          { type: 'sub_agent_end', subAgent: { ...subAgent, status: 'completed', endTime: 2000 } },
          { type: 'done' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Meta test')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const assistantMsg = msgs.find((m) => m.role === 'assistant')

    expect(assistantMsg!.reasoningContent).toBe('Thinking...')
    expect(assistantMsg!.content).toBe('Result')
    const calls = assistantMsg!.metadata?.subAgentCalls as SubAgentCallInfo[]
    expect(calls).toHaveLength(1)
    expect(calls[0].executionId).toBe('exec-meta')
  })
})
