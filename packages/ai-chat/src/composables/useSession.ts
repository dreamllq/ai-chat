import { ref, computed, watch, type Ref } from 'vue'
import { liveQuery, ConversationService, MessageService } from '../services/database'
import { useObservable } from './useObservable'
import type { Conversation, ChatMessage } from '../types'

const STORAGE_KEY = 'ai-chat:selected-conversation-id'

// Module-level singleton state — shared across all useSession() callers
const currentConversationId = ref<string | null>(null)
const currentMessages: Ref<ChatMessage[]> = ref<ChatMessage[]>([]) as Ref<ChatMessage[]>

// Restore persisted selection on module load
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) currentConversationId.value = saved
} catch {}

let messagesUnsub: (() => void) | null = null
let subscriptionInitialized = false

/** Reset singleton state (for testing) */
export function _resetSessionState() {
  currentConversationId.value = null
  currentMessages.value = []
  messagesUnsub?.()
  messagesUnsub = null
  subscriptionInitialized = false
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function ensureSubscription(messageService: MessageService) {
  if (subscriptionInitialized) return
  subscriptionInitialized = true

  watch(currentConversationId, (id) => {
    messagesUnsub?.()
    if (!id) {
      currentMessages.value = []
      return
    }
    const observable = liveQuery(() => messageService.getByConversationId(id))
    const sub = observable.subscribe({
      next: (val) => { currentMessages.value = val }
    })
    messagesUnsub = () => sub.unsubscribe()
  }, { immediate: true })
}

export function useSession() {
  const conversationService = new ConversationService()
  const messageService = new MessageService()

  const conversations = useObservable<Conversation[]>(() =>
    conversationService.getAll()
  )

  const currentConversation = computed(() =>
    conversations.value?.find((c) => c.id === currentConversationId.value)
  )

  // Validate persisted selection against loaded conversations
  watch(conversations, (loaded) => {
    if (currentConversationId.value && loaded && loaded.length > 0) {
      const exists = loaded.some((c) => c.id === currentConversationId.value)
      if (!exists) {
        // Saved conversation no longer exists — fall back to first available
        const firstId = loaded[0].id
        currentConversationId.value = firstId
        try {
          localStorage.setItem(STORAGE_KEY, firstId)
        } catch {}
      }
    }
  })

  ensureSubscription(messageService)

  async function createConversation(agentId: string, modelId: string): Promise<Conversation> {
    const conv = await conversationService.create({
      title: 'New Chat',
      agentId,
      modelId,
    })
    currentConversationId.value = conv.id
    try {
      localStorage.setItem(STORAGE_KEY, conv.id)
    } catch {}
    return conv
  }

  async function deleteConversation(id: string): Promise<void> {
    await conversationService.delete(id)
    if (currentConversationId.value === id) {
      const remaining = await conversationService.getAll()
      const nextId = remaining.length > 0 ? remaining[0].id : null
      currentConversationId.value = nextId
      try {
        if (nextId) localStorage.setItem(STORAGE_KEY, nextId)
        else localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
  }

  async function clearAllConversations(): Promise<void> {
    await conversationService.deleteAll()
    currentConversationId.value = null
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  async function renameConversation(id: string, title: string): Promise<void> {
    await conversationService.update(id, { title })
  }

  function switchConversation(id: string): void {
    currentConversationId.value = id
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {}
  }

  return {
    conversations,
    currentConversationId,
    currentConversation,
    currentMessages,
    createConversation,
    deleteConversation,
    clearAllConversations,
    renameConversation,
    switchConversation,
  }
}
