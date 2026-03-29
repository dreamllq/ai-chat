import { ref, computed, watch, type Ref } from 'vue'
import { liveQuery, ConversationService, MessageService } from '../services/database'
import { useObservable } from './useObservable'
import type { Conversation, ChatMessage } from '../types'

// Module-level singleton state — shared across all useSession() callers
const currentConversationId = ref<string | null>(null)
const currentMessages: Ref<ChatMessage[]> = ref<ChatMessage[]>([]) as Ref<ChatMessage[]>

let messagesUnsub: (() => void) | null = null
let subscriptionInitialized = false

/** Reset singleton state (for testing) */
export function _resetSessionState() {
  currentConversationId.value = null
  currentMessages.value = []
  messagesUnsub?.()
  messagesUnsub = null
  subscriptionInitialized = false
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

  ensureSubscription(messageService)

  async function createConversation(agentId: string, modelId: string): Promise<Conversation> {
    const conv = await conversationService.create({
      title: 'New Chat',
      agentId,
      modelId,
    })
    currentConversationId.value = conv.id
    return conv
  }

  async function deleteConversation(id: string): Promise<void> {
    await conversationService.delete(id)
    if (currentConversationId.value === id) {
      const remaining = await conversationService.getAll()
      currentConversationId.value = remaining.length > 0 ? remaining[0].id : null
    }
  }

  async function renameConversation(id: string, title: string): Promise<void> {
    await conversationService.update(id, { title })
  }

  function switchConversation(id: string): void {
    currentConversationId.value = id
  }

  return {
    conversations,
    currentConversationId,
    currentConversation,
    currentMessages,
    createConversation,
    deleteConversation,
    renameConversation,
    switchConversation,
  }
}
