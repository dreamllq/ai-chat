<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  AiChat,
  registerAgent,
} from '@ai-chat/vue'
import type {
  AgentDefinition,
  AgentRunner,
  ChatMessage,
  ModelConfig,
  ChatOptions,
  ChatChunk,
  LocaleName,
} from '@ai-chat/vue'

// ---------------------------------------------------------------------------
// Mock Agent — streams back an echo of whatever the user sends
// ---------------------------------------------------------------------------

const mockAgentDef: AgentDefinition = {
  id: 'demo-mock',
  name: 'Demo Agent',
  description: 'A mock agent for demonstration — echoes your message back',
}

const mockAgentRunner: AgentRunner = {
  async *chat(
    messages: ChatMessage[],
    _model: ModelConfig,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    const lastMessage = messages[messages.length - 1]
    const text =
      lastMessage?.content ?? ''

    const response = [
      `You said: _"${text}"_`,
      '',
      'This is a **mock response** from the demo agent.',
      'In production you would register a real LangChain or OpenAI agent instead.',
      '',
      '---',
      '',
      'Try switching locales with the buttons in the header, or creating a new conversation in the sidebar.',
    ].join('\n')

    // Simulate token-by-token streaming
    const chars = [...response]
    let buffer = ''
    for (let i = 0; i < chars.length; i++) {
      if (options?.signal?.aborted) return
      buffer += chars[i]
      // Yield in small bursts for a realistic feel
      if (buffer.length >= 3 || i === chars.length - 1) {
        yield { type: 'token', content: buffer }
        buffer = ''
        await new Promise<void>((r) => setTimeout(r, 18))
      }
    }
    yield { type: 'done' }
  },
}

// ---------------------------------------------------------------------------
// Locale state
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ai-chat-locale'

const localeLabels: { key: LocaleName; label: string }[] = [
  { key: 'zh-cn', label: '中文' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
]

function getPersistedLocale(): LocaleName {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && ['zh-cn', 'en', 'ja'].includes(saved)) {
      return saved as LocaleName
    }
  } catch { /* localStorage unavailable */ }
  return 'en'
}

const currentLocale = ref<LocaleName>(getPersistedLocale())

function switchLocale(name: LocaleName) {
  currentLocale.value = name
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch { /* localStorage unavailable */ }
}

// ---------------------------------------------------------------------------
// Register mock agent on mount
// ---------------------------------------------------------------------------

onMounted(() => {
  registerAgent(mockAgentDef, mockAgentRunner)
})
</script>

<template>
  <div class="demo-root">
    <!-- ── Header ──────────────────────────────────────────────────── -->
    <header class="demo-header">
      <div class="header-left">
        <span class="header-logo">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="logo-icon"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <h1 class="header-title">AI Chat</h1>
        <span class="header-badge">Demo</span>
      </div>

      <div class="header-right">
        <div class="locale-switcher">
          <button
            v-for="item in localeLabels"
            :key="item.key"
            :class="['locale-btn', { active: currentLocale === item.key }]"
            @click="switchLocale(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </header>

    <!-- ── Chat area ───────────────────────────────────────────────── -->
    <main class="demo-main">
      <AiChat :locale="currentLocale" />
    </main>
  </div>
</template>

<style>
/* ── Global resets ─────────────────────────────────────────────────── */
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>

<style scoped>
/* ── Root container ────────────────────────────────────────────────── */
.demo-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: #f2f2f5;
  font-family: 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
    sans-serif;
}

/* ── Header ────────────────────────────────────────────────────────── */
.demo-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 20px;
  background: #ffffff;
  border-bottom: 1px solid #e8e8ec;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
}

.logo-icon {
  width: 18px;
  height: 18px;
}

.header-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #1a1a2e;
  letter-spacing: -0.01em;
}

.header-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f0eefe;
  color: #6366f1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ── Locale switcher ───────────────────────────────────────────────── */
.locale-switcher {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e2e8;
  background: #fafafa;
}

.locale-btn {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.locale-btn:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 20%;
  height: 60%;
  width: 1px;
  background: #e2e2e8;
}

.locale-btn:hover {
  color: #333;
  background: #f0f0f4;
}

.locale-btn.active {
  background: #6366f1;
  color: #fff;
}

.locale-btn.active::after {
  display: none;
}

/* ── Main chat area ────────────────────────────────────────────────── */
.demo-main {
  flex: 1;
  overflow: hidden;
}
</style>
