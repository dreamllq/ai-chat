import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed, nextTick } from 'vue'
import type { ChatMessage, AiChatSize } from '../../types'
import ChatMessageList from '../ChatMessageList.vue'

// Mock useChat
const mockMessages = ref<ChatMessage[]>([])
const mockIsStreaming = ref(false)

vi.mock('../../composables/useChat', () => ({
  useChat: () => ({
    currentMessages: mockMessages,
    isStreaming: mockIsStreaming,
    sendMessage: vi.fn(),
    stopStreaming: vi.fn(),
  }),
}))

// Mock useSize
const mockSize = ref<AiChatSize>('default')

vi.mock('../../size', () => ({
  useSize: () => mockSize,
}))

// Mock useLocale
const mockT = vi.fn((path: string) => {
  const map: Record<string, string> = {
    'chat.copyCode': 'Copy Code',
    'chat.copySuccess': 'Copied!',
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

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  }
}

function mountChatMessageList() {
  return mount(ChatMessageList, {
    attachTo: document.body,
  })
}

describe('ChatMessageList', () => {
  beforeEach(() => {
    mockMessages.value = []
    mockIsStreaming.value = false
    mockSize.value = 'default'
    mockT.mockClear()

    // requestAnimationFrame callbacks are not flushed by nextTick() in jsdom,
    // so stub it to execute synchronously for scroll behavior tests
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  it('renders empty list when no messages', () => {
    const wrapper = mountChatMessageList()

    const messages = wrapper.findAllComponents({ name: 'ChatMessage' })
    expect(messages).toHaveLength(0)
  })

  it('renders ChatMessage for each message', async () => {
    mockMessages.value = [
      createMessage({ id: 'msg-1', role: 'user', content: 'Hi' }),
      createMessage({ id: 'msg-2', role: 'assistant', content: 'Hello!' }),
    ]

    const wrapper = mountChatMessageList()
    await nextTick()

    const messages = wrapper.findAllComponents({ name: 'ChatMessage' })
    expect(messages).toHaveLength(2)
  })

  it('passes correct message props to each ChatMessage', async () => {
    const userMsg = createMessage({ id: 'msg-1', role: 'user', content: 'User msg' })
    const aiMsg = createMessage({ id: 'msg-2', role: 'assistant', content: 'AI reply' })
    mockMessages.value = [userMsg, aiMsg]

    const wrapper = mountChatMessageList()
    await nextTick()

    const messages = wrapper.findAllComponents({ name: 'ChatMessage' })
    expect(messages[0].props('message')).toEqual(userMsg)
    expect(messages[1].props('message')).toEqual(aiMsg)
  })

  it('renders scrollable container', () => {
    const wrapper = mountChatMessageList()

    const container = wrapper.find('.chat-message-list')
    expect(container.exists()).toBe(true)
  })

  it('auto-scrolls to bottom when new messages are added', async () => {
    const wrapper = mountChatMessageList()
    const container = wrapper.find('.chat-message-list').element as HTMLElement

    // Mock scrollHeight and clientHeight to simulate overflow
    Object.defineProperty(container, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true })

    // Add messages
    mockMessages.value = [
      createMessage({ id: 'msg-1', role: 'user', content: 'First' }),
    ]
    await nextTick()
    await nextTick()

    expect(container.scrollTop).toBe(1500) // scrollHeight - clientHeight
  })

  it('auto-scrolls when streaming message updates', async () => {
    const wrapper = mountChatMessageList()
    const container = wrapper.find('.chat-message-list').element as HTMLElement

    Object.defineProperty(container, 'scrollHeight', { value: 3000, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true })

    mockMessages.value = [
      createMessage({ id: 'msg-1', role: 'user', content: 'Hi' }),
      createMessage({ id: 'msg-2', role: 'assistant', content: 'Hello...', isStreaming: true }),
    ]
    await nextTick()
    await nextTick()

    expect(container.scrollTop).toBe(2500)
  })

  it('updates when messages change', async () => {
    mockMessages.value = [createMessage({ id: 'msg-1', role: 'user', content: 'One' })]
    const wrapper = mountChatMessageList()
    await nextTick()

    expect(wrapper.findAllComponents({ name: 'ChatMessage' })).toHaveLength(1)

    mockMessages.value = [
      ...mockMessages.value,
      createMessage({ id: 'msg-2', role: 'assistant', content: 'Two' }),
    ]
    await nextTick()

    expect(wrapper.findAllComponents({ name: 'ChatMessage' })).toHaveLength(2)
  })

  it('has no mini class by default', () => {
    const wrapper = mountChatMessageList()
    expect(wrapper.find('.chat-message-list').classes()).not.toContain('chat-message-list--mini')
  })

  it('applies mini class when size is mini', async () => {
    mockSize.value = 'mini'
    const wrapper = mountChatMessageList()
    await nextTick()
    expect(wrapper.find('.chat-message-list').classes()).toContain('chat-message-list--mini')
  })

  it('reacts to size change', async () => {
    const wrapper = mountChatMessageList()
    expect(wrapper.find('.chat-message-list').classes()).not.toContain('chat-message-list--mini')

    mockSize.value = 'mini'
    await nextTick()
    expect(wrapper.find('.chat-message-list').classes()).toContain('chat-message-list--mini')

    mockSize.value = 'default'
    await nextTick()
    expect(wrapper.find('.chat-message-list').classes()).not.toContain('chat-message-list--mini')
  })
})
