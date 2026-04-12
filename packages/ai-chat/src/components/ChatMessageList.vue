<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChat } from '../composables/useChat'
import { useSession } from '../composables/useSession'
import { useSize } from '../size'
import ChatMessage from './ChatMessage.vue'

const { currentMessages, isStreaming } = useChat()
const { currentConversationId } = useSession()
const size = useSize()

const listClasses = computed(() => ({ 'chat-message-list--mini': size.value === 'mini' }))

const listRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  requestAnimationFrame(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight - listRef.value.clientHeight
    }
  })
}

// Auto-scroll on message content/streaming changes
watch(
  () => currentMessages.value.map((m) => m.id + m.content + m.isStreaming),
  () => {
    // Use nextTick + requestAnimationFrame to wait for child component
    // DOM updates (e.g. markdown rendering, copy buttons) to complete
    nextTick(() => requestAnimationFrame(() => scrollToBottom()))
  },
  { flush: 'post' },
)

// Scroll to bottom when switching conversation
watch(currentConversationId, () => {
  nextTick(() => requestAnimationFrame(() => scrollToBottom()))
})

// Scroll to bottom on initial mount (handles page refresh where
// messages are loaded asynchronously via liveQuery after mount)
onMounted(() => {
  nextTick(() => requestAnimationFrame(() => scrollToBottom()))
})
</script>

<template>
  <div ref="listRef" :class="['chat-message-list', listClasses]">
    <ChatMessage
      v-for="message in currentMessages"
      :key="message.id"
      :message="message"
    />
  </div>
</template>

<style scoped>
.chat-message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
}

.chat-message-list--mini {
  padding: 12px 0;
}
</style>
