<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElButton, ElIcon, ElInput, ElPopconfirm } from 'element-plus'
import { useSession } from '../composables/useSession'
import { useLocale } from '../composables/useLocale'
import type { Conversation } from '../types'

const props = defineProps<{
  agentId?: string
  modelId?: string
}>()

const { conversations, currentConversationId, createConversation, deleteConversation, renameConversation, switchConversation } = useSession()
const { t } = useLocale()

const conversationList = computed(() => conversations.value ?? [])

const editingId = ref<string | null>(null)
const editingTitle = ref('')

function handleNewChat() {
  createConversation(props.agentId ?? '', props.modelId ?? '')
}

function startRename(conv: Conversation) {
  editingId.value = conv.id
  editingTitle.value = conv.title
}

function confirmRename(id: string) {
  if (editingTitle.value.trim()) {
    renameConversation(id, editingTitle.value.trim())
  }
  editingId.value = null
  editingTitle.value = ''
}

function cancelRename() {
  editingId.value = null
  editingTitle.value = ''
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`
  }
  return String(tokens)
}
</script>

<template>
  <div class="ai-chat-sidebar">
    <div class="ai-chat-sidebar__header">
      <ElButton class="ai-chat-sidebar__new-chat" type="primary" @click="handleNewChat">
        <ElIcon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></ElIcon>
        {{ t('conversation.newChat') }}
      </ElButton>
    </div>

    <div v-if="conversationList.length === 0" class="ai-chat-sidebar__empty">
      <p>{{ t('conversation.empty') }}</p>
      <ElButton class="ai-chat-sidebar__new-chat" type="primary" @click="handleNewChat">
        {{ t('conversation.newChat') }}
      </ElButton>
    </div>

    <div v-else class="ai-chat-sidebar__list">
      <div
        v-for="conv in conversationList"
        :key="conv.id"
        class="ai-chat-sidebar__item"
        :class="{ 'ai-chat-sidebar__item--active': currentConversationId === conv.id }"
        @click="switchConversation(conv.id)"
        @dblclick="startRename(conv)"
      >
        <div v-if="editingId === conv.id" class="ai-chat-sidebar__item-edit">
          <ElInput
            v-model="editingTitle"
            size="small"
            @keyup.enter="confirmRename(conv.id)"
            @blur="confirmRename(conv.id)"
          />
        </div>
        <div v-else class="ai-chat-sidebar__item-content">
          <span class="ai-chat-sidebar__item-title">{{ conv.title }}</span>
          <div class="ai-chat-sidebar__item-meta">
            <span class="ai-chat-sidebar__item-time">{{ formatTime(conv.updatedAt) }}</span>
            <span v-if="conv.totalTokens" class="ai-chat-sidebar__item-tokens">{{ formatTokenCount(conv.totalTokens) }} tokens</span>
          </div>
        </div>
        <div class="ai-chat-sidebar__item-actions">
          <ElPopconfirm
            :title="t('conversation.deleteConfirm')"
            @confirm="deleteConversation(conv.id)"
          >
            <template #reference>
              <ElButton
                class="ai-chat-sidebar__item-delete"
                text
                size="small"
                @click.stop
              >
                <ElIcon :size="14"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></ElIcon>
              </ElButton>
            </template>
          </ElPopconfirm>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-chat-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.ai-chat-sidebar__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: var(--ai-chat-header-height, 44px);
  padding: 0 12px;
  border-bottom: 1px solid var(--ai-chat-border-color, #e5e5e5);
}

.ai-chat-sidebar__new-chat {
  width: 100%;
}

.ai-chat-sidebar__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  padding: 24px;
  color: var(--ai-chat-text-secondary, #999);
  font-size: 14px;
}

.ai-chat-sidebar__list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  background-color: var(--ai-chat-sidebar-bg, #f7f7f8);
}

.ai-chat-sidebar__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 6px;
  margin: 2px 8px;
  transition: background-color 0.15s ease;
}

.ai-chat-sidebar__item:hover {
  background-color: var(--ai-chat-hover-bg, rgba(0, 0, 0, 0.04));
}

.ai-chat-sidebar__item--active {
  background-color: var(--ai-chat-active-bg, rgba(0, 0, 0, 0.08));
}

.ai-chat-sidebar__item-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.ai-chat-sidebar__item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-chat-sidebar__item-title {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-sidebar__item-time {
  font-size: 12px;
  color: var(--ai-chat-text-secondary, #999);
}

.ai-chat-sidebar__item-tokens {
  font-size: 10px;
  color: var(--ai-chat-text-secondary, #999);
  background: var(--ai-chat-hover-bg, rgba(0, 0, 0, 0.04));
  padding: 1px 5px;
  border-radius: 8px;
}

.ai-chat-sidebar__item-edit {
  flex: 1;
  min-width: 0;
}

.ai-chat-sidebar__item-actions {
  flex-shrink: 0;
  margin-left: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ai-chat-sidebar__item:hover .ai-chat-sidebar__item-actions {
  opacity: 1;
}

.ai-chat-sidebar__item-delete {
  padding: 4px;
}
</style>
