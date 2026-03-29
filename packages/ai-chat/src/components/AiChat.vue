<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AiChatProvider from './AiChatProvider.vue'
import LayoutShell from './LayoutShell.vue'
import Sidebar from './Sidebar.vue'
import AgentSelector from './AgentSelector.vue'
import ModelSelector from './ModelSelector.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'
import { useChat } from '../composables/useChat'
import { useSession } from '../composables/useSession'
import { useModel } from '../composables/useModel'
import type { AiChatLocale, LocaleName } from '../locales'
import type { FileUploadService } from '../types'

const props = withDefaults(defineProps<{
  locale?: AiChatLocale | LocaleName
  fileUploadService?: FileUploadService | null
}>(), {
  locale: 'en',
  fileUploadService: null,
})

const sidebarCollapsed = ref(false)
const currentAgentId = ref('langchain-chat')

const { isStreaming, sendMessage, stopStreaming } = useChat()
const { currentConversationId, createConversation } = useSession()
const { currentModelId, initDefault } = useModel()

const modelIdForSidebar = computed(() => currentModelId.value ?? undefined)

onMounted(() => {
  initDefault()
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

  sendMessage(payload.content, payload.files)
}
</script>

<template>
  <AiChatProvider :locale="props.locale">
    <div class="ai-chat">
      <LayoutShell v-model:sidebar-collapsed="sidebarCollapsed">
        <template #sidebar>
          <Sidebar :agent-id="currentAgentId" :model-id="modelIdForSidebar" />
        </template>
        <template #header>
          <AgentSelector v-model="currentAgentId" />
          <ModelSelector />
        </template>
        <template #messages>
          <ChatMessageList />
        </template>
        <template #input>
          <ChatInput
            :is-streaming="isStreaming"
            :file-upload-service="props.fileUploadService"
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
