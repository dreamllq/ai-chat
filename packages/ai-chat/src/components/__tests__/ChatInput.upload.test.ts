import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatInput from '../ChatInput.vue'

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

describe('ChatInput file upload (always visible)', () => {
  beforeEach(() => {
    mockT.mockClear()
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

  it('send emits { content, files } when files are selected', async () => {
    const wrapper = mountChatInput()
    const fileInput = wrapper.find('input[type="file"]')
    const textarea = wrapper.find('textarea.chat-input__textarea')

    // Set text content
    await textarea.setValue('Check this file')
    await wrapper.vm.$nextTick()

    // Simulate file selection
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.vm.$nextTick()

    // Click send
    const sendButton = wrapper
      .findAllComponents({ name: 'ElButton' })
      .find(b => b.props('type') === 'primary')
    await sendButton!.vm.$emit('click')
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted<{ content: string; files?: File[] }[]>('send')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0].content).toBe('Check this file')
    expect(emitted![0][0].files).toHaveLength(1)
    expect(emitted![0][0].files![0].name).toBe('hello.txt')
  })

  it('files cleared after successful send', async () => {
    const wrapper = mountChatInput()
    const fileInput = wrapper.find('input[type="file"]')
    const textarea = wrapper.find('textarea.chat-input__textarea')

    await textarea.setValue('Sending with file')
    await wrapper.vm.$nextTick()

    // Select a file
    const file = new File(['data'], 'data.csv', { type: 'text/csv' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.vm.$nextTick()

    // Verify file appears in preview
    expect(wrapper.text()).toContain('data.csv')

    // Send via Enter key (triggers handleSend directly)
    await textarea.trigger('keydown', { key: 'Enter' })
    await wrapper.vm.$nextTick()

    // Verify send was emitted with files
    const emitted = wrapper.emitted<{ content: string; files?: File[] }[]>('send')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0].files).toHaveLength(1)

    // File preview should be gone after send
    expect(wrapper.text()).not.toContain('data.csv')
    // File input area should still exist (button always visible)
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
  })

  it('send button disabled during streaming', async () => {
    const wrapper = mountChatInput({ isStreaming: true })
    const buttons = wrapper.findAllComponents({ name: 'ElButton' })

    // During streaming, stop button shown (danger type), send button hidden
    const sendButton = buttons.find(b => b.props('type') === 'primary')
    expect(sendButton).toBeFalsy()

    const stopButton = buttons.find(b => b.props('type') === 'danger')
    expect(stopButton).toBeTruthy()
  })

  it('file input has aria-label for accessibility', () => {
    const wrapper = mountChatInput()
    const fileInput = wrapper.find('input[type="file"]')
    expect(fileInput.exists()).toBe(true)
    expect(fileInput.attributes('aria-label')).toBe('Upload file')
  })
})
