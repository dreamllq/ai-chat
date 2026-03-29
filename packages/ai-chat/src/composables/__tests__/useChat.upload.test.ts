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
  ChatChunk,
  MessageAttachment,
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

/** Create a pre-built URL attachment */
function createUrlAttachment(overrides: Partial<MessageAttachment> = {}): MessageAttachment {
  return {
    id: `upload-${overrides.name ?? 'photo.jpg'}`,
    name: 'photo.jpg',
    url: 'https://cdn.example.com/photo.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
    type: 'image',
    ...overrides,
  }
}

/** Create a pre-built base64 attachment */
function createBase64Attachment(overrides: Partial<MessageAttachment> = {}): MessageAttachment {
  return {
    id: crypto.randomUUID(),
    name: 'doc.pdf',
    data: 'data:application/pdf;base64,JVBERi0xLjQ=',
    size: 100,
    mimeType: 'application/pdf',
    type: 'document',
    ...overrides,
  }
}

// --- Test Suite ---

describe('useChat — file attachment pipeline', () => {
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

    mocks.getRunner.mockReturnValue(undefined)

    const setup = withSetup(useChat)
    chat = setup.result
    unmount = setup.unmount
    await flushLiveQuery()
  })

  afterEach(() => {
    unmount()
  })

  it('stores URL attachments in message metadata', async () => {
    const attachments = [
      createUrlAttachment({ name: 'photo.jpg', url: 'https://cdn.example.com/photo.jpg', type: 'image' }),
    ]

    await chat.sendMessage('Check this image', attachments)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(1)
    expect(files[0].url).toBe('https://cdn.example.com/photo.jpg')
    expect(files[0].type).toBe('image')
    expect(files[0].mimeType).toBe('image/jpeg')
    expect(files[0].name).toBe('photo.jpg')
  })

  it('stores base64 attachments in message metadata', async () => {
    const attachments = [
      createBase64Attachment({ name: 'doc.pdf', mimeType: 'application/pdf', type: 'document' }),
    ]

    await chat.sendMessage('Read this', attachments)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(1)
    expect(files[0].data).toMatch(/^data:application\/pdf;base64,/)
    expect(files[0].url).toBeUndefined()
    expect(files[0].type).toBe('document')
  })

  it('handles multiple attachments', async () => {
    const attachments = [
      createUrlAttachment({ name: 'photo.png', mimeType: 'image/png', type: 'image', url: 'https://cdn.example.com/photo.png' }),
      createBase64Attachment({ name: 'report.pdf', mimeType: 'application/pdf', type: 'document' }),
    ]

    await chat.sendMessage('See attached', attachments)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(2)

    const img = files.find((f) => f.name === 'photo.png')
    const pdf = files.find((f) => f.name === 'report.pdf')
    expect(img).toBeDefined()
    expect(img!.type).toBe('image')
    expect(pdf).toBeDefined()
    expect(pdf!.type).toBe('document')
  })

  it('no attachments: omits metadata.files field', async () => {
    await chat.sendMessage('Just text')
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(userMsg!.metadata?.files).toBeUndefined()
  })

  it('empty attachments array: omits metadata.files field', async () => {
    await chat.sendMessage('Just text', [])
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(userMsg!.metadata?.files).toBeUndefined()
  })

  it('preserves all attachment fields exactly as passed', async () => {
    const attachments = [
      createUrlAttachment({
        id: 'custom-id',
        name: 'photo.jpg',
        url: 'https://cdn.example.com/photo.jpg',
        size: 2048,
        mimeType: 'image/jpeg',
        type: 'image',
      }),
    ]

    await chat.sendMessage('Check', attachments)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files[0].id).toBe('custom-id')
    expect(files[0].size).toBe(2048)
  })
})
