<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { ElDialog, ElScrollbar, ElEmpty } from 'element-plus'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { liveQuery } from 'dexie'
import { db } from '../database/db'
import { useLocale } from '../composables/useLocale'
import type { SubAgentExecution, SubAgentLogEntry } from '../types'

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

const props = defineProps<{
  modelValue: boolean
  executionId: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useLocale()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

const execution = ref<SubAgentExecution | null>(null)
let liveQuerySubscription: { unsubscribe(): void } | null = null

function subscribeToExecution(id: string) {
  liveQuerySubscription?.unsubscribe()
  const observable = liveQuery(() => db.subAgentExecutions.get(id))
  liveQuerySubscription = observable.subscribe({
    next: (value) => { execution.value = value ?? null },
  })
}

function unsubscribeFromExecution() {
  liveQuerySubscription?.unsubscribe()
  liveQuerySubscription = null
  execution.value = null
}

watch(
  () => [props.modelValue, props.executionId] as const,
  ([visible, id]) => {
    if (visible && id) {
      subscribeToExecution(id)
    } else {
      unsubscribeFromExecution()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  unsubscribeFromExecution()
})

const sortedLogs = computed<SubAgentLogEntry[]>(() => {
  if (!execution.value) return []
  return [...execution.value.logs].sort((a, b) => a.timestamp - b.timestamp)
})

const logTypeConfig: Record<SubAgentLogEntry['type'], { icon: string; labelKey: string; className: string }> = {
  start: { icon: '🟢', labelKey: 'subAgent.logStart', className: 'sub-agent-log__entry--start' },
  iteration_start: { icon: '🔄', labelKey: 'subAgent.logToken', className: 'sub-agent-log__entry--iteration-start' },
  token: { icon: '📝', labelKey: 'subAgent.logToken', className: 'sub-agent-log__entry--token' },
  reasoning: { icon: '💭', labelKey: 'subAgent.logReasoning', className: 'sub-agent-log__entry--reasoning' },
  tool_call: { icon: '🔧', labelKey: 'subAgent.logToolCall', className: 'sub-agent-log__entry--tool-call' },
  tool_result: { icon: '⚙️', labelKey: 'subAgent.logToolResult', className: 'sub-agent-log__entry--tool-result' },
  done: { icon: '✅', labelKey: 'subAgent.logDone', className: 'sub-agent-log__entry--done' },
  error: { icon: '❌', labelKey: 'subAgent.logError', className: 'sub-agent-log__entry--error' },
}

function getLogConfig(type: SubAgentLogEntry['type']) {
  return logTypeConfig[type]
}

const timelineLogs = computed<SubAgentLogEntry[]>(() => {
  return sortedLogs.value.filter(e => e.type !== 'token' && e.type !== 'reasoning' && e.type !== 'iteration_start')
})

interface IterationStep {
  index: number
  reasoningContent: string
  output: string
}

const iterationSteps = computed<IterationStep[]>(() => {
  if (!execution.value) return []
  const logs = sortedLogs.value

  const steps: IterationStep[] = []
  let currentStep: IterationStep | null = null

  for (const log of logs) {
    if (log.type === 'iteration_start' || log.type === 'start') {
      if (currentStep) {
        steps.push(currentStep)
      }
      currentStep = { index: steps.length, reasoningContent: '', output: '' }
    } else if (currentStep) {
      if (log.type === 'reasoning' && log.content) {
        currentStep.reasoningContent += log.content
      } else if (log.type === 'token' && log.content) {
        currentStep.output += log.content
      }
    }
  }

  if (currentStep) {
    steps.push(currentStep)
  }

  // Backward compat: if no iteration markers found, use top-level output/reasoningContent
  if (steps.length === 0 && (execution.value.output || execution.value.reasoningContent)) {
    steps.push({
      index: 0,
      reasoningContent: execution.value.reasoningContent ?? '',
      output: execution.value.output ?? '',
    })
  }

  return steps
})

const expandedReasoningSteps = reactive<Record<number, boolean>>({})

function isReasoningExpanded(index: number): boolean {
  if (index in expandedReasoningSteps) {
    return expandedReasoningSteps[index]
  }
  // Default: expand if currently streaming
  if (execution.value?.status === 'running') {
    return true
  }
  return false
}

function toggleReasoningStep(index: number): void {
  expandedReasoningSteps[index] = !isReasoningExpanded(index)
}

const isReasoningDone = computed(() => {
  if (!execution.value) return true
  return execution.value.status !== 'running'
})

watch(isReasoningDone, (done) => {
  if (done) {
    for (const key of Object.keys(expandedReasoningSteps)) {
      delete expandedReasoningSteps[Number(key)]
    }
  }
})

function renderStepMarkdown(content: string): string {
  return md.render(content)
}

function getPreviewText(content: string): string {
  const text = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 100 ? text.slice(0, 100) + '…' : text
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function formatDuration(start: number, end: number): string {
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const statusLabel = computed(() => {
  if (!execution.value) return ''
  const labels: Record<string, string> = {
    running: t('subAgent.running'),
    completed: t('subAgent.completed'),
    failed: t('subAgent.failed'),
  }
  return labels[execution.value.status] ?? execution.value.status
})
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="t('subAgent.logTitle')"
    width="640px"
    destroy-on-close
    append-to-body
    data-testid="sub-agent-log-dialog"
  >
    <div v-if="execution" class="sub-agent-log">
      <!-- Execution Header -->
      <div class="sub-agent-log__header">
        <div class="sub-agent-log__header-row">
          <span class="sub-agent-log__agent-name">{{ execution.agentName }}</span>
          <span class="sub-agent-log__status" :class="`sub-agent-log__status--${execution.status}`">
            {{ statusLabel }}
          </span>
        </div>
        <div class="sub-agent-log__task">{{ t('subAgent.task') }}: {{ execution.task }}</div>
        <div class="sub-agent-log__meta">
          <span v-if="execution.endTime">
            {{ t('subAgent.duration', { duration: formatDuration(execution.startTime, execution.endTime) }) }}
          </span>
        </div>
      </div>

      <!-- Steps-based rendering (consistent with ChatMessage) -->
      <template v-if="iterationSteps.length > 0">
        <div v-for="(step, idx) in iterationSteps" :key="idx" class="sub-agent-log__step">
          <!-- Reasoning (collapsible thinking) -->
          <div v-if="step.reasoningContent" class="sub-agent-log__reasoning">
            <div class="sub-agent-log__reasoning-header" @click="toggleReasoningStep(idx)">
              <span class="sub-agent-log__reasoning-icon">💭</span>
              <span class="sub-agent-log__reasoning-title">{{ t('chat.thinking') }}</span>
              <span v-if="!isReasoningExpanded(idx) && step.reasoningContent" class="sub-agent-log__reasoning-preview">{{ getPreviewText(step.reasoningContent) }}</span>
              <span class="sub-agent-log__reasoning-toggle">{{ isReasoningExpanded(idx) ? '▲' : '▼' }}</span>
            </div>
            <div class="sub-agent-log__reasoning-collapse" :class="{ 'sub-agent-log__reasoning-collapse--collapsed': !isReasoningExpanded(idx) }">
              <div class="sub-agent-log__reasoning-content">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-html="renderStepMarkdown(step.reasoningContent)" />
              </div>
            </div>
          </div>
          <!-- Output -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-if="step.output" class="sub-agent-log__bubble-content" v-html="renderStepMarkdown(step.output)" />
        </div>
      </template>

      <!-- Token Usage -->
      <div v-if="execution.tokenUsage" class="sub-agent-log__token-usage">
        <span class="sub-agent-log__token-usage-item">{{ t('chat.promptTokens') }} {{ formatNumber(execution.tokenUsage!.promptTokens) }}</span>
        <span class="sub-agent-log__token-usage-item">{{ t('chat.completionTokens') }} {{ formatNumber(execution.tokenUsage!.completionTokens) }}</span>
        <span class="sub-agent-log__token-usage-item">{{ t('chat.totalTokens') }} {{ formatNumber(execution.tokenUsage!.totalTokens) }}</span>
      </div>

      <!-- Timeline -->
      <div class="sub-agent-log__timeline-header">
        {{ t('subAgent.logTimeline') }}
      </div>
      <ElScrollbar class="sub-agent-log__scroll" max-height="300px">
        <div v-if="timelineLogs.length === 0" class="sub-agent-log__empty">
          {{ t('subAgent.noLogs') }}
        </div>
        <div v-else class="sub-agent-log__timeline">
          <div
            v-for="(log, index) in timelineLogs"
            :key="index"
            class="sub-agent-log__entry"
            :class="getLogConfig(log.type).className"
            data-testid="sub-agent-log-entry"
          >
            <div class="sub-agent-log__entry-marker">
              <span class="sub-agent-log__entry-icon">{{ getLogConfig(log.type).icon }}</span>
            </div>
            <div class="sub-agent-log__entry-body">
              <div class="sub-agent-log__entry-header">
                <span class="sub-agent-log__entry-type">{{ t(getLogConfig(log.type).labelKey) }}</span>
                <span class="sub-agent-log__entry-time">{{ formatTime(log.timestamp) }}</span>
              </div>
              <div class="sub-agent-log__entry-content">{{ log.content }}</div>
            </div>
          </div>
        </div>
      </ElScrollbar>

      <!-- Error -->
      <div v-if="execution.error" class="sub-agent-log__error">
        <div class="sub-agent-log__error-label">{{ t('subAgent.logError') }}:</div>
        <div class="sub-agent-log__error-content">{{ execution.error }}</div>
      </div>
    </div>
    <ElEmpty v-else :description="t('subAgent.noLogs')" />
  </ElDialog>
</template>

<style scoped>
.sub-agent-log {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sub-agent-log__header {
  padding: 12px 16px;
  background: var(--el-fill-color-lighter, #fafafa);
  border-radius: 8px;
}

.sub-agent-log__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sub-agent-log__agent-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}

.sub-agent-log__status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.sub-agent-log__status--running {
  background: #ecf5ff;
  color: var(--el-color-primary, #409eff);
}

.sub-agent-log__status--completed {
  background: #f0f2ff;
  color: var(--el-color-success, #67c23a);
}

.sub-agent-log__status--failed {
  background: #fef0f0;
  color: var(--el-color-danger, #f56c6c);
}

.sub-agent-log__task {
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
  margin-top: 6px;
}

.sub-agent-log__meta {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  margin-top: 4px;
}

.sub-agent-log__timeline-header {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary, #909399);
  padding: 0 4px;
}

.sub-agent-log__scroll {
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 6px;
}

.sub-agent-log__empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--el-text-color-placeholder, #a8abb2);
  font-size: 13px;
}

.sub-agent-log__timeline {
  padding: 8px 12px;
}

.sub-agent-log__entry {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  position: relative;
}

.sub-agent-log__entry:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 11px;
  top: 34px;
  bottom: -8px;
  width: 2px;
  background: var(--el-border-color-lighter, #ebeef5);
}

.sub-agent-log__entry-marker {
  flex-shrink: 0;
  width: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 1px;
}

.sub-agent-log__entry-icon {
  font-size: 14px;
  line-height: 1;
}

.sub-agent-log__entry-body {
  flex: 1;
  min-width: 0;
}

.sub-agent-log__entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-agent-log__entry-type {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary, #303133);
}

.sub-agent-log__entry-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder, #a8abb2);
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

.sub-agent-log__entry-content {
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
  margin-top: 3px;
  word-break: break-word;
  line-height: 1.5;
}

.sub-agent-log__entry--token .sub-agent-log__entry-content {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  background: var(--el-fill-color-lighter, #fafafa);
  padding: 4px 8px;
  border-radius: 4px;
  white-space: pre-wrap;
}

.sub-agent-log__entry--error .sub-agent-log__entry-content {
  color: var(--el-color-danger, #f56c6c);
}

.sub-agent-log__entry--done .sub-agent-log__entry-content {
  color: var(--el-color-success, #67c23a);
}

/* Chat Bubble */
.sub-agent-log__step {
  padding: 10px 14px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 12px;
  border-top-left-radius: 4px;
}

.sub-agent-log__step + .sub-agent-log__step {
  margin-top: 8px;
}

.sub-agent-log__bubble-body {
  flex: 1;
  min-width: 0;
  line-height: 1.5;
  font-size: 14px;
  word-break: break-word;
}

.sub-agent-log__bubble-content :deep(p) {
  margin: 0 0 8px;
}

.sub-agent-log__bubble-content :deep(p:last-child) {
  margin-bottom: 0;
}

.sub-agent-log__bubble-content :deep(pre) {
  background: #0d1117;
  border-radius: 8px;
  overflow: hidden;
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.6;
  position: relative;
}

.sub-agent-log__bubble-content :deep(pre code) {
  display: block;
  color: #c9d1d9;
  background: #0d1117;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  overflow-x: auto;
}

.sub-agent-log__bubble-content :deep(pre .code-block-header) {
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

.sub-agent-log__bubble-content :deep(pre .code-block-header__lang) {
  text-transform: lowercase;
}

.sub-agent-log__bubble-content :deep(pre .code-block-body) {
  display: block;
  padding: 12px 16px;
  overflow-x: auto;
}

.sub-agent-log__bubble-content :deep(code) {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.sub-agent-log__bubble-content :deep(:not(pre) > code) {
  background: var(--el-fill-color, #f0f2f5);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

/* Reasoning (collapsible thinking) */
.sub-agent-log__reasoning {
  margin-bottom: 10px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;
  overflow: hidden;
}

.sub-agent-log__reasoning-header {
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

.sub-agent-log__reasoning-header:hover {
  background: var(--el-fill-color, #f0f2f5);
}

.sub-agent-log__reasoning-icon {
  font-size: 13px;
}

.sub-agent-log__reasoning-title {
  font-weight: 500;
}

.sub-agent-log__reasoning-tokens {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
  background: var(--el-fill-color, #f0f2f5);
  padding: 1px 6px;
  border-radius: 10px;
}

.sub-agent-log__reasoning-toggle {
  margin-left: auto;
  font-size: 10px;
}

.sub-agent-log__reasoning-preview {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-text-color-placeholder, #a8abb2);
}

.sub-agent-log__reasoning-collapse {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.25s ease;
}

.sub-agent-log__reasoning-collapse--collapsed {
  grid-template-rows: 0fr;
}

.sub-agent-log__reasoning-content {
  overflow: hidden;
  min-height: 0;
}

.sub-agent-log__reasoning-content :deep(div) {
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-regular, #606266);
  background: var(--el-fill-color-lighter, #fafafa);
}

.sub-agent-log__reasoning-content :deep(div p) {
  margin: 0 0 6px;
}

.sub-agent-log__reasoning-content :deep(div p:last-child) {
  margin-bottom: 0;
}

.sub-agent-log__token-usage {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.sub-agent-log__token-usage-item {
  font-size: 11px;
}

.sub-agent-log__error {
  margin-top: 4px;
  padding: 10px 14px;
  background: #fef0f0;
  border-radius: 6px;
  border: 1px solid #fbc4c4;
}

.sub-agent-log__error-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-color-danger, #f56c6c);
  margin-bottom: 4px;
}

.sub-agent-log__error-content {
  font-size: 13px;
  color: var(--el-color-danger, #f56c6c);
  line-height: 1.6;
  word-break: break-word;
}
</style>
