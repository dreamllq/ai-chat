<script setup lang="ts">
import { ref } from 'vue'
import { AiChat, registerAgent } from '@ai-chat/vue'
import type { LocaleName } from '@ai-chat/vue'
import { S3StorageService } from '@ai-chat/storage-s3'
import type { S3StorageConfig } from '@ai-chat/storage-s3'

// ---------------------------------------------------------------------------
// Custom Agents — 从独立文件导入，调用 registerAgent() 注册
// ---------------------------------------------------------------------------
import { llmToolAgentDef } from './agents/llm-tool-agent'
import { formSchemaAgentDef } from './agents/form-schema-agent'
import { skillAgentDef } from './agents/skill-agent'
import { mcpAgentDef } from './agents/mcp-agent'

// 在模块顶层同步注册（先于组件渲染），确保下拉框能立即列出
registerAgent(llmToolAgentDef)
registerAgent(formSchemaAgentDef)
registerAgent(skillAgentDef)
registerAgent(mcpAgentDef)

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
// Locale state
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// S3 File Upload Service
// ---------------------------------------------------------------------------

const s3Config: S3StorageConfig = {
  endpoint: import.meta.env.VITE_S3_ENDPOINT ?? '',
  region: import.meta.env.VITE_S3_REGION ?? '',
  bucket: import.meta.env.VITE_S3_BUCKET ?? '',
  accessKeyId: import.meta.env.VITE_S3_ACCESS_KEY_ID ?? '',
  secretAccessKey: import.meta.env.VITE_S3_SECRET_ACCESS_KEY ?? '',
  forcePathStyle: import.meta.env.VITE_S3_FORCE_PATH_STYLE === 'true',
}

const fileUploadService = s3Config.region
  ? new S3StorageService(s3Config)
  : null
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
      <AiChat :locale="currentLocale" :file-upload-service="fileUploadService">
        <template #empty>
          <div class="empty-state">
            <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h2 class="empty-state__title">Start a conversation</h2>
            <p class="empty-state__desc">Type a message below to begin chatting with AI</p>
          </div>
        </template>
      </AiChat>
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

/* ── Empty state ──────────────────────────────────────────────────── */
.empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #999;
  user-select: none;
}

.empty-state__icon {
  width: 48px;
  height: 48px;
  color: #c5c5cc;
}

.empty-state__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #666;
}

.empty-state__desc {
  margin: 0;
  font-size: 14px;
  color: #999;
}
</style>
