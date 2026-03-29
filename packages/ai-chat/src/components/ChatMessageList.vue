<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useChat } from '../composables/useChat'
import ChatMessage from './ChatMessage.vue'

const { currentMessages, isStreaming } = useChat()

const listRef = ref<HTMLElement | null>(null)

watch(
  () => currentMessages.value.map((m) => m.id + m.content + m.isStreaming),
  async () => {
    await nextTick()
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight - listRef.value.clientHeight
    }
  },
)
</script>

<template>
  <div ref="listRef" class="chat-message-list">
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
</style>
