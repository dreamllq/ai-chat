<script setup lang="ts">
import { computed } from 'vue'
import { ElButton, ElIcon } from 'element-plus'

const props = withDefaults(defineProps<{
  sidebarCollapsed?: boolean
  newChatDisabled?: boolean
}>(), {
  sidebarCollapsed: false,
  newChatDisabled: false,
})

const emit = defineEmits<{
  'update:sidebarCollapsed': [value: boolean]
  'newChat': []
}>()

const sidebarWidth = computed(() =>
  props.sidebarCollapsed ? '0px' : 'var(--ai-chat-sidebar-width, 260px)'
)

function toggleSidebar() {
  emit('update:sidebarCollapsed', !props.sidebarCollapsed)
}
</script>

<template>
  <div class="ai-chat-layout">
    <aside
      class="ai-chat-sidebar"
      :class="{ 'ai-chat-sidebar--collapsed': sidebarCollapsed }"
      :style="{ width: sidebarWidth }"
    >
      <div class="ai-chat-sidebar__inner">
        <slot name="sidebar" />
      </div>
    </aside>

    <div class="ai-chat-main">
      <header class="ai-chat-header">
        <ElButton
          class="ai-chat-sidebar-toggle"
          :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          text
          @click="toggleSidebar"
        >
          <ElIcon :size="18">
            <svg v-if="!sidebarCollapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <polyline points="14 9 17 12 14 15" />
            </svg>
          </ElIcon>
        </ElButton>
        <ElButton
          v-if="sidebarCollapsed && !newChatDisabled"
          class="ai-chat-sidebar-new-chat-collapsed"
          text
          @click="emit('newChat')"
        >
          <ElIcon :size="18">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </ElIcon>
        </ElButton>
        <slot name="header" />
      </header>

      <main class="ai-chat-messages">
        <slot name="messages" />
      </main>

      <footer class="ai-chat-input">
        <slot name="input" />
      </footer>
    </div>
  </div>
</template>

<style scoped>
.ai-chat-layout {
  --ai-chat-sidebar-width: 260px;
  --ai-chat-bg: var(--ai-chat-bg, #ffffff);
  --ai-chat-sidebar-bg: var(--ai-chat-sidebar-bg, #f7f7f8);
  --ai-chat-border-color: #e5e5e5;
  --ai-chat-header-height: 44px;
  --ai-chat-input-padding: 16px;
  --ai-chat-transition: 0.3s ease;

  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--ai-chat-bg);
}

.ai-chat-sidebar {
  flex-shrink: 0;
  height: 100%;
  background-color: var(--ai-chat-sidebar-bg);
  border-right: 1px solid var(--ai-chat-border-color);
  transition: width var(--ai-chat-transition);
  overflow: hidden;
}

.ai-chat-sidebar--collapsed {
  border-right-width: 0;
}

.ai-chat-sidebar__inner {
  width: var(--ai-chat-sidebar-width, 260px);
  height: 100%;
  overflow-y: auto;
}

.ai-chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.ai-chat-header {
  display: flex;
  align-items: center;
  gap: 4px;
  height: var(--ai-chat-header-height);
  min-height: var(--ai-chat-header-height);
  padding: 0 12px;
  border-bottom: 1px solid var(--ai-chat-border-color);
  background-color: var(--ai-chat-bg);
}

.ai-chat-sidebar-toggle {
  flex-shrink: 0;
  padding: 4px;
  margin-left: 0;
  cursor: pointer;
}

.ai-chat-sidebar-new-chat-collapsed {
  flex-shrink: 0;
  padding: 4px;
  margin-left: 0;
  cursor: pointer;
}

.ai-chat-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 0 16px;
  background-color: var(--ai-chat-bg);
}

.ai-chat-input {
  flex-shrink: 0;
  padding: var(--ai-chat-input-padding) 16px;
  background-color: var(--ai-chat-bg);
}
</style>
