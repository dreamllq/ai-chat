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

describe('useChat', () => {
  let chat: ReturnType<typeof useChat>
  let unmount: () => void
  let messageService: MessageService

  // Mutable mock refs (re-created each test)
  let currentConversationId: ReturnType<typeof ref<string | null>>
  let currentConversation: ReturnType<typeof ref<Conversation | undefined>>
  let currentMessages: ReturnType<typeof ref<ChatMessage[]>>
  let currentModel: ReturnType<typeof ref<ModelConfig | undefined>>

  beforeEach(async () => {
    await db.messages.clear()
    await db.conversations.clear()

    messageService = new MessageService()

    // Fresh mock refs with sensible defaults
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
    currentModel = ref<ModelConfig | undefined>({
      id: 'model-1',
      name: 'Test Model',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      modelName: 'gpt-4',
      createdAt: Date.now(),
    })

    mocks.useSession.mockReturnValue({
      currentConversationId,
      currentConversation,
      currentMessages,
    })
    mocks.useModel.mockReturnValue({ currentModel })

    // Default: no agent runner registered
    mocks.getRunner.mockReturnValue(undefined)

    const setup = withSetup(useChat)
    chat = setup.result
    unmount = setup.unmount
    await flushLiveQuery()
  })

  afterEach(() => {
    unmount()
  })

  // --- Tests ---

  it('starts with isStreaming false', () => {
    expect(chat.isStreaming.value).toBe(false)
  })

  it('returns early when no model is selected', async () => {
    currentModel.value = undefined
    await chat.sendMessage('Hello')
    const msgs = await messageService.getByConversationId('conv-1')
    expect(msgs).toHaveLength(0)
  })

  it('returns early when no conversation is selected', async () => {
    currentConversation.value = undefined
    currentConversationId.value = null
    await chat.sendMessage('Hello')
    const msgs = await messageService.getByConversationId('conv-1')
    expect(msgs).toHaveLength(0)
  })

  it('shows error in assistant message when agent not found', async () => {
    mocks.getRunner.mockReturnValue(undefined)
    await chat.sendMessage('Hello')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    expect(msgs).toHaveLength(2)
    const userMsg = msgs.find((m) => m.role === 'user')
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    expect(userMsg!.content).toBe('Hello')
    expect(assistantMsg!.content).toContain('Agent not found')
  })

  it('streams response token by token and saves to DB', async () => {
    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'token', content: 'Hello' },
          { type: 'token', content: ' world' },
          { type: 'done' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Hi there')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    expect(msgs).toHaveLength(2)
    const userMsg = msgs.find((m) => m.role === 'user')
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    expect(userMsg!.content).toBe('Hi there')
    expect(assistantMsg!.content).toBe('Hello world')
    expect(assistantMsg!.isStreaming).toBe(false)
  })

  it('sets isStreaming true during stream and false after completion', async () => {
    let resolveStream: () => void
    const streamPromise = new Promise<void>((r) => {
      resolveStream = r
    })

    async function* slowStream(): AsyncGenerator<ChatChunk, void, unknown> {
      yield { type: 'token', content: 'Start' }
      await streamPromise
      yield { type: 'done' }
    }

    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(slowStream()),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    const sendPromise = chat.sendMessage('Hello')

    // Wait for isStreaming to become true
    await vi.waitFor(() => expect(chat.isStreaming.value).toBe(true), {
      timeout: 1000,
    })

    resolveStream!()
    await sendPromise

    expect(chat.isStreaming.value).toBe(false)
  })

  it('stopStreaming aborts the current stream', async () => {
    async function* abortableStream(
      signal?: AbortSignal,
    ): AsyncGenerator<ChatChunk, void, unknown> {
      yield { type: 'token', content: 'Partial' }
      await new Promise<void>((resolve) => {
        if (signal?.aborted) {
          resolve()
          return
        }
        signal?.addEventListener('abort', () => resolve())
      })
      if (signal?.aborted) return
      yield { type: 'done' }
    }

    const mockRunner: AgentRunner = {
      chat: vi.fn().mockImplementation((_msgs, _model, opts) =>
        abortableStream(opts?.signal),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    const sendPromise = chat.sendMessage('Hello')

    await vi.waitFor(() => expect(chat.isStreaming.value).toBe(true), {
      timeout: 1000,
    })

    chat.stopStreaming()

    await sendPromise
    expect(chat.isStreaming.value).toBe(false)
  })

  it('handles error chunks from agent runner', async () => {
    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'token', content: 'Starting...' },
          { type: 'error', error: 'API rate limit exceeded' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Hello')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    expect(msgs).toHaveLength(2)
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg!.content).toContain('Starting...')
    expect(assistantMsg!.content).toContain('API rate limit exceeded')
    expect(assistantMsg!.isStreaming).toBe(false)
  })

  it('persists user and assistant messages to IndexDB', async () => {
    const mockRunner: AgentRunner = {
      chat: vi.fn().mockReturnValue(
        createMockStream([
          { type: 'token', content: 'Response text' },
          { type: 'done' },
        ]),
      ),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Persist test')
    await flushLiveQuery()

    const dbMessages = await db.messages
      .where('conversationId')
      .equals('conv-1')
      .toArray()
    expect(dbMessages).toHaveLength(2)

    const userMsg = dbMessages.find((m) => m.role === 'user')
    const assistantMsg = dbMessages.find((m) => m.role === 'assistant')
    expect(userMsg).toBeDefined()
    expect(userMsg!.content).toBe('Persist test')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg!.content).toBe('Response text')
  })

  it('passes conversation history to agent runner', async () => {
    // Pre-create messages in DB for history
    await messageService.create({
      conversationId: 'conv-1',
      role: 'user',
      content: 'Previous Q',
    })
    await messageService.create({
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Previous A',
    })

    const chatSpy = vi.fn().mockReturnValue(createMockStream([{ type: 'done' }]))
    const mockRunner: AgentRunner = { chat: chatSpy }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('New question')

    expect(chatSpy).toHaveBeenCalledOnce()
    const calledWithMessages = chatSpy.mock.calls[0][0] as ChatMessage[]
    // Should include: previous user, previous assistant, and the new user message
    // (NOT the placeholder assistant message)
    expect(calledWithMessages).toHaveLength(3)
    const contents = calledWithMessages.map((m) => m.content)
    expect(contents).toContain('Previous Q')
    expect(contents).toContain('Previous A')
    expect(contents).toContain('New question')
  })

  it('isStreaming resets to false even on unexpected errors', async () => {
    const mockRunner: AgentRunner = {
      chat: vi.fn().mockImplementation(() => {
        throw new Error('Unexpected failure')
      }),
    }
    mocks.getRunner.mockReturnValue(mockRunner)

    await chat.sendMessage('Hello')

    expect(chat.isStreaming.value).toBe(false)

    // Assistant message should contain error info
    const msgs = await messageService.getByConversationId('conv-1')
    expect(msgs).toHaveLength(2)
    const assistantMsg = msgs.find((m) => m.role === 'assistant')
    expect(assistantMsg!.content).toContain('Unexpected failure')
  })
})
