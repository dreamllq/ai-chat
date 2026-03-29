import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import ChatInput from '../ChatInput.vue'
import type { FileUploadState, MessageAttachment } from '../../types'

// Mock useLocale
const mockT = vi.fn((path: string) => {
  const map: Record<string, string> = {
    'chat.placeholder': 'Type a message...',
    'chat.send': 'Send',
    'chat.stop': 'Stop',
    'upload.button': 'Upload File',
    'agent.select': 'Select Agent',
    'agent.builtin': 'Built-in',
    'model.selectModel': 'Select Model',
    'attachment.uploadFailed': 'Upload failed',
    'error.retry': 'Retry',
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

// Mock useModel
vi.mock('../../composables/useModel', () => ({
  useModel: () => ({
    models: { value: [] },
    currentModelId: { value: null },
    selectModel: vi.fn(),
  }),
}))

// Mock agentRegistry
vi.mock('../../services/agent', () => ({
  agentRegistry: {
    getAllDefinitions: () => [{ id: 'langchain-chat', name: 'Chat', isBuiltin: true }],
    version: { value: 0 },
  },
}))

// Mock useFileUpload composable
const mockFileStates = ref<FileUploadState[]>([])
const mockIsUploading = computed(() =>
  mockFileStates.value.some((s) => s.status === 'uploading'),
)
const mockIsAllReady = computed(
  () =>
    mockFileStates.value.length === 0 ||
    mockFileStates.value.every((s) => s.status === 'success'),
)
const mockAddFile = vi.fn()
const mockRemoveFile = vi.fn()
const mockRetryFile = vi.fn()
const mockGetCompletedAttachments = vi.fn(() => [] as MessageAttachment[])
const mockClear = vi.fn()

vi.mock('../../composables/useFileUpload', () => ({
  useFileUpload: () => ({
    fileStates: mockFileStates,
    isUploading: mockIsUploading,
    isAllReady: mockIsAllReady,
    addFile: mockAddFile,
    removeFile: mockRemoveFile,
    retryFile: mockRetryFile,
    getCompletedAttachments: mockGetCompletedAttachments,
    clear: mockClear,
  }),
}))

// Element Plus stubs (same as ChatInput.test.ts)
const ElButtonStub = {
  name: 'ElButton',
  template: `<button :disabled="disabled" :data-type="type" @click="$emit('click')"><slot /></button>`,
  props: ['type', 'disabled', 'nativeType', 'icon', 'circle', 'size', 'text'],
  emits: ['click'],
}

const ElSelectStub = {
  name: 'ElSelect',
  template: `<div class="el-select-stub"><slot /></div>`,
  props: ['modelValue', 'placeholder', 'size', 'class'],
  emits: ['update:modelValue'],
}

const ElOptionStub = {
  name: 'ElOption',
  template: `<div class="el-option-stub"><slot /></div>`,
  props: ['value', 'label'],
}

const ElTagStub = {
  name: 'ElTag',
  template: `<span class="el-tag-stub"><slot /></span>`,
  props: ['size', 'type'],
}

const ElIconStub = {
  name: 'ElIcon',
  template: `<span class="el-icon-stub"><slot /></span>`,
  props: ['size'],
}

const ModelManagerStub = {
  name: 'ModelManager',
  template: `<div class="model-manager-stub"></div>`,
  props: ['visible'],
  emits: ['update:visible'],
}

function mountChatInput(props: Record<string, unknown> = {}) {
  return mount(ChatInput, {
    props,
    global: {
      stubs: {
        ElButton: ElButtonStub,
        ElSelect: ElSelectStub,
        ElOption: ElOptionStub,
        ElTag: ElTagStub,
        ElIcon: ElIconStub,
        ModelManager: ModelManagerStub,
      },
    },
  })
}

/** Helper to create a FileUploadState */
function createFileState(
  name: string,
  status: FileUploadState['status'],
  progress = 0,
): FileUploadState {
  return {
    id: `test-${name}`,
    file: new File(['data'], name, { type: 'text/plain' }),
    status,
    progress,
    abortController: new AbortController(),
  }
}

describe('ChatInput file upload (with useFileUpload composable)', () => {
  beforeEach(() => {
    mockT.mockClear()
    mockFileStates.value = []
    mockAddFile.mockReset()
    mockRemoveFile.mockReset()
    mockRetryFile.mockReset()
    mockGetCompletedAttachments.mockReset()
    mockGetCompletedAttachments.mockReturnValue([])
    mockClear.mockReset()
  })

  it('upload button visible WITHOUT fileUploadService', () => {
    const wrapper = mountChatInput()
    const fileInput = wrapper.find('input[type="file"]')
    expect(fileInput.exists()).toBe(true)
  })

  it('upload button visible WITH fileUploadService', () => {
    const mockService = {
      upload: vi.fn(),
      getFileUrl: vi.fn(),
    }
    const wrapper = mountChatInput({ fileUploadService: mockService })
    const fileInput = wrapper.find('input[type="file"]')
    expect(fileInput.exists()).toBe(true)
  })

  it('file selection calls addFile for each file', async () => {
    const wrapper = mountChatInput()
    const fileInput = wrapper.find('input[type="file"]')

    const file1 = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    const file2 = new File(['world'], 'world.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file1, file2],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.vm.$nextTick()

    expect(mockAddFile).toHaveBeenCalledTimes(2)
    expect(mockAddFile).toHaveBeenCalledWith(file1)
    expect(mockAddFile).toHaveBeenCalledWith(file2)
  })

  it('send emits { content, attachments } when files are uploaded', async () => {
    // Set up a completed attachment
    const attachment: MessageAttachment = {
      id: 'att-1',
      name: 'hello.txt',
      url: 'https://example.com/hello.txt',
      size: 5,
      mimeType: 'text/plain',
      type: 'document',
    }
    mockFileStates.value = [createFileState('hello.txt', 'success', 100)]
    mockGetCompletedAttachments.mockReturnValue([attachment])

    const wrapper = mountChatInput()
    const textarea = wrapper.find('textarea.chat-input__textarea')

    // Set text content
    await textarea.setValue('Check this file')
    await wrapper.vm.$nextTick()

    // Click send
    const sendButton = wrapper
      .findAllComponents({ name: 'ElButton' })
      .find((b) => b.props('type') === 'primary')
    await sendButton!.vm.$emit('click')
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted<{
      content: string
      attachments?: MessageAttachment[]
    }[]>('send')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0].content).toBe('Check this file')
    expect(emitted![0][0].attachments).toHaveLength(1)
    expect(emitted![0][0].attachments![0].name).toBe('hello.txt')
  })

  it('clear called after successful send', async () => {
    mockFileStates.value = [createFileState('data.csv', 'success', 100)]
    mockGetCompletedAttachments.mockReturnValue([
      {
        id: 'att-1',
        name: 'data.csv',
        url: 'https://example.com/data.csv',
        size: 4,
        mimeType: 'text/csv',
        type: 'document',
      },
    ])

    const wrapper = mountChatInput()
    const textarea = wrapper.find('textarea.chat-input__textarea')

    await textarea.setValue('Sending with file')
    await wrapper.vm.$nextTick()

    // Send via Enter key
    await textarea.trigger('keydown', { key: 'Enter' })
    await wrapper.vm.$nextTick()

    // Verify send was emitted
    const emitted = wrapper.emitted<{
      content: string
      attachments?: MessageAttachment[]
    }[]>('send')
    expect(emitted).toBeTruthy()

    // clear() should have been called
    expect(mockClear).toHaveBeenCalledTimes(1)
  })

  it('send button disabled during streaming', async () => {
    const wrapper = mountChatInput({ isStreaming: true })
    const buttons = wrapper.findAllComponents({ name: 'ElButton' })

    // During streaming, stop button shown (danger type), send button hidden
    const sendButton = buttons.find((b) => b.props('type') === 'primary')
    expect(sendButton).toBeFalsy()

    const stopButton = buttons.find((b) => b.props('type') === 'danger')
    expect(stopButton).toBeTruthy()
  })

  it('send button disabled while uploading', async () => {
    // Set a file in uploading state — isAllReady will be false
    mockFileStates.value = [createFileState('big.pdf', 'uploading', 42)]

    const wrapper = mountChatInput()
    const textarea = wrapper.find('textarea.chat-input__textarea')

    await textarea.setValue('Sending while uploading')
    await wrapper.vm.$nextTick()

    // Find the primary button (send)
    const sendButton = wrapper
      .findAllComponents({ name: 'ElButton' })
      .find((b) => b.props('type') === 'primary')

    // Button should exist but be disabled
    expect(sendButton).toBeTruthy()
    expect(sendButton!.props('disabled')).toBe(true)
  })

  it('retry button visible on failed file', async () => {
    mockFileStates.value = [createFileState('failed.txt', 'failed', 0)]

    const wrapper = mountChatInput()
    await wrapper.vm.$nextTick()

    // Should show retry button
    const retryButton = wrapper.find('.chat-input__file-retry')
    expect(retryButton.exists()).toBe(true)
    expect(retryButton.text()).toBe('Retry')

    // Click retry
    await retryButton.trigger('click')
    expect(mockRetryFile).toHaveBeenCalledWith('test-failed.txt')
  })

  it('progress overlay rendered during upload', async () => {
    mockFileStates.value = [createFileState('uploading.txt', 'uploading', 55)]

    const wrapper = mountChatInput()
    await wrapper.vm.$nextTick()

    const progressBar = wrapper.find('.chat-input__file-progress-bar')
    expect(progressBar.exists()).toBe(true)
    expect(progressBar.attributes('style')).toContain('55%')

    const progressText = wrapper.find('.chat-input__file-progress-text')
    expect(progressText.exists()).toBe(true)
    expect(progressText.text()).toBe('55%')
  })

  it('file input has aria-label for accessibility', () => {
    const wrapper = mountChatInput()
    const fileInput = wrapper.find('input[type="file"]')
    expect(fileInput.exists()).toBe(true)
    expect(fileInput.attributes('aria-label')).toBe('Upload file')
  })

  it('send emits only content when no attachments', async () => {
    // No files — mockFileStates is empty (default)
    const wrapper = mountChatInput()
    const textarea = wrapper.find('textarea.chat-input__textarea')

    await textarea.setValue('Just text')
    await wrapper.vm.$nextTick()

    const sendButton = wrapper
      .findAllComponents({ name: 'ElButton' })
      .find((b) => b.props('type') === 'primary')
    await sendButton!.vm.$emit('click')
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted<{
      content: string
      attachments?: MessageAttachment[]
    }[]>('send')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0].content).toBe('Just text')
    // attachments should not be present (or undefined)
    expect(emitted![0][0].attachments).toBeUndefined()
  })

  it('remove file button calls handleRemoveFile', async () => {
    mockFileStates.value = [createFileState('remove-me.txt', 'success', 100)]

    const wrapper = mountChatInput()
    await wrapper.vm.$nextTick()

    const removeButton = wrapper.find('.chat-input__file-remove')
    expect(removeButton.exists()).toBe(true)

    await removeButton.trigger('click')
    expect(mockRemoveFile).toHaveBeenCalledWith('test-remove-me.txt')
  })

  it('file item shows success status class', async () => {
    mockFileStates.value = [createFileState('ok.txt', 'success', 100)]

    const wrapper = mountChatInput()
    await wrapper.vm.$nextTick()

    const fileItem = wrapper.find('.chat-input__file-item')
    expect(fileItem.exists()).toBe(true)
    expect(fileItem.classes()).toContain('chat-input__file-item--success')
  })
})
