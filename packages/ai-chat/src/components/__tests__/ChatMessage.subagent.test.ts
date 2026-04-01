import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ChatMessage as ChatMessageType, SubAgentCallInfo } from '../../types'
import ChatMessage from '../ChatMessage.vue'

const mockT = vi.fn((path: string) => {
  const map: Record<string, string> = {
    'chat.copyCode': 'Copy Code',
    'chat.copySuccess': 'Copied!',
    'subAgent.callAgent': 'Call Agent',
    'subAgent.running': 'Running',
    'subAgent.completed': 'Completed',
    'subAgent.failed': 'Failed',
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

function createSubAgentCall(overrides: Partial<SubAgentCallInfo> = {}): SubAgentCallInfo {
  return {
    executionId: 'exec-1',
    agentId: 'agent-1',
    agentName: 'Research Agent',
    task: 'Search for information',
    status: 'completed',
    startTime: 1000,
    endTime: 2500,
    depth: 1,
    ...overrides,
  }
}

function createMessage(overrides: Partial<ChatMessageType> = {}): ChatMessageType {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'assistant',
    content: 'Here is the answer.',
    timestamp: Date.now(),
    ...overrides,
  }
}

function mountChatMessage(props: { message: ChatMessageType }) {
  return mount(ChatMessage, { props })
}

describe('ChatMessage - Sub-Agent Cards', () => {
  beforeEach(() => {
    mockT.mockClear()
  })

  it('does not show sub-agent section when message has no subAgentCalls', () => {
    const wrapper = mountChatMessage({
      message: createMessage(),
    })

    expect(wrapper.find('.chat-message__sub-agents').exists()).toBe(false)
  })

  it('does not show sub-agent section when subAgentCalls is empty array', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: [] },
      }),
    })

    expect(wrapper.find('.chat-message__sub-agents').exists()).toBe(false)
  })

  it('shows sub-agent section when metadata has subAgentCalls', () => {
    const call = createSubAgentCall()
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: [call] },
      }),
    })

    expect(wrapper.find('.chat-message__sub-agents').exists()).toBe(true)
    expect(wrapper.find('.chat-message__sub-agents-title').text()).toContain('Call Agent')
    expect(wrapper.find('.chat-message__sub-agents-title').text()).toContain('1')
  })

  it('renders multiple sub-agent cards', () => {
    const calls = [
      createSubAgentCall({ executionId: 'exec-1', agentName: 'Agent A' }),
      createSubAgentCall({ executionId: 'exec-2', agentName: 'Agent B', status: 'running', endTime: null }),
    ]
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: calls },
      }),
    })

    const cards = wrapper.findAll('.chat-message__sub-agent-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].find('.chat-message__sub-agent-card__name').text()).toBe('Agent A')
    expect(cards[1].find('.chat-message__sub-agent-card__name').text()).toBe('Agent B')
  })

  it('displays completed status badge with correct class and label', () => {
    const call = createSubAgentCall({ status: 'completed' })
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: [call] },
      }),
    })

    const card = wrapper.find('.chat-message__sub-agent-card')
    expect(card.classes()).toContain('chat-message__sub-agent-card--completed')

    const statusBadge = card.find('.chat-message__sub-agent-card__status')
    expect(statusBadge.classes()).toContain('--completed')
    expect(statusBadge.text()).toBe('Completed')
  })

  it('displays running status badge with spinner and no duration', () => {
    const call = createSubAgentCall({ status: 'running', endTime: null })
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: [call] },
      }),
    })

    const card = wrapper.find('.chat-message__sub-agent-card')
    expect(card.classes()).toContain('chat-message__sub-agent-card--running')

    const statusBadge = card.find('.chat-message__sub-agent-card__status')
    expect(statusBadge.classes()).toContain('--running')
    expect(statusBadge.text()).toBe('Running')

    expect(card.find('.chat-message__sub-agent-card__spinner').exists()).toBe(true)
    expect(card.find('.chat-message__sub-agent-card__duration').exists()).toBe(false)
  })

  it('displays failed status badge', () => {
    const call = createSubAgentCall({ status: 'failed', endTime: 2000 })
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: [call] },
      }),
    })

    const card = wrapper.find('.chat-message__sub-agent-card')
    expect(card.classes()).toContain('chat-message__sub-agent-card--failed')

    const statusBadge = card.find('.chat-message__sub-agent-card__status')
    expect(statusBadge.classes()).toContain('--failed')
    expect(statusBadge.text()).toBe('Failed')
  })

  it('shows task description in card', () => {
    const call = createSubAgentCall({ task: 'Analyze the data pipeline' })
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: [call] },
      }),
    })

    expect(wrapper.find('.chat-message__sub-agent-card__task').text()).toBe('Analyze the data pipeline')
  })

  it('shows duration for completed calls', () => {
    const call = createSubAgentCall({ startTime: 1000, endTime: 3500 })
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: [call] },
      }),
    })

    expect(wrapper.find('.chat-message__sub-agent-card__duration').text()).toBe('2.5s')
  })

  it('shows duration in ms for sub-second calls', () => {
    const call = createSubAgentCall({ startTime: 1000, endTime: 1500 })
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: [call] },
      }),
    })

    expect(wrapper.find('.chat-message__sub-agent-card__duration').text()).toBe('500ms')
  })

  it('emits open-sub-agent-log when card is clicked', async () => {
    const call = createSubAgentCall()
    const wrapper = mountChatMessage({
      message: createMessage({
        metadata: { subAgentCalls: [call] },
      }),
    })

    await wrapper.find('.chat-message__sub-agent-card').trigger('click')

    expect(wrapper.emitted('open-sub-agent-log')).toHaveLength(1)
    expect(wrapper.emitted('open-sub-agent-log')![0][0]).toEqual(call)
  })

  it('does not show sub-agent section for user messages', () => {
    const call = createSubAgentCall()
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        metadata: { subAgentCalls: [call] },
      }),
    })

    expect(wrapper.find('.chat-message__sub-agents').exists()).toBe(true)
  })
})
