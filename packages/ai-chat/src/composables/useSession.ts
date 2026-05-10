import { ref, computed, watch, type Ref } from 'vue'
import { liveQuery, ConversationService, MessageService } from '../services/database'
import { useObservable } from './useObservable'
import type { Conversation, ChatMessage } from '../types'

interface SessionState {
  currentConversationId: Ref<string | null>
  currentMessages: Ref<ChatMessage[]>
  messagesUnsub: (() => void) | null
  subscriptionInitialized: boolean
}

// Map<chatId, SessionState> — each chatId has independent state
const sessionStates = new Map<string, SessionState>()

function getStorageKey(chatId: string): string {
  return `ai-chat:${chatId}:selected-conversation-id`
}

function getOrCreateState(chatId: string): SessionState {
  const existing = sessionStates.get(chatId)
  if (existing) return existing

  const state: SessionState = {
    currentConversationId: ref<string | null>(null),
    currentMessages: ref<ChatMessage[]>([]) as Ref<ChatMessage[]>,
    messagesUnsub: null,
    subscriptionInitialized: false,
  }

  // Restore persisted selection
  try {
    const saved = localStorage.getItem(getStorageKey(chatId))
    if (saved) state.currentConversationId.value = saved
  } catch {}

  sessionStates.set(chatId, state)
  return state
}

/** Reset all session state (for testing) */
export function _resetSessionState() {
  for (const state of sessionStates.values()) {
    state.messagesUnsub?.()
  }
  sessionStates.clear()
  try {
    // Clean up all ai-chat:* localStorage keys
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('ai-chat:') && key.endsWith(':selected-conversation-id')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch {}
}

function persistConversationId(chatId: string, id: string | null): void {
  try {
    if (id) localStorage.setItem(getStorageKey(chatId), id)
    else localStorage.removeItem(getStorageKey(chatId))
  } catch {}
}

function ensureSubscription(chatId: string, state: SessionState, messageService: MessageService) {
  if (state.subscriptionInitialized) return
  state.subscriptionInitialized = true

  watch(state.currentConversationId, (id) => {
    state.messagesUnsub?.()
    if (!id) {
      state.currentMessages.value = []
      return
    }
    const observable = liveQuery(() => messageService.getByConversationId(id))
    const sub = observable.subscribe({
      next: (val) => { state.currentMessages.value = val }
    })
    state.messagesUnsub = () => sub.unsubscribe()
  }, { immediate: true })
}

export function useSession(chatId = 'default') {
  const conversationService = new ConversationService()
  const messageService = new MessageService()

  const state = getOrCreateState(chatId)

  const conversations = useObservable<Conversation[]>(() =>
    conversationService.getAll(chatId)
  )

  const currentConversation = computed(() =>
    conversations.value?.find((c) => c.id === state.currentConversationId.value)
  )

  // Validate persisted selection against loaded conversations
  watch(conversations, (loaded) => {
    if (state.currentConversationId.value && loaded && loaded.length > 0) {
      const exists = loaded.some((c) => c.id === state.currentConversationId.value)
      if (!exists) {
        // Saved conversation no longer exists — fall back to first available
        const firstId = loaded[0].id
        state.currentConversationId.value = firstId
        persistConversationId(chatId, firstId)
      }
    }
  })

  ensureSubscription(chatId, state, messageService)

  async function createConversation(agentId: string, modelId: string): Promise<Conversation> {
    const list = conversations.value ?? []
    const emptyConv = list.find(c => !c.messageCount)
    if (emptyConv) {
      state.currentConversationId.value = emptyConv.id
      persistConversationId(chatId, emptyConv.id)
      return emptyConv
    }

    const conv = await conversationService.create({
      title: 'New Chat',
      chatId,
      agentId,
      modelId,
    })
    state.currentConversationId.value = conv.id
    persistConversationId(chatId, conv.id)
    return conv
  }

  async function deleteConversation(id: string): Promise<void> {
    await conversationService.delete(id)
    if (state.currentConversationId.value === id) {
      const remaining = await conversationService.getAll(chatId)
      const nextId = remaining.length > 0 ? remaining[0].id : null
      state.currentConversationId.value = nextId
      persistConversationId(chatId, nextId)
    }
  }

  async function clearAllConversations(): Promise<void> {
    await conversationService.deleteAll(chatId)
    state.currentConversationId.value = null
    persistConversationId(chatId, null)
  }

  async function renameConversation(id: string, title: string): Promise<void> {
    await conversationService.update(id, { title })
  }

  function switchConversation(id: string): void {
    state.currentConversationId.value = id
    persistConversationId(chatId, id)
  }

  return {
    conversations,
    currentConversationId: state.currentConversationId,
    currentConversation,
    currentMessages: state.currentMessages,
    createConversation,
    deleteConversation,
    clearAllConversations,
    renameConversation,
    switchConversation,
  }
}
