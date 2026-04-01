<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElDialog, ElScrollbar, ElEmpty } from 'element-plus'
import { SubAgentExecutionService } from '../services/database'
import { useLocale } from '../composables/useLocale'
import type { SubAgentExecution, SubAgentLogEntry } from '../types'

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
const loading = ref(false)

const sortedLogs = computed<SubAgentLogEntry[]>(() => {
  if (!execution.value) return []
  return [...execution.value.logs].sort((a, b) => a.timestamp - b.timestamp)
})

const logTypeConfig: Record<SubAgentLogEntry['type'], { icon: string; labelKey: string; className: string }> = {
  start: { icon: '🟢', labelKey: 'subAgent.logStart', className: 'sub-agent-log__entry--start' },
  token: { icon: '📝', labelKey: 'subAgent.logToken', className: 'sub-agent-log__entry--token' },
  tool_call: { icon: '🔧', labelKey: 'subAgent.logToolCall', className: 'sub-agent-log__entry--tool-call' },
  tool_result: { icon: '⚙️', labelKey: 'subAgent.logToolResult', className: 'sub-agent-log__entry--tool-result' },
  done: { icon: '✅', labelKey: 'subAgent.logDone', className: 'sub-agent-log__entry--done' },
  error: { icon: '❌', labelKey: 'subAgent.logError', className: 'sub-agent-log__entry--error' },
}

function getLogConfig(type: SubAgentLogEntry['type']) {
  return logTypeConfig[type]
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
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

async function loadExecution() {
  if (!props.executionId) {
    execution.value = null
    return
  }
  loading.value = true
  try {
    const service = new SubAgentExecutionService()
    const result = await service.getById(props.executionId)
    execution.value = result ?? null
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.executionId] as const,
  ([visible, id]) => {
    if (visible && id) {
      loadExecution()
    }
  },
  { immediate: true },
)
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
    <div v-if="loading" class="sub-agent-log__loading">
      <span class="sub-agent-log__loading-spinner" />
      {{ t('subAgent.running') }}
    </div>
    <div v-else-if="execution" class="sub-agent-log">
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

      <!-- Timeline -->
      <div class="sub-agent-log__timeline-header">
        {{ t('subAgent.logTimeline') }}
      </div>
      <ElScrollbar class="sub-agent-log__scroll" max-height="400px">
        <div v-if="sortedLogs.length === 0" class="sub-agent-log__empty">
          {{ t('subAgent.noLogs') }}
        </div>
        <div v-else class="sub-agent-log__timeline">
          <div
            v-for="(log, index) in sortedLogs"
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

      <!-- Output -->
      <div v-if="execution.output" class="sub-agent-log__output">
        <div class="sub-agent-log__output-label">{{ t('subAgent.output') }}:</div>
        <div class="sub-agent-log__output-content">{{ execution.output }}</div>
      </div>

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

.sub-agent-log__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 14px;
}

.sub-agent-log__loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--el-color-primary, #409eff);
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: sub-agent-log-spin 1s linear infinite;
}

@keyframes sub-agent-log-spin {
  to { transform: rotate(360deg); }
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

.sub-agent-log__output {
  margin-top: 4px;
  padding: 10px 14px;
  background: var(--el-fill-color-lighter, #fafafa);
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.sub-agent-log__output-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary, #909399);
  margin-bottom: 4px;
}

.sub-agent-log__output-content {
  font-size: 13px;
  color: var(--el-text-color-primary, #303133);
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
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
