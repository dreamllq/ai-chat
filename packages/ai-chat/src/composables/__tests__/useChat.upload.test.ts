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
  FileUploadService,
  UploadedFile,
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

async function* createMockStream(
  chunks: ChatChunk[],
): AsyncGenerator<ChatChunk, void, unknown> {
  for (const chunk of chunks) {
    yield chunk
  }
}

/** Create a mock File with given name, size, and type */
function createMockFile(
  name: string,
  type: string,
  size = 1024,
): File {
  const file = new File(['x'.repeat(size)], name, { type })
  return file
}

/** Create a mock FileUploadService that resolves with UploadedFile results */
function createMockUploadService(
  overrides?: Partial<FileUploadService>,
): FileUploadService {
  return {
    upload: vi.fn(async (file: File): Promise<UploadedFile> => ({
      id: `upload-${file.name}`,
      name: file.name,
      url: `https://cdn.example.com/${file.name}`,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    })),
    getFileUrl: vi.fn(async (fileId: string) => `https://cdn.example.com/${fileId}`),
    ...overrides,
  }
}

/** Create a failing FileUploadService */
function createFailingUploadService(): FileUploadService {
  return {
    upload: vi.fn(async () => {
      throw new Error('Upload failed: network error')
    }),
    getFileUrl: vi.fn(async () => ''),
  }
}

// --- Test Suite ---

describe('useChat — file upload pipeline', () => {
  let chat: ReturnType<typeof useChat>
  let unmount: () => void
  let messageService: MessageService

  // Mutable mock refs (re-created each test)
  let currentConversationId: ReturnType<typeof ref<string | null>>
  let currentConversation: ReturnType<typeof ref<Conversation | undefined>>
  let currentMessages: ReturnType<typeof ref<ChatMessage[]>>
  let models: ReturnType<typeof ref<ModelConfig[] | undefined>>

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

    // Default: no agent runner registered (agent-not-found path, simplest for upload tests)
    mocks.getRunner.mockReturnValue(undefined)

    const setup = withSetup(useChat)
    chat = setup.result
    unmount = setup.unmount
    await flushLiveQuery()
  })

  afterEach(() => {
    unmount()
  })

  // --- Upload pipeline tests ---

  it('URL upload path: uses FileUploadService and stores URL in attachment', async () => {
    const mockFile = createMockFile('photo.jpg', 'image/jpeg')
    const mockService = createMockUploadService()

    await chat.sendMessage('Check this image', [mockFile], mockService)
    await flushLiveQuery()

    expect(mockService.upload).toHaveBeenCalledOnce()
    expect(mockService.upload).toHaveBeenCalledWith(mockFile)

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(1)
    const attachment = files[0]
    expect(attachment.url).toBe('https://cdn.example.com/photo.jpg')
    expect(attachment.type).toBe('image')
    expect(attachment.mimeType).toBe('image/jpeg')
    expect(attachment.name).toBe('photo.jpg')
    expect(attachment.id).toBe('upload-photo.jpg')
    expect(attachment.data).toBeUndefined()
  })

  it('base64 fallback: encodes file as data URL when no service provided', async () => {
    const mockFile = createMockFile('doc.pdf', 'application/pdf', 100)

    await chat.sendMessage('Read this', [mockFile], null)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(1)
    const attachment = files[0]
    expect(attachment.data).toMatch(/^data:application\/pdf;base64,/)
    expect(attachment.url).toBeUndefined()
    expect(attachment.type).toBe('document')
    expect(attachment.mimeType).toBe('application/pdf')
    expect(attachment.name).toBe('doc.pdf')
  })

  it('handles multiple files with base64 fallback', async () => {
    const mockImgFile = createMockFile('photo.png', 'image/png', 50)
    const mockPdfFile = createMockFile('report.pdf', 'application/pdf', 200)

    await chat.sendMessage('See attached', [mockImgFile, mockPdfFile], null)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(2)

    const imgAttachment = files.find((f) => f.name === 'photo.png')
    const pdfAttachment = files.find((f) => f.name === 'report.pdf')
    expect(imgAttachment).toBeDefined()
    expect(imgAttachment!.type).toBe('image')
    expect(imgAttachment!.data).toMatch(/^data:image\/png;base64,/)

    expect(pdfAttachment).toBeDefined()
    expect(pdfAttachment!.type).toBe('document')
    expect(pdfAttachment!.data).toMatch(/^data:application\/pdf;base64,/)
  })

  it('upload failure blocks message creation', async () => {
    const mockFile = createMockFile('broken.txt', 'text/plain')
    const failingService = createFailingUploadService()

    await expect(
      chat.sendMessage('This should fail', [mockFile], failingService),
    ).rejects.toThrow('Upload failed: network error')

    // No user message should be persisted
    const msgs = await messageService.getByConversationId('conv-1')
    expect(msgs).toHaveLength(0)
  })

  it('no files: omits metadata.files field (same as current behavior)', async () => {
    await chat.sendMessage('Just text', [], null)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    // metadata should either be undefined or have no files key
    expect(userMsg!.metadata?.files).toBeUndefined()
  })

  it('empty file.type defaults mimeType to application/octet-stream', async () => {
    const mockFile = createMockFile('unknown', '', 50)

    await chat.sendMessage('Unknown file', [mockFile], null)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(1)
    expect(files[0].mimeType).toBe('application/octet-stream')
  })

  it('each attachment has a unique non-empty string id', async () => {
    const file1 = createMockFile('a.jpg', 'image/jpeg', 10)
    const file2 = createMockFile('b.png', 'image/png', 20)

    await chat.sendMessage('Two files', [file1, file2], null)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(2)

    const ids = files.map((f) => f.id)
    for (const id of ids) {
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    }
    // IDs must be unique
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getAttachmentType integration: image/jpeg → image, application/pdf → document', async () => {
    const imgFile = createMockFile('photo.jpg', 'image/jpeg', 10)
    const pdfFile = createMockFile('doc.pdf', 'application/pdf', 20)
    const mockService = createMockUploadService()

    await chat.sendMessage('Mixed files', [imgFile, pdfFile], mockService)
    await flushLiveQuery()

    const msgs = await messageService.getByConversationId('conv-1')
    const userMsg = msgs.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()

    const files = (userMsg!.metadata?.files as MessageAttachment[]) ?? []
    expect(files).toHaveLength(2)

    const imgAttachment = files.find((f) => f.name === 'photo.jpg')
    const pdfAttachment = files.find((f) => f.name === 'doc.pdf')
    expect(imgAttachment!.type).toBe('image')
    expect(pdfAttachment!.type).toBe('document')
  })
})
