<script setup lang="ts">
import { computed, nextTick, onMounted, onUpdated, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import type { ChatMessage } from '../types'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  message: ChatMessage
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
const showStreamingCursor = computed(
  () => props.message.role === 'assistant' && props.message.isStreaming === true,
)

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

    <div class="chat-message__bubble">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div ref="contentRef" class="chat-message__content" v-html="renderedContent" />
      <span v-if="showStreamingCursor" class="chat-message__cursor" />
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
  max-width: 70%;
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
  max-width: 90%;
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
</style>
