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
import type { FileUploadService, Conversation } from '../types'

const props = withDefaults(defineProps<{
  locale?: AiChatLocale | LocaleName
  fileUploadService?: FileUploadService | null
}>(), {
  locale: 'en',
  fileUploadService: null,
})

const sidebarCollapsed = ref(false)

const { isStreaming, sendMessage, stopStreaming } = useChat()
const { currentConversation, currentConversationId, createConversation } = useSession()
const { models, currentModelId, selectModel, initDefault, initBuiltins } = useModel()
const { agents, currentAgentId, selectAgent, initDefault: initDefaultAgent } = useAgent()

const conversationService = new ConversationService()

const modelIdForSidebar = computed(() => currentModelId.value ?? undefined)

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
  initBuiltins().then(() => {
    initDefault()
    initDefaultAgent()
  })
})

async function handleSend(payload: { content: string; files?: File[] }) {
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

  sendMessage(payload.content, payload.files, props.fileUploadService)
}
</script>

<template>
  <AiChatProvider :locale="props.locale">
    <div class="ai-chat">
      <LayoutShell v-model:sidebar-collapsed="sidebarCollapsed">
        <template #sidebar>
          <Sidebar :agent-id="currentAgentId" :model-id="modelIdForSidebar" />
        </template>
        <template #messages>
          <ChatMessageList />
        </template>
        <template #input>
          <ChatInput
            :current-agent-id="currentAgentId"
            :is-streaming="isStreaming"
            :file-upload-service="props.fileUploadService"
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
</style>
