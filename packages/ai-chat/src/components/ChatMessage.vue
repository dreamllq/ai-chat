<script setup lang="ts">
import { computed, nextTick, onMounted, onUpdated, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import type { ChatMessage as ChatMessageType } from '../types'
import { isMessageAttachment, isLegacyFileMetadata } from '../types'
import type { MessageAttachment } from '../types'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  message: ChatMessageType
}>()

const { t } = useLocale()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    let highlighted: string
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(str, { language: lang }).value
      } catch {
        highlighted = md.utils.escapeHtml(str)
      }
    } else {
      highlighted = md.utils.escapeHtml(str)
    }
    const langLabel = lang ? `<span class="code-block-header__lang">${md.utils.escapeHtml(lang)}</span>` : ''
    return `<span class="code-block-header">${langLabel}</span><span class="code-block-body">${highlighted}</span>`
  },
})

const renderedContent = computed(() => md.render(props.message.content))

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isSystem = computed(() => props.message.role === 'system')

// Relative time display
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

const relativeTime = computed(() => {
  const now = Date.now()
  const diff = now - props.message.timestamp
  if (diff < 0) return t('timeAgo.justNow')

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const dayMs = 24 * 60 * 60 * 1000

  if (seconds < 60) return t('timeAgo.justNow')
  if (minutes < 60) return t('timeAgo.minutesAgo', { n: `${minutes}` })
  if (hours < 24) return t('timeAgo.hoursAgo', { n: `${hours}` })

  const msgDate = new Date(props.message.timestamp)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart.getTime() - dayMs)

  if (msgDate >= yesterdayStart) return t('timeAgo.yesterday')

  const month = `${msgDate.getMonth() + 1}`
  const day = `${msgDate.getDate()}`
  const h = pad(msgDate.getHours())
  const m = pad(msgDate.getMinutes())
  return t('timeAgo.dateFormat', { month, day, hours: h, minutes: m })
})
const showStreamingCursor = computed(
  () => props.message.role === 'assistant' && props.message.isStreaming === true,
)

// Reasoning / Thinking
const hasReasoning = computed(
  () => !!props.message.reasoningContent && props.message.role === 'assistant',
)
const renderedReasoning = computed(() => {
  if (!props.message.reasoningContent) return ''
  return md.render(props.message.reasoningContent)
})
const isReasoningExpanded = ref(false)

// Auto-expand reasoning when streaming starts (reasoning present but not yet done),
// auto-collapse when reasoning is done (metadata.reasoningDone flips to true).
watch(
  () => [props.message.reasoningContent, props.message.isStreaming, props.message.metadata?.reasoningDone] as const,
  ([reasoning, streaming, reasoningDone]) => {
    // Streaming and reasoning is present but not done → expand
    if (reasoning && streaming && !reasoningDone) {
      isReasoningExpanded.value = true
    }
    // Reasoning done → collapse
    if (reasoningDone === true) {
      isReasoningExpanded.value = false
    }
  },
  { immediate: true },
)

// Token usage
const hasTokenUsage = computed(
  () => !!props.message.tokenUsage && props.message.role === 'assistant',
)

// Attachments
const attachments = computed<MessageAttachment[]>(() => {
  const files = props.message.metadata?.files
  if (!Array.isArray(files)) return []
  return files.filter(isMessageAttachment)
})

const legacyFiles = computed<{ name: string; size: number; type: string }[]>(() => {
  const files = props.message.metadata?.files
  if (!Array.isArray(files)) return []
  return files.filter((f: unknown) => !isMessageAttachment(f) && isLegacyFileMetadata(f)) as { name: string; size: number; type: string }[]
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Store raw code indexed by block position for copy
const codeBlockRawMap = computed<Map<number, string>>(() => {
  const map = new Map<number, string>()
  const regex = /```[\w]*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null = regex.exec(props.message.content)
  let idx = 0
  while (match !== null) {
    map.set(idx, match[1].replace(/\n$/, ''))
    idx++
    match = regex.exec(props.message.content)
  }
  return map
})

const contentRef = ref<HTMLElement | null>(null)
const copiedIndex = ref<number | null>(null)

function addCopyButtons(): void {
  const el = contentRef.value
  if (!el) return

  // Find all <pre> blocks — each one corresponds to a code block
  const preBlocks = el.querySelectorAll('pre')
  preBlocks.forEach((pre, index) => {
    // Skip if already has a copy button
    if (pre.querySelector('.code-block-copy')) return

    pre.style.position = 'relative'

    const btn = document.createElement('button')
    btn.className = 'code-block-copy'
    btn.textContent = t('chat.copyCode')
    btn.addEventListener('click', () => copyCode(index, btn))
    pre.appendChild(btn)
  })
}

async function copyCode(index: number, btn: HTMLButtonElement): Promise<void> {
  const raw = codeBlockRawMap.value.get(index)
  if (raw === undefined) return
  try {
    await navigator.clipboard.writeText(raw)
    copiedIndex.value = index
    btn.textContent = t('chat.copySuccess')
    setTimeout(() => {
      copiedIndex.value = null
      btn.textContent = t('chat.copyCode')
    }, 2000)
  } catch {
    // Clipboard not available
  }
}

onMounted(() => {
  nextTick(() => addCopyButtons())
})

onUpdated(() => {
  nextTick(() => addCopyButtons())
})
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'chat-message--user': isUser,
      'chat-message--assistant': isAssistant,
      'chat-message--system': isSystem,
    }"
  >
    <div v-if="isAssistant" class="chat-message__avatar">
      <span class="chat-message__avatar-icon">AI</span>
    </div>

    <div class="chat-message__body">
      <div class="chat-message__time">{{ relativeTime }}</div>
      <div class="chat-message__bubble">
      <!-- Reasoning / Thinking Process -->
      <div v-if="hasReasoning" class="chat-message__reasoning">
        <div class="chat-message__reasoning-header" @click="isReasoningExpanded = !isReasoningExpanded">
          <span class="chat-message__reasoning-icon">💭</span>
          <span class="chat-message__reasoning-title">{{ t('chat.thinking') }}</span>
          <span v-if="hasTokenUsage && message.tokenUsage!.reasoningTokens" class="chat-message__reasoning-tokens">{{ message.tokenUsage!.reasoningTokens }} tokens</span>
          <span class="chat-message__reasoning-toggle">{{ isReasoningExpanded ? '▲' : '▼' }}</span>
        </div>
        <div class="chat-message__reasoning-collapse" :class="{ 'chat-message__reasoning-collapse--collapsed': !isReasoningExpanded }">
          <div class="chat-message__reasoning-content">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-html="renderedReasoning" />
          </div>
        </div>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div ref="contentRef" class="chat-message__content" v-html="renderedContent" />
      <!-- Attachments -->
      <div v-if="attachments.length > 0 || legacyFiles.length > 0" class="chat-message__attachments">
        <!-- Valid MessageAttachment items -->
        <div
          v-for="attachment in attachments"
          :key="attachment.id"
          class="chat-message__attachment"
          :class="`chat-message__attachment--${attachment.type}`"
        >
          <!-- Image -->
          <img
            v-if="attachment.type === 'image' && (attachment.url || attachment.data)"
            :src="attachment.url || attachment.data"
            :alt="attachment.name"
            class="chat-message__attachment-image"
          />
          <!-- Audio -->
          <audio
            v-else-if="attachment.type === 'audio' && (attachment.url || attachment.data)"
            controls
            :src="attachment.url || attachment.data"
          />
          <!-- Video -->
          <video
            v-else-if="attachment.type === 'video' && (attachment.url || attachment.data)"
            controls
            :src="attachment.url || attachment.data"
            class="chat-message__attachment-video"
          />
          <!-- Document / fallback -->
          <div v-else class="chat-message__attachment-doc">
            <span class="chat-message__attachment-icon">📎</span>
            <span class="chat-message__attachment-name">{{ attachment.name }}</span>
            <span class="chat-message__attachment-size">{{ formatSize(attachment.size) }}</span>
          </div>
        </div>
        <!-- Legacy file metadata -->
        <div
          v-for="(file, index) in legacyFiles"
          :key="`legacy-${index}`"
          class="chat-message__attachment chat-message__attachment--document"
        >
          <div class="chat-message__attachment-doc">
            <span class="chat-message__attachment-icon">📎</span>
            <span class="chat-message__attachment-name">{{ file.name }}</span>
          </div>
        </div>
      </div>
      <div v-if="hasTokenUsage" class="chat-message__token-usage">
        <span class="chat-message__token-usage-label">{{ t('chat.tokenUsage') }}:</span>
        <span class="chat-message__token-usage-item">{{ t('chat.promptTokens') }} {{ message.tokenUsage!.promptTokens }}</span>
        <span class="chat-message__token-usage-item">{{ t('chat.completionTokens') }} {{ message.tokenUsage!.completionTokens }}</span>
        <span class="chat-message__token-usage-item">{{ t('chat.totalTokens') }} {{ message.tokenUsage!.totalTokens }}</span>
      </div>
      <span v-if="showStreamingCursor" class="chat-message__cursor" />
    </div>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 16px;
}

.chat-message--user {
  flex-direction: row-reverse;
}

.chat-message--system {
  justify-content: center;
}

.chat-message__body {
  display: flex;
  flex-direction: column;
  max-width: 70%;
}

.chat-message--user .chat-message__body {
  align-items: flex-end;
}

.chat-message--assistant .chat-message__body {
  align-items: flex-start;
}

.chat-message--system .chat-message__body {
  align-items: center;
  max-width: 90%;
}

.chat-message__time {
  font-size: 11px;
  color: var(--el-text-color-placeholder, #a8abb2);
  margin-bottom: 4px;
  user-select: none;
  padding: 0 4px;
}

.chat-message__avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--el-color-primary-light-5, #409eff);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-message__avatar-icon {
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.chat-message__bubble {
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.5;
  font-size: 14px;
  word-break: break-word;
  position: relative;
}

.chat-message--user .chat-message__bubble {
  background: var(--el-color-primary, #409eff);
  color: #fff;
  border-top-right-radius: 4px;
}

.chat-message--assistant .chat-message__bubble {
  background: var(--el-fill-color-light, #f5f7fa);
  color: var(--el-text-color-primary, #303133);
  border-top-left-radius: 4px;
}

.chat-message--system .chat-message__bubble {
  background: var(--el-color-warning-light-9, #fdf6ec);
  color: var(--el-text-color-regular, #606266);
  text-align: center;
  font-size: 13px;
}

.chat-message__content :deep(p) {
  margin: 0 0 8px;
}

.chat-message__content :deep(p:last-child) {
  margin-bottom: 0;
}

.chat-message__content :deep(pre) {
  background: #0d1117;
  border-radius: 8px;
  overflow: hidden;
  margin: 12px 0;
  font-size: 13px;
  line-height: 1.6;
  position: relative;
}

.chat-message__content :deep(pre code) {
  display: block;
  color: #c9d1d9;
  background: #0d1117;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  overflow-x: auto;
}

.chat-message__content :deep(pre .code-block-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: rgba(110, 118, 129, 0.15);
  border-bottom: 1px solid rgba(110, 118, 129, 0.2);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 12px;
  color: #8b949e;
  user-select: none;
}

.chat-message__content :deep(pre .code-block-header__lang) {
  text-transform: lowercase;
}

.chat-message__content :deep(pre .code-block-body) {
  display: block;
  padding: 12px 16px;
  overflow-x: auto;
}

.chat-message__content :deep(code) {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.chat-message__content :deep(:not(pre) > code) {
  background: var(--el-fill-color, #f0f2f5);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.chat-message__cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--el-color-primary, #409eff);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: chat-cursor-blink 1s step-end infinite;
}

.chat-message__token-usage {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
  user-select: none;
}

.chat-message__token-usage-label {
  font-weight: 500;
}

.chat-message__token-usage-item {
  opacity: 0.85;
}

@keyframes chat-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.chat-message__content :deep(.code-block-copy) {
  position: absolute;
  top: 6px;
  right: 8px;
  background: rgba(110, 118, 129, 0.25);
  border: 1px solid rgba(110, 118, 129, 0.3);
  color: #c9d1d9;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  z-index: 1;
  line-height: 1;
}

.chat-message__content :deep(.code-block-copy:hover) {
  background: rgba(110, 118, 129, 0.45);
  color: #f0f6fc;
}

.chat-message__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.chat-message__attachment {
  border-radius: 8px;
  overflow: hidden;
  max-width: 100%;
}

.chat-message__attachment--image {
  max-width: 300px;
}

.chat-message__attachment-image {
  display: block;
  max-width: 100%;
  border-radius: 8px;
  cursor: pointer;
}

.chat-message__attachment--audio,
.chat-message__attachment--video {
  max-width: 320px;
}

.chat-message__attachment-video {
  display: block;
  max-width: 100%;
  border-radius: 8px;
}

.chat-message__attachment--document {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  font-size: 12px;
}

.chat-message--user .chat-message__attachment--document {
  background: rgba(255, 255, 255, 0.15);
}

.chat-message__attachment-icon {
  font-size: 14px;
}

.chat-message__attachment-name {
  color: inherit;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-message__attachment-size {
  opacity: 0.6;
  font-size: 11px;
}

.chat-message__reasoning {
  margin-bottom: 10px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;
  overflow: hidden;
}

.chat-message__reasoning-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--el-fill-color-lighter, #fafafa);
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  transition: background-color 0.2s;
}

.chat-message__reasoning-header:hover {
  background: var(--el-fill-color, #f0f2f5);
}

.chat-message__reasoning-icon {
  font-size: 13px;
}

.chat-message__reasoning-title {
  font-weight: 500;
}

.chat-message__reasoning-tokens {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
  background: var(--el-fill-color, #f0f2f5);
  padding: 1px 6px;
  border-radius: 10px;
}

.chat-message__reasoning-toggle {
  margin-left: auto;
  font-size: 10px;
}

.chat-message__reasoning-collapse {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.25s ease;
}

.chat-message__reasoning-collapse--collapsed {
  grid-template-rows: 0fr;
}

.chat-message__reasoning-content {
  overflow: hidden;
  min-height: 0;
}

.chat-message__reasoning-content :deep(div) {
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-regular, #606266);
  background: var(--el-fill-color-lighter, #fafafa);
}

.chat-message__reasoning-content :deep(div p) {
  margin: 0 0 6px;
}

.chat-message__reasoning-content :deep(div p:last-child) {
  margin-bottom: 0;
}
</style>
