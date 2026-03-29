<script setup lang="ts">
import { computed } from 'vue'
import { ElButton, ElIcon } from 'element-plus'

const props = withDefaults(defineProps<{
  sidebarCollapsed?: boolean
}>(), {
  sidebarCollapsed: false,
})

const emit = defineEmits<{
  'update:sidebarCollapsed': [value: boolean]
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
          <ElIcon :size="20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line v-if="!sidebarCollapsed" x1="3" y1="12" x2="21" y2="12" />
              <line v-if="!sidebarCollapsed" x1="3" y1="6" x2="21" y2="6" />
              <line v-if="!sidebarCollapsed" x1="3" y1="18" x2="21" y2="18" />
              <line v-if="sidebarCollapsed" x1="3" y1="12" x2="21" y2="12" />
              <line v-if="sidebarCollapsed" x1="3" y1="6" x2="21" y2="6" />
              <polyline v-if="sidebarCollapsed" points="9 6 15 12 9 18" />
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
  --ai-chat-border-color: var(--ai-chat-border-color, #e5e5e5);
  --ai-chat-header-height: var(--ai-chat-header-height, 44px);
  --ai-chat-input-padding: var(--ai-chat-input-padding, 16px);
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
  gap: 8px;
  height: var(--ai-chat-header-height);
  min-height: var(--ai-chat-header-height);
  padding: 0 12px;
  border-bottom: 1px solid var(--ai-chat-border-color);
}

.ai-chat-sidebar-toggle {
  flex-shrink: 0;
  cursor: pointer;
}

.ai-chat-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.ai-chat-input {
  flex-shrink: 0;
  padding: var(--ai-chat-input-padding);
}
</style>
