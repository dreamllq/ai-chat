<script setup lang="ts">
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
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
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch {
        // fall through
      }
    }
    return ''
  },
})

const renderedContent = computed(() => md.render(props.message.content))

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isSystem = computed(() => props.message.role === 'system')
const showStreamingCursor = computed(
  () => props.message.role === 'assistant' && props.message.isStreaming === true,
)

// Code block copy state: keyed by code index
const copiedIndex = ref<number | null>(null)

interface CodeBlock {
  index: number
  raw: string
}

const codeBlocks = computed<CodeBlock[]>(() => {
  const blocks: CodeBlock[] = []
  const regex = /```[\w]*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  let idx = 0
  while ((match = regex.exec(props.message.content)) !== null) {
    blocks.push({ index: idx, raw: match[1].replace(/\n$/, '') })
    idx++
  }
  return blocks
})

async function copyCode(block: CodeBlock): Promise<void> {
  try {
    await navigator.clipboard.writeText(block.raw)
    copiedIndex.value = block.index
    setTimeout(() => {
      copiedIndex.value = null
    }, 2000)
  } catch {
    // Clipboard not available
  }
}
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
      <div class="chat-message__content" v-html="renderedContent" />
      <span v-if="showStreamingCursor" class="chat-message__cursor" />

      <!-- Copy buttons for code blocks -->
      <div
        v-for="block in codeBlocks"
        :key="block.index"
        class="chat-message__code-actions"
      >
        <button
          class="chat-message__code-copy"
          @click="copyCode(block)"
        >
          {{ copiedIndex === block.index ? t('chat.copySuccess') : t('chat.copyCode') }}
        </button>
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
  background: var(--el-fill-color-darker, #1e1e1e);
  color: #d4d4d4;
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.6;
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

.chat-message__code-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.chat-message__code-copy {
  background: transparent;
  border: none;
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  transition: color 0.2s, background-color 0.2s;
}

.chat-message__code-copy:hover {
  color: var(--el-color-primary, #409eff);
  background: var(--el-fill-color-light, #f5f7fa);
}
</style>
