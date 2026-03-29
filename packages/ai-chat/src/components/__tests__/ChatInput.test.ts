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

// Element Plus stubs
const ElInputStub = {
  name: 'ElInput',
  template: `
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
      @keydown="$emit('keydown', $event)"
    ></textarea>
  `,
  props: ['modelValue', 'placeholder', 'type', 'autosize', 'resize'],
  emits: ['update:modelValue', 'keydown'],
}

const ElButtonStub = {
  name: 'ElButton',
  template: `<button :disabled="disabled" :type="nativeType" @click="$emit('click')"><slot /></button>`,
  props: ['type', 'disabled', 'nativeType', 'icon', 'circle'],
  emits: ['click'],
}

function mountChatInput(props: Record<string, unknown> = {}) {
  return mount(ChatInput, {
    props,
    global: {
      stubs: {
        ElInput: ElInputStub,
        ElButton: ElButtonStub,
      },
    },
  })
}

describe('ChatInput', () => {
  beforeEach(() => {
    mockT.mockClear()
  })

  it('renders textarea with correct placeholder', () => {
    const wrapper = mountChatInput()
    const textarea = wrapper.findComponent({ name: 'ElInput' })

    expect(textarea.props('type')).toBe('textarea')
    expect(textarea.props('placeholder')).toBe('Type a message...')
    expect(textarea.props('autosize')).toEqual({ minRows: 1, maxRows: 6 })
  })

  it('Enter triggers send with content', async () => {
    const wrapper = mountChatInput()
    const textarea = wrapper.findComponent({ name: 'ElInput' })

    // Set input value
    await textarea.vm.$emit('update:modelValue', 'Hello')
    await wrapper.vm.$nextTick()

    // Simulate Enter key
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false })
    Object.defineProperty(enterEvent, 'preventDefault', { value: vi.fn() })
    await textarea.vm.$emit('keydown', enterEvent)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('send')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([{ content: 'Hello' }])
  })

  it('Shift+Enter does NOT trigger send (adds newline)', async () => {
    const wrapper = mountChatInput()
    const textarea = wrapper.findComponent({ name: 'ElInput' })

    await textarea.vm.$emit('update:modelValue', 'Hello')
    await wrapper.vm.$nextTick()

    const shiftEnterEvent = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })
    await textarea.vm.$emit('keydown', shiftEnterEvent)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('send')).toBeFalsy()
  })

  it('empty input does NOT trigger send', async () => {
    const wrapper = mountChatInput()
    const textarea = wrapper.findComponent({ name: 'ElInput' })

    // Input is empty by default, try sending
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
    await textarea.vm.$emit('keydown', enterEvent)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('send')).toBeFalsy()

    // Also test whitespace-only
    await textarea.vm.$emit('update:modelValue', '   ')
    await wrapper.vm.$nextTick()

    await textarea.vm.$emit('keydown', enterEvent)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('send')).toBeFalsy()
  })

  it('shows stop button when isStreaming is true', async () => {
    const wrapper = mountChatInput({ isStreaming: true })
    const buttons = wrapper.findAllComponents({ name: 'ElButton' })

    // Should have a stop button with danger type
    const stopButton = buttons.find(b => b.props('type') === 'danger')
    expect(stopButton).toBeTruthy()
    expect(stopButton!.text()).toBe('Stop')

    // Send button should not be present
    const sendButton = buttons.find(b => b.props('type') === 'primary')
    expect(sendButton).toBeFalsy()
  })

  it('shows send button when isStreaming is false', () => {
    const wrapper = mountChatInput({ isStreaming: false })
    const buttons = wrapper.findAllComponents({ name: 'ElButton' })

    const sendButton = buttons.find(b => b.props('type') === 'primary')
    expect(sendButton).toBeTruthy()
  })

  it('stop button emits stop event', async () => {
    const wrapper = mountChatInput({ isStreaming: true })
    const stopButton = wrapper.findAllComponents({ name: 'ElButton' }).find(b => b.props('type') === 'danger')

    await stopButton!.vm.$emit('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('stop')).toBeTruthy()
  })

  it('file upload button visible when fileUploadService is provided', () => {
    const mockService = {
      upload: vi.fn(),
      getFileUrl: vi.fn(),
    }

    const wrapper = mountChatInput({ fileUploadService: mockService })

    // Should find a hidden file input
    const fileInput = wrapper.find('input[type="file"]')
    expect(fileInput.exists()).toBe(true)
  })

  it('file upload button hidden when fileUploadService is not provided', () => {
    const wrapper = mountChatInput()

    const fileInput = wrapper.find('input[type="file"]')
    expect(fileInput.exists()).toBe(false)
  })

  it('send clears input after sending', async () => {
    const wrapper = mountChatInput()
    const textarea = wrapper.findComponent({ name: 'ElInput' })

    // Set input value
    await textarea.vm.$emit('update:modelValue', 'Hello')
    await wrapper.vm.$nextTick()

    // Send via Enter key
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
    await textarea.vm.$emit('keydown', enterEvent)
    await wrapper.vm.$nextTick()

    // Verify send was emitted with correct content
    expect(wrapper.emitted('send')).toBeTruthy()
    expect(wrapper.emitted('send')![0]).toEqual([{ content: 'Hello' }])

    // After sending, the send button should be disabled again (input cleared internally)
    const sendButton = wrapper.findAllComponents({ name: 'ElButton' }).find(b => b.props('type') === 'primary')
    expect(sendButton!.props('disabled')).toBe(true)
  })

  it('send button is disabled when input is empty', () => {
    const wrapper = mountChatInput()
    const sendButton = wrapper.findAllComponents({ name: 'ElButton' }).find(b => b.props('type') === 'primary')

    expect(sendButton!.props('disabled')).toBe(true)
  })

  it('send button is enabled when input has content', async () => {
    const wrapper = mountChatInput()
    const textarea = wrapper.findComponent({ name: 'ElInput' })

    await textarea.vm.$emit('update:modelValue', 'Hello')
    await wrapper.vm.$nextTick()

    const sendButton = wrapper.findAllComponents({ name: 'ElButton' }).find(b => b.props('type') === 'primary')
    expect(sendButton!.props('disabled')).toBe(false)
  })

  it('clicking send button emits send with content', async () => {
    const wrapper = mountChatInput()
    const textarea = wrapper.findComponent({ name: 'ElInput' })

    await textarea.vm.$emit('update:modelValue', 'Test message')
    await wrapper.vm.$nextTick()

    const sendButton = wrapper.findAllComponents({ name: 'ElButton' }).find(b => b.props('type') === 'primary')
    await sendButton!.vm.$emit('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('send')).toBeTruthy()
    expect(wrapper.emitted('send')![0]).toEqual([{ content: 'Test message' }])
  })

  it('sends with files when files are selected', async () => {
    const mockService = {
      upload: vi.fn(),
      getFileUrl: vi.fn(),
    }

    const wrapper = mountChatInput({ fileUploadService: mockService })
    const textarea = wrapper.findComponent({ name: 'ElInput' })
    const fileInput = wrapper.find('input[type="file"]')

    // Set text
    await textarea.vm.$emit('update:modelValue', 'Check this file')
    await wrapper.vm.$nextTick()

    // Simulate file selection
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.vm.$nextTick()

    // Send
    const sendButton = wrapper.findAllComponents({ name: 'ElButton' }).find(b => b.props('type') === 'primary')
    await sendButton!.vm.$emit('click')
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('send')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0].content).toBe('Check this file')
    expect(emitted![0][0].files).toHaveLength(1)
    expect(emitted![0][0].files[0].name).toBe('test.txt')
  })

  it('shows file preview with remove button for selected files', async () => {
    const mockService = {
      upload: vi.fn(),
      getFileUrl: vi.fn(),
    }

    const wrapper = mountChatInput({ fileUploadService: mockService })
    const fileInput = wrapper.find('input[type="file"]')

    // Select a file
    const file = new File(['test'], 'document.pdf', { type: 'application/pdf' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.vm.$nextTick()

    // Should show file name in preview
    expect(wrapper.text()).toContain('document.pdf')

    // Should have a remove button
    const removeButtons = wrapper.findAll('.chat-input__file-remove')
    expect(removeButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('removing a file from preview clears it from selection', async () => {
    const mockService = {
      upload: vi.fn(),
      getFileUrl: vi.fn(),
    }

    const wrapper = mountChatInput({ fileUploadService: mockService })
    const fileInput = wrapper.find('input[type="file"]')

    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput.element, 'files', {
      value: [file],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('photo.jpg')

    // Click remove
    const removeButton = wrapper.find('.chat-input__file-remove')
    await removeButton.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('photo.jpg')
  })
})
