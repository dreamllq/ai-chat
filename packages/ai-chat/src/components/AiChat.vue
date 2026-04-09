<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import AiChatProvider from './AiChatProvider.vue'
import LayoutShell from './LayoutShell.vue'
import Sidebar from './Sidebar.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'
import { useChat } from '../composables/useChat'
import { useSession } from '../composables/useSession'
import { useModel } from '../composables/useModel'
import { useAgent } from '../composables/useAgent'
import { ConversationService } from '../services/database'
import { agentRegistry } from '../services/agent'
import type { AiChatLocale, LocaleName } from '../locales'
import type { FileUploadService, Conversation, MessageAttachment, ModelConfig } from '../types'

const props = withDefaults(defineProps<{
  locale?: AiChatLocale | LocaleName
  fileUploadService?: FileUploadService | null
  defaultSidebarCollapsed?: boolean
  sidebarCollapsed?: boolean
  showAgentSelector?: boolean
  defaultAgentId?: string
  showModelSelector?: boolean
  defaultModelId?: string
  models?: ModelConfig[]
}>(), {
  locale: 'en',
  fileUploadService: null,
  defaultSidebarCollapsed: false,
  sidebarCollapsed: undefined,
  showAgentSelector: true,
  defaultAgentId: undefined,
  showModelSelector: true,
  defaultModelId: undefined,
  models: undefined,
})

const emit = defineEmits<{
  'update:sidebarCollapsed': [value: boolean]
}>()

const internalSidebarCollapsed = ref(props.defaultSidebarCollapsed)

function handleSidebarCollapsedUpdate(value: boolean) {
  internalSidebarCollapsed.value = value
  emit('update:sidebarCollapsed', value)
}

const sidebarCollapsed = computed(() =>
  props.sidebarCollapsed !== undefined ? props.sidebarCollapsed : internalSidebarCollapsed.value
)

const { isStreaming, sendMessage, stopStreaming } = useChat()
const { currentConversation, currentConversationId, currentMessages, createConversation } = useSession()
const { models, currentModelId, selectModel, initDefault } = useModel()
const { agents, currentAgentId, selectAgent, initDefault: initDefaultAgent } = useAgent()

const conversationService = new ConversationService()

const modelIdForSidebar = computed(() => currentModelId.value ?? undefined)

const isNewChatDisabled = computed(() => {
  if (!currentConversationId.value) return false
  return currentConversation.value ? !currentConversation.value.messageCount : false
})

function handleNewChat() {
  createConversation(currentAgentId.value ?? '', currentModelId.value ?? '')
}

/** Switch agent — persist the current conversation's agentId to DB */
async function handleAgentChange(agentId: string) {
  selectAgent(agentId)
  if (currentConversationId.value) {
    await conversationService.update(currentConversationId.value, { agentId })
  }
}

/** Switch model — persist the current conversation's modelId to DB */
async function handleModelChange(modelId: string) {
  selectModel(modelId)
  if (currentConversationId.value) {
    await conversationService.update(currentConversationId.value, { modelId })
  }
}

/**
 * When the active conversation changes, sync global agent/model selection
 * from the conversation's stored values. If the bound agent/model no longer
 * exists, fall back to the first available and update the conversation.
 */
watch(currentConversation, async (conv: Conversation | undefined) => {
  if (!conv) return

  const loadedAgents = agents.value ?? []
  const loadedModels = models.value ?? []

  // Wait for data to be loaded
  if (loadedAgents.length === 0 || loadedModels.length === 0) return

  // Resolve agent — fallback to first available (builtin)
  const agentExists = loadedAgents.some(a => a.id === conv.agentId)
  const validAgentId = agentExists ? conv.agentId : loadedAgents[0].id

  // Resolve model — fallback to first available (builtin)
  const modelExists = loadedModels.some(m => m.id === conv.modelId)
  const validModelId = modelExists ? conv.modelId : loadedModels[0].id

  // Persist fallback values to conversation if needed
  const updates: Partial<Conversation> = {}
  if (!agentExists) updates.agentId = validAgentId
  if (!modelExists) updates.modelId = validModelId
  if (Object.keys(updates).length > 0) {
    await conversationService.update(conv.id, updates)
  }

  // Sync global state from conversation
  selectAgent(validAgentId)
  if (validModelId) selectModel(validModelId)
})

onMounted(() => {
  initDefault({
    defaultModelId: props.defaultModelId,
    showModelSelector: props.showModelSelector,
    models: props.models,
  })
  initDefaultAgent({ defaultAgentId: props.defaultAgentId, showAgentSelector: props.showAgentSelector })
})

async function handleSend(payload: { content: string; attachments?: MessageAttachment[] }) {
  console.log('[AiChat] handleSend called', {
    content: payload.content,
    hasConversation: !!currentConversationId.value,
    agentId: currentAgentId.value,
    modelId: currentModelId.value,
  })

  // Auto-create conversation if none is active
  if (!currentConversationId.value) {
    const agentId = currentAgentId.value
    const modelId = currentModelId.value
    if (agentId && modelId) {
      console.log('[AiChat] auto-creating conversation', { agentId, modelId })
      await createConversation(agentId, modelId)
    } else {
      console.warn('[AiChat] cannot auto-create: missing agentId or modelId', { agentId, modelId })
      return
    }
  }

  sendMessage(payload.content, payload.attachments)
}
</script>

<template>
  <AiChatProvider :locale="props.locale">
    <div class="ai-chat">
      <LayoutShell :sidebar-collapsed="sidebarCollapsed" :new-chat-disabled="isNewChatDisabled" @update:sidebar-collapsed="handleSidebarCollapsedUpdate" @new-chat="handleNewChat">
        <template #sidebar>
          <Sidebar :agent-id="currentAgentId" :model-id="modelIdForSidebar" />
        </template>
        <template #messages>
          <ChatMessageList v-if="currentMessages.length > 0" />
          <div v-else class="ai-chat__empty">
            <slot name="empty" />
          </div>
        </template>
        <template #input>
          <ChatInput
            :current-agent-id="currentAgentId"
            :is-streaming="isStreaming"
            :file-upload-service="props.fileUploadService"
            :show-agent-selector="props.showAgentSelector"
            :show-model-selector="props.showModelSelector"
            @update:current-agent-id="handleAgentChange"
            @update:current-model-id="handleModelChange"
            @send="handleSend"
            @stop="stopStreaming"
          />
        </template>
      </LayoutShell>
    </div>
  </AiChatProvider>
</template>

<style scoped>
.ai-chat {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.ai-chat__empty {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
