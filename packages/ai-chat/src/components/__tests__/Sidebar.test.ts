import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import type { Conversation } from '../../types'
import Sidebar from '../Sidebar.vue'

// --- Mock useSession ---
const mockConversations = ref<Conversation[] | undefined>(undefined)
const mockCurrentConversationId = ref<string | null>(null)
const mockCreateConversation = vi.fn()
const mockDeleteConversation = vi.fn()
const mockRenameConversation = vi.fn()
const mockSwitchConversation = vi.fn()
const mockClearAllConversations = vi.fn()

vi.mock('../../composables/useSession', () => ({
  useSession: () => ({
    conversations: mockConversations,
    currentConversationId: mockCurrentConversationId,
    createConversation: mockCreateConversation,
    deleteConversation: mockDeleteConversation,
    clearAllConversations: mockClearAllConversations,
    renameConversation: mockRenameConversation,
    switchConversation: mockSwitchConversation,
  }),
}))

// --- Mock useLocale ---
const mockT = vi.fn((path: string) => {
  const map: Record<string, string> = {
    'conversation.newChat': 'New Chat',
    'conversation.deleteConfirm': 'Are you sure you want to delete this conversation?',
    'conversation.clearAll': 'Clear All',
    'conversation.clearAllConfirm': 'Are you sure you want to clear all conversations? This action cannot be undone.',
    'conversation.rename': 'Rename',
    'conversation.empty': 'No conversations yet',
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

// --- Element Plus Stubs ---
const ElButtonStub = {
  name: 'ElButton',
  template: '<button class="el-button" @click="$emit(\'click\', $event)"><slot /></button>',
  emits: ['click'],
}

const ElInputStub = {
  name: 'ElInput',
  template: '<input class="el-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keyup="$emit(\'keyup\', $event)" />',
  props: ['modelValue', 'placeholder', 'size'],
  emits: ['update:modelValue', 'keyup', 'blur'],
}

const ElPopconfirmStub = {
  name: 'ElPopconfirm',
  template: '<div class="el-popconfirm"><slot name="reference" /><slot /></div>',
  props: ['title', 'confirmButtonText', 'cancelButtonText'],
  emits: ['confirm', 'cancel'],
}

const ElIconStub = {
  name: 'ElIcon',
  template: '<span class="el-icon"><slot /></span>',
  props: ['size'],
}

// --- Helpers ---
function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: `conv-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Chat',
    agentId: 'default',
    modelId: 'default',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function mountSidebar(props: Record<string, unknown> = {}) {
  return mount(Sidebar, {
    props: {
      ...props,
    },
    global: {
      stubs: {
        ElButton: ElButtonStub,
        ElInput: ElInputStub,
        ElPopconfirm: ElPopconfirmStub,
        ElIcon: ElIconStub,
      },
    },
  })
}

// --- Tests ---
describe('Sidebar', () => {
  beforeEach(() => {
    mockConversations.value = undefined
    mockCurrentConversationId.value = null
    mockCreateConversation.mockReset()
    mockDeleteConversation.mockReset()
    mockClearAllConversations.mockReset()
    mockRenameConversation.mockReset()
    mockSwitchConversation.mockReset()
    mockT.mockClear()
  })

  it('renders conversation list with titles', () => {
    const conv1 = makeConversation({ id: 'c1', title: 'Chat One' })
    const conv2 = makeConversation({ id: 'c2', title: 'Chat Two' })
    mockConversations.value = [conv1, conv2]

    const wrapper = mountSidebar()
    const items = wrapper.findAll('.ai-chat-sidebar__item')

    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Chat One')
    expect(items[1].text()).toContain('Chat Two')
  })

  it('clicking a conversation triggers switchConversation', async () => {
    const conv = makeConversation({ id: 'c1', title: 'Switch Me' })
    mockConversations.value = [conv]

    const wrapper = mountSidebar()
    const item = wrapper.find('.ai-chat-sidebar__item')
    await item.trigger('click')

    expect(mockSwitchConversation).toHaveBeenCalledWith('c1')
  })

  it('New Chat button triggers createConversation with props', async () => {
    mockConversations.value = []

    const wrapper = mountSidebar({ agentId: 'agent-1', modelId: 'model-1' })
    const newChatBtn = wrapper.find('.ai-chat-sidebar__new-chat')
    await newChatBtn.trigger('click')

    expect(mockCreateConversation).toHaveBeenCalledWith('agent-1', 'model-1')
  })

  it('New Chat button uses default values when no props provided', async () => {
    mockConversations.value = []

    const wrapper = mountSidebar()
    const newChatBtn = wrapper.find('.ai-chat-sidebar__new-chat')
    await newChatBtn.trigger('click')

    expect(mockCreateConversation).toHaveBeenCalledWith('', '')
  })

  it('delete conversation with popconfirm triggers deleteConversation', async () => {
    const conv = makeConversation({ id: 'c1', title: 'Delete Me' })
    mockConversations.value = [conv]

    const wrapper = mountSidebar()
    const popconfirm = wrapper.find('.ai-chat-sidebar__item-actions').findComponent({ name: 'ElPopconfirm' })
    popconfirm.vm.$emit('confirm')
    await nextTick()

    expect(mockDeleteConversation).toHaveBeenCalledWith('c1')
  })

  it('rename conversation via double-click and Enter key', async () => {
    const conv = makeConversation({ id: 'c1', title: 'Old Title' })
    mockConversations.value = [conv]

    const wrapper = mountSidebar()
    const item = wrapper.find('.ai-chat-sidebar__item')

    // Double-click triggers rename mode
    await item.trigger('dblclick')

    // Should now show an input
    const input = wrapper.findComponent({ name: 'ElInput' })
    expect(input.exists()).toBe(true)

    // Update input value and simulate Enter key
    input.vm.$emit('update:modelValue', 'New Title')
    await nextTick()

    // Simulate Enter keypress via keyup event
    await input.find('input').trigger('keyup', { key: 'Enter' })

    expect(mockRenameConversation).toHaveBeenCalledWith('c1', 'New Title')
  })

  it('empty state shows placeholder text and New Chat button', () => {
    mockConversations.value = []

    const wrapper = mountSidebar()

    expect(wrapper.find('.ai-chat-sidebar__empty').exists()).toBe(true)
    expect(wrapper.find('.ai-chat-sidebar__empty').text()).toContain('No conversations yet')
    expect(wrapper.find('.ai-chat-sidebar__new-chat').exists()).toBe(true)
  })

  it('highlights the currently active conversation', async () => {
    const conv1 = makeConversation({ id: 'c1', title: 'Active' })
    const conv2 = makeConversation({ id: 'c2', title: 'Inactive' })
    mockConversations.value = [conv1, conv2]
    mockCurrentConversationId.value = 'c1'

    const wrapper = mountSidebar()
    const items = wrapper.findAll('.ai-chat-sidebar__item')

    expect(items[0].classes()).toContain('ai-chat-sidebar__item--active')
    expect(items[1].classes()).not.toContain('ai-chat-sidebar__item--active')
  })

  it('displays updatedAt timestamp for each conversation', () => {
    const now = Date.now()
    const conv = makeConversation({ id: 'c1', title: 'Timestamped', updatedAt: now })
    mockConversations.value = [conv]

    const wrapper = mountSidebar()
    const item = wrapper.find('.ai-chat-sidebar__item')

    // Should render some representation of the timestamp
    expect(item.find('.ai-chat-sidebar__item-time').exists()).toBe(true)
  })

  it('uses useLocale for i18n labels', () => {
    mockConversations.value = []

    mountSidebar()

    expect(mockT).toHaveBeenCalledWith('conversation.newChat')
    expect(mockT).toHaveBeenCalledWith('conversation.empty')
  })

  it('clear all button triggers clearAllConversations via popconfirm', async () => {
    const conv = makeConversation({ id: 'c1', title: 'Chat' })
    mockConversations.value = [conv]

    const wrapper = mountSidebar()
    const clearPopconfirm = wrapper.find('.ai-chat-sidebar__header').findComponent({ name: 'ElPopconfirm' })
    clearPopconfirm.vm.$emit('confirm')
    await nextTick()

    expect(mockClearAllConversations).toHaveBeenCalled()
  })

  it('clear all button is disabled when conversation list is empty', () => {
    mockConversations.value = []

    const wrapper = mountSidebar()
    const clearBtn = wrapper.find('.ai-chat-sidebar__clear-all')

    expect(clearBtn.exists()).toBe(true)
    expect(clearBtn.attributes('disabled')).toBeDefined()
  })

  it('handles undefined conversations gracefully (initial liveQuery state)', () => {
    mockConversations.value = undefined

    const wrapper = mountSidebar()

    // Should show empty state without crashing
    expect(wrapper.find('.ai-chat-sidebar__empty').exists()).toBe(true)
  })
})
