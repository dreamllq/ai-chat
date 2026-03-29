/**
 * Integration test: full file upload pipeline end-to-end
 *
 * Exercises: useChat.sendMessage → DB (MessageService) → LangChainChatAgent.convertMessages → ChatMessage rendering
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useChat } from '../../composables/useChat'
import { MessageService } from '../../services/database'
import { db } from '../../database/db'
import { LangChainChatAgent } from '../../agents/langchain-chat-agent'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import ChatMessage from '../../components/ChatMessage.vue'
import type {
  ChatMessage as ChatMessageType,
  Conversation,
  ModelConfig,
  AgentRunner,
  ChatChunk,
  FileUploadService,
  UploadedFile,
  MessageAttachment,
} from '../../types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock @langchain/openai (needed by LangChainChatAgent constructor)
const mockStream = vi.fn()
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    stream: mockStream,
  })),
}))

// Mock useSession, useModel, agentRegistry (needed by useChat)
const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useModel: vi.fn(),
  getRunner: vi.fn(),
}))
vi.mock('../../composables/useSession', () => ({ useSession: mocks.useSession }))
vi.mock('../../composables/useModel', () => ({ useModel: mocks.useModel }))
vi.mock('../../services/agent', () => ({
  agentRegistry: { getRunner: mocks.getRunner },
}))

// Mock useLocale (needed by ChatMessage component)
const mockT = vi.fn((path: string) => {
  const map: Record<string, string> = {
    'chat.copyCode': 'Copy Code',
    'chat.copySuccess': 'Copied!',
    'attachment.image': 'Image',
    'attachment.document': 'Document',
    'attachment.audio': 'Audio',
    'attachment.video': 'Video',
    'attachment.download': 'Download',
    'attachment.unsupportedPreview': 'Preview not available',
  }
  return map[path] ?? path
})
vi.mock('../../composables/useLocale', () => ({
  useLocale: () => ({
    t: mockT,
    locale: { value: {} },
    setLocale: vi.fn(),
  }),
}))

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn(() => Promise.resolve()) },
  writable: true,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function createMockFile(name: string, type: string, size = 1024): File {
  return new File(['x'.repeat(size)], name, { type })
}

function createMockUploadService(): FileUploadService {
  return {
    upload: vi.fn(async (file: File): Promise<UploadedFile> => ({
      id: `upload-${file.name}`,
      name: file.name,
      url: `https://cdn.example.com/${file.name}`,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    })),
    getFileUrl: vi.fn(async (fileId: string) => `https://cdn.example.com/${fileId}`),
  }
}

function mountChatMessage(props: { message: ChatMessageType }) {
  return mount(ChatMessage, { props })
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('File upload pipeline — integration', () => {
  let chat: ReturnType<typeof useChat>
  let unmount: () => void
  let messageService: MessageService
  let agent: LangChainChatAgent

  let currentConversationId: ReturnType<typeof ref<string | null>>
  let currentConversation: ReturnType<typeof ref<Conversation | undefined>>
  let currentMessages: ReturnType<typeof ref<ChatMessageType[]>>
  let models: ReturnType<typeof ref<ModelConfig[] | undefined>>

  /** Helper: capture messages passed to llm.stream() via agent.chat() */
  function captureStreamMessages(): { messages: unknown[] } {
    const captured: { messages: unknown[] } = { messages: [] }
    mockStream.mockImplementation(async (messages: unknown[]) => {
      captured.messages.push(...(messages as unknown[]))
      return (async function* () {
        yield { content: 'AI response' }
      })()
    })
    return captured
  }

  beforeEach(async () => {
    await db.messages.clear()
    await db.conversations.clear()

    messageService = new MessageService()
    agent = new LangChainChatAgent()
    vi.clearAllMocks()

    currentConversationId = ref<string | null>('conv-1')
    currentConversation = ref<Conversation | undefined>({
      id: 'conv-1',
      title: 'Test Chat',
      agentId: 'agent-1',
      modelId: 'model-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    currentMessages = ref<ChatMessageType[]>([])
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

    // No agent runner in registry by default — upload tests don't need the runner
    mocks.getRunner.mockReturnValue(undefined)
  })

  afterEach(() => {
    unmount?.()
  })

  // ─── Test 1: URL mode end-to-end ──────────────────────────────────────────

  it('URL mode: upload service called → DB has URL attachment → agent produces multimodal HumanMessage', async () => {
    const mockFile = createMockFile('photo.jpg', 'image/jpeg')
    const mockService = createMockUploadService()

    // Set up useChat
    const setup = withSetup(useChat)
    chat = setup.result
    unmount = setup.unmount
    await flushLiveQuery()

    // Step 1: sendMessage with file + upload service
    await chat.sendMessage('Look at this photo', [mockFile], mockService)
    await flushLiveQuery()

    // Step 2: assert upload was called
    expect(mockService.upload).toHaveBeenCalledOnce()
    expect(mockService.upload).toHaveBeenCalledWith(mockFile)

    // Step 3: assert message in DB has URL attachment
    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(1)
    expect(files[0].url).toBe('https://cdn.example.com/photo.jpg')
    expect(files[0].type).toBe('image')
    expect(files[0].mimeType).toBe('image/jpeg')
    expect(files[0].data).toBeUndefined()

    // Step 4: pass to LangChainChatAgent.convertMessages (via agent.chat)
    const captured = captureStreamMessages()
    for await (const _ of agent.chat([userMsg!], {
      id: 'model-1',
      name: 'Test',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'test',
      modelName: 'gpt-4',
      createdAt: Date.now(),
    })) {
      void _
    }

    // Step 5: assert HumanMessage has multimodal content
    expect(captured.messages).toHaveLength(1)
    const humanMsg = captured.messages[0] as HumanMessage
    expect(humanMsg).toBeInstanceOf(HumanMessage)

    const content = humanMsg.content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(Array.isArray(content)).toBe(true)
    expect(content[0]).toEqual({ type: 'text', text: 'Look at this photo' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://cdn.example.com/photo.jpg' },
    })
  })

  // ─── Test 2: Base64 mode end-to-end ───────────────────────────────────────

  it('Base64 mode: no service → DB has data attachment → agent produces multimodal HumanMessage', async () => {
    const mockFile = createMockFile('pic.png', 'image/png', 50)

    const setup = withSetup(useChat)
    chat = setup.result
    unmount = setup.unmount
    await flushLiveQuery()

    // Step 1: sendMessage without upload service
    await chat.sendMessage('See this', [mockFile], null)
    await flushLiveQuery()

    // Step 2: assert message in DB has base64 data
    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(1)
    expect(files[0].data).toMatch(/^data:image\/png;base64,/)
    expect(files[0].url).toBeUndefined()
    expect(files[0].type).toBe('image')

    // Step 3: pass to agent
    const captured = captureStreamMessages()
    for await (const _ of agent.chat([userMsg!], {
      id: 'model-1',
      name: 'Test',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'test',
      modelName: 'gpt-4',
      createdAt: Date.now(),
    })) {
      void _
    }

    // Step 4: assert HumanMessage content has image_url with data URI
    const humanMsg = captured.messages[0] as HumanMessage
    const content = humanMsg.content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(Array.isArray(content)).toBe(true)
    expect(content[1].type).toBe('image_url')
    expect(content[1].image_url!.url).toMatch(/^data:image\/png;base64,/)
  })

  // ─── Test 3: Mixed attachments ────────────────────────────────────────────

  it('Mixed attachments: image becomes image_url, PDF becomes text description', async () => {
    const imgFile = createMockFile('diagram.png', 'image/png', 50)
    const pdfFile = createMockFile('report.pdf', 'application/pdf', 200)
    const mockService = createMockUploadService()

    const setup = withSetup(useChat)
    chat = setup.result
    unmount = setup.unmount
    await flushLiveQuery()

    // Send with URL mode (both files via service)
    await chat.sendMessage('Analyze these', [imgFile, pdfFile], mockService)
    await flushLiveQuery()

    // Verify DB has 2 attachments with correct types
    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(2)

    const imgAtt = files.find((f) => f.name === 'diagram.png')
    const pdfAtt = files.find((f) => f.name === 'report.pdf')
    expect(imgAtt!.type).toBe('image')
    expect(pdfAtt!.type).toBe('document')

    // Pass to agent
    const captured = captureStreamMessages()
    for await (const _ of agent.chat([userMsg!], {
      id: 'model-1',
      name: 'Test',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'test',
      modelName: 'gpt-4',
      createdAt: Date.now(),
    })) {
      void _
    }

    // Assert: image becomes image_url, PDF becomes text
    const humanMsg = captured.messages[0] as HumanMessage
    const content = humanMsg.content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(Array.isArray(content)).toBe(true)
    // text + image_url + text(pdf desc)
    expect(content).toHaveLength(3)
    expect(content[0]).toEqual({ type: 'text', text: 'Analyze these' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://cdn.example.com/diagram.png' },
    })
    expect(content[2]).toEqual({
      type: 'text',
      text: '[Attached file: report.pdf, 0.2KB]',
    })
  })

  // ─── Test 4: Backward compatibility ───────────────────────────────────────

  it('Backward compatibility: old-format metadata does not crash agent or ChatMessage component', async () => {
    // Manually create a message with old format metadata {name, size, type}
    const msg = await messageService.create({
      conversationId: 'conv-1',
      role: 'user',
      content: 'Legacy data',
      metadata: {
        files: [{ name: 'old.txt', size: 1234, type: 'text/plain' }],
      },
    })

    // Step 1: agent handles it gracefully
    const captured = captureStreamMessages()
    for await (const _ of agent.chat([msg], {
      id: 'model-1',
      name: 'Test',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'test',
      modelName: 'gpt-4',
      createdAt: Date.now(),
    })) {
      void _
    }

    const humanMsg = captured.messages[0] as HumanMessage
    expect(humanMsg).toBeInstanceOf(HumanMessage)
    // Falls back to string content since old format doesn't pass isMessageAttachment
    expect(humanMsg.content).toBe('Legacy data')

    // Step 2: ChatMessage component renders without crash
    const wrapper = mountChatMessage({ message: msg })
    expect(wrapper.find('.chat-message__content').exists()).toBe(true)
    // Legacy items should render as document fallback
    const legacyDoc = wrapper.find('.chat-message__attachment-doc')
    expect(legacyDoc.exists()).toBe(true)
    expect(legacyDoc.text()).toContain('old.txt')
  })

  // ─── Test 5: No files — unchanged behavior ────────────────────────────────

  it('No files: metadata.files is undefined, agent produces string HumanMessage', async () => {
    const setup = withSetup(useChat)
    chat = setup.result
    unmount = setup.unmount
    await flushLiveQuery()

    // Send without files
    await chat.sendMessage('Just text')
    await flushLiveQuery()

    // Verify: metadata.files is undefined
    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(userMsg!.metadata?.files).toBeUndefined()

    // Agent produces string HumanMessage (same as before)
    const captured = captureStreamMessages()
    for await (const _ of agent.chat([userMsg!], {
      id: 'model-1',
      name: 'Test',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'test',
      modelName: 'gpt-4',
      createdAt: Date.now(),
    })) {
      void _
    }

    const humanMsg = captured.messages[0] as HumanMessage
    expect(humanMsg).toBeInstanceOf(HumanMessage)
    expect(humanMsg.content).toBe('Just text')
  })
})
