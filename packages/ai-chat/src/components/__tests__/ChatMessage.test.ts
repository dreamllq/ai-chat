import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { mount } from '@vue/test-utils'
import type { ChatMessage as ChatMessageType, AiChatSize } from '../../types'
import ChatMessage from '../ChatMessage.vue'

// Mock useLocale
const mockT = vi.fn((path: string) => {
  const map: Record<string, string> = {
    'chat.copyCode': 'Copy Code',
    'chat.copySuccess': 'Copied!',
    'chat.thinking': 'Thinking',
    'chat.thinkingToggle': 'Click to expand',
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
  value: {
    writeText: vi.fn(() => Promise.resolve()),
  },
  writable: true,
})

function createMessage(overrides: Partial<ChatMessageType> = {}): ChatMessageType {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  }
}

function mountChatMessage(props: { message: ChatMessageType }) {
  return mount(ChatMessage, {
    props,
  })
}

describe('ChatMessage', () => {
  beforeEach(() => {
    mockT.mockClear()
    vi.mocked(navigator.clipboard.writeText).mockReset()
  })

  // --- User message ---

  it('renders user message with right-aligned bubble', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'user', content: 'Hello world' }),
    })

    const container = wrapper.find('.chat-message')
    expect(container.classes()).toContain('chat-message--user')
    expect(wrapper.text()).toContain('Hello world')
  })

  // --- AI message ---

  it('renders AI message with left-aligned bubble and avatar', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'assistant', content: 'Hi there' }),
    })

    const container = wrapper.find('.chat-message')
    expect(container.classes()).toContain('chat-message--assistant')
    expect(wrapper.find('.chat-message__avatar').exists()).toBe(true)
    expect(wrapper.text()).toContain('Hi there')
  })

  it('does not show avatar for user messages', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'user' }),
    })

    expect(wrapper.find('.chat-message__avatar').exists()).toBe(false)
  })

  // --- Markdown rendering ---

  it('renders bold markdown correctly', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'assistant', content: '**bold text**' }),
    })

    const bubble = wrapper.find('.chat-message__bubble')
    expect(bubble.find('strong').exists()).toBe(true)
    expect(bubble.text()).toContain('bold text')
  })

  it('renders link markdown correctly', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'assistant', content: '[click here](https://example.com)' }),
    })

    const bubble = wrapper.find('.chat-message__bubble')
    const link = bubble.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://example.com')
    expect(link.text()).toBe('click here')
  })

  it('renders inline code correctly', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'assistant', content: 'Use `console.log()` to debug' }),
    })

    const bubble = wrapper.find('.chat-message__bubble')
    const code = bubble.find('code')
    expect(code.exists()).toBe(true)
    expect(code.text()).toBe('console.log()')
  })

  // --- Code blocks ---

  it('renders code block with copy button', async () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'assistant',
        content: '```javascript\nconsole.log("hello")\n```',
      }),
    })

    // Copy buttons are injected via onMounted → nextTick
    await wrapper.vm.$nextTick()

    const copyBtn = wrapper.find('.code-block-copy')
    expect(copyBtn.exists()).toBe(true)
    expect(copyBtn.text()).toBe('Copy Code')
  })

  it('copies code content when copy button is clicked', async () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'assistant',
        content: '```javascript\nconsole.log("hello")\n```',
      }),
    })

    await wrapper.vm.$nextTick()

    const copyBtn = wrapper.find('.code-block-copy')
    // Dispatch click event because the listener is added via addEventListener on a DOM element
    copyBtn.element.dispatchEvent(new Event('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('console.log("hello")')
  })

  it('shows success text after copying code', async () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'assistant',
        content: '```javascript\nconsole.log("hello")\n```',
      }),
    })

    await wrapper.vm.$nextTick()

    const copyBtn = wrapper.find('.code-block-copy')
    copyBtn.element.dispatchEvent(new Event('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(copyBtn.text()).toBe('Copied!')
  })

  // --- Streaming state ---

  it('shows streaming cursor when isStreaming is true', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'assistant', content: 'Loading...', isStreaming: true }),
    })

    const cursor = wrapper.find('.chat-message__cursor')
    expect(cursor.exists()).toBe(true)
  })

  it('does not show streaming cursor when isStreaming is false', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'assistant', content: 'Done', isStreaming: false }),
    })

    const cursor = wrapper.find('.chat-message__cursor')
    expect(cursor.exists()).toBe(false)
  })

  it('does not show streaming cursor when isStreaming is undefined', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'assistant', content: 'Done' }),
    })

    const cursor = wrapper.find('.chat-message__cursor')
    expect(cursor.exists()).toBe(false)
  })

  // --- system message ---

  it('renders system message without avatar', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'system', content: 'System notification' }),
    })

    const container = wrapper.find('.chat-message')
    expect(container.classes()).toContain('chat-message--system')
    expect(wrapper.find('.chat-message__avatar').exists()).toBe(false)
    expect(wrapper.text()).toContain('System notification')
  })

  // --- useLocale integration ---

  it('uses useLocale for copy code text', async () => {
    mountChatMessage({
      message: createMessage({
        role: 'assistant',
        content: '```js\ntest\n```',
      }),
    })

    // Copy button text is set during onMounted → nextTick
    await new Promise((r) => setTimeout(r, 0))

    expect(mockT).toHaveBeenCalledWith('chat.copyCode')
  })

  // --- Reasoning / Thinking ---

  it('does not show reasoning section when message has no reasoningContent', () => {
    const wrapper = mountChatMessage({
      message: createMessage({ role: 'assistant', content: 'Hello' }),
    })

    expect(wrapper.find('.chat-message__reasoning').exists()).toBe(false)
  })

  it('shows reasoning section when assistant message has reasoningContent', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'assistant',
        content: 'The answer is 42.',
        reasoningContent: 'Let me think about this...',
      }),
    })

    expect(wrapper.find('.chat-message__reasoning').exists()).toBe(true)
    expect(wrapper.find('.chat-message__reasoning-title').text()).toBe('Thinking')
    expect(wrapper.text()).toContain('Let me think about this')
  })

  it('renders reasoning content as markdown', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'assistant',
        content: 'Answer',
        reasoningContent: '**important** thought',
      }),
    })

    const reasoningContent = wrapper.find('.chat-message__reasoning-content')
    expect(reasoningContent.find('strong').exists()).toBe(true)
    expect(reasoningContent.text()).toContain('important')
  })

  it('toggles reasoning section on header click', async () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'assistant',
        content: 'Answer',
        reasoningContent: 'Some reasoning',
      }),
    })

    // Initially expanded (reasoningContent present)
    const collapseEl = wrapper.find('.chat-message__reasoning-collapse')
    expect(collapseEl.classes()).not.toContain('chat-message__reasoning-collapse--collapsed')
    expect(wrapper.find('.chat-message__reasoning-toggle').text()).toBe('▲')

    // Click to collapse
    await wrapper.find('.chat-message__reasoning-header').trigger('click')
    expect(wrapper.find('.chat-message__reasoning-collapse').classes()).toContain('chat-message__reasoning-collapse--collapsed')
    expect(wrapper.find('.chat-message__reasoning-toggle').text()).toBe('▼')

    // Click to expand again
    await wrapper.find('.chat-message__reasoning-header').trigger('click')
    expect(wrapper.find('.chat-message__reasoning-collapse').classes()).not.toContain('chat-message__reasoning-collapse--collapsed')
    expect(wrapper.find('.chat-message__reasoning-toggle').text()).toBe('▲')
  })

  it('does not show reasoning for user messages even with reasoningContent', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'Hello',
        reasoningContent: 'Some reasoning',
      }),
    })

    expect(wrapper.find('.chat-message__reasoning').exists()).toBe(false)
  })
})

describe('ChatMessage size', () => {
  function createMessageSize(initialSize: AiChatSize = 'default') {
    const size = ref<AiChatSize>(initialSize)
    const messageClasses = computed(() => ({ 'chat-message--mini': size.value === 'mini' }))
    return { size, messageClasses }
  }

  it('has no mini class by default', () => {
    const { messageClasses } = createMessageSize()
    expect(messageClasses.value['chat-message--mini']).toBe(false)
  })

  it('applies mini class when size is mini', () => {
    const { messageClasses } = createMessageSize('mini')
    expect(messageClasses.value['chat-message--mini']).toBe(true)
  })

  it('reacts to size change', () => {
    const { size, messageClasses } = createMessageSize()
    expect(messageClasses.value['chat-message--mini']).toBe(false)
    size.value = 'mini'
    expect(messageClasses.value['chat-message--mini']).toBe(true)
  })
})
