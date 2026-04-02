<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { ElSelect, ElOption, ElTag, ElButton, ElIcon, ElMessage } from 'element-plus'
import { Promotion, CircleClose, UploadFilled, Setting } from '@element-plus/icons-vue'
import { useLocale } from '../composables/useLocale'
import { useModel } from '../composables/useModel'
import { useFileUpload } from '../composables/useFileUpload'
import { agentRegistry } from '../services/agent'
import ModelManager from './ModelManager.vue'
import type { FileUploadService, MessageAttachment } from '../types'

const MANAGE_MODEL_VALUE = '__manage_models__'

const props = defineProps<{
  isStreaming?: boolean
  fileUploadService?: FileUploadService | null
  currentAgentId?: string
}>()

const emit = defineEmits<{
  send: [payload: { content: string; attachments?: MessageAttachment[] }]
  stop: []
  'update:currentAgentId': [value: string]
  'update:currentModelId': [value: string]
}>()

const { t } = useLocale()
const { models, currentModelId } = useModel()
const { fileStates, isAllReady, addFile, removeFile, retryFile, getCompletedAttachments, clear } = useFileUpload({
  fileUploadService: props.fileUploadService
})

const inputText = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const managerVisible = ref(false)

const trimmedText = computed(() => inputText.value.trim())
const hasModel = computed(() => !!currentModelId.value)
const canSend = computed(() =>
  hasModel.value && (trimmedText.value.length > 0 || fileStates.value.length > 0) && isAllReady.value
)
const agents = computed(() => {
  // Depend on version so registry changes trigger re-computation
  void agentRegistry.version.value
  return agentRegistry.getAllDefinitions()
})

function getAgentName(agent: { name: string; nameKey?: string }): string {
  return agent.nameKey ? t(agent.nameKey) : agent.name
}

const MIN_TEXTAREA_HEIGHT = 44

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  // Temporarily collapse to measure true content height.
  // All synchronous — browser won't paint the intermediate state.
  el.style.height = '0px'
  const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 22
  const maxHeight = lineHeight * 8
  const newHeight = Math.max(el.scrollHeight, MIN_TEXTAREA_HEIGHT)
  el.style.height = Math.min(newHeight, maxHeight) + 'px'
}

onMounted(() => autoResize())
watch(inputText, () => nextTick(autoResize))

function handleSend() {
  if (!hasModel.value) {
    ElMessage.warning(t('error.modelNotSelected'))
    return
  }
  if (!canSend.value || props.isStreaming) return
  const payload: { content: string; attachments?: MessageAttachment[] } = {
    content: trimmedText.value,
  }
  const attachments = getCompletedAttachments()
  if (attachments.length > 0) {
    payload.attachments = attachments
  }
  emit('send', payload)
  inputText.value = ''
  clear()
  nextTick(autoResize)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    handleSend()
  }
}

function handleStop() {
  emit('stop')
}

function triggerFileUpload() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    for (const file of Array.from(target.files)) {
      addFile(file)
    }
  }
  target.value = ''
}

function handleRemoveFile(id: string) {
  removeFile(id)
}

function handleAgentChange(value: string) {
  emit('update:currentAgentId', value)
}

function handleModelChange(id: string) {
  if (id === MANAGE_MODEL_VALUE) {
    managerVisible.value = true
    return
  }
  emit('update:currentModelId', id)
}
</script>

<template>
  <div class="chat-input">
    <div class="chat-input__container">
      <!-- File preview area -->
      <div v-if="fileStates.length > 0" class="chat-input__files">
        <div 
          v-for="item in fileStates" 
          :key="item.id" 
          class="chat-input__file-item"
          :class="{
            'chat-input__file-item--uploading': item.status === 'uploading',
            'chat-input__file-item--success': item.status === 'success',
            'chat-input__file-item--failed': item.status === 'failed'
          }"
        >
          <span class="chat-input__file-name">{{ item.file.name }}</span>
          
          <!-- Uploading: progress overlay -->
          <div v-if="item.status === 'uploading'" class="chat-input__file-progress">
            <div class="chat-input__file-progress-bar" :style="{ width: item.progress + '%' }"></div>
            <span class="chat-input__file-progress-text">{{ item.progress }}%</span>
          </div>
          
          <!-- Failed: error overlay + retry -->
          <div v-if="item.status === 'failed'" class="chat-input__file-error">
            <span class="chat-input__file-error-text">{{ t('attachment.uploadFailed') }}</span>
            <button class="chat-input__file-retry" @click="retryFile(item.id)">{{ t('error.retry') }}</button>
          </div>
          
          <!-- Remove button (always visible) -->
          <button class="chat-input__file-remove" @click="handleRemoveFile(item.id)">×</button>
        </div>
      </div>

      <!-- Textarea -->
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="chat-input__textarea"
        :placeholder="t('chat.placeholder')"
        rows="1"
        @keydown="handleKeydown"
      />

      <!-- Toolbar strip -->
      <div class="chat-input__toolbar">
        <div class="chat-input__toolbar-left">
          <!-- Agent selector -->
          <ElSelect
            :model-value="currentAgentId"
            :placeholder="t('agent.select')"
            size="small"
            class="chat-input__selector"
            style="width: 120px"
            @update:model-value="handleAgentChange"
          >
            <ElOption
              v-for="agent in agents"
              :key="agent.id"
              :value="agent.id"
              :label="getAgentName(agent)"
            >
              <div class="chat-input__agent-option">
                <span>{{ getAgentName(agent) }}</span>
                <ElTag v-if="agent.isBuiltin" size="small" type="info">
                  {{ t('agent.builtin') }}
                </ElTag>
              </div>
            </ElOption>
          </ElSelect>

          <!-- Model selector -->
          <ElSelect
            :model-value="currentModelId"
            :placeholder="t('model.selectModel')"
            size="small"
            class="chat-input__selector"
            style="width: 140px"
            @update:model-value="handleModelChange"
          >
            <ElOption
              v-for="model in (models ?? [])"
              :key="model.id"
              :value="model.id"
              :label="model.name"
            />
            <div class="chat-input__dropdown-divider" />
            <ElOption
              :value="MANAGE_MODEL_VALUE"
              :label="t('model.manage')"
              class="chat-input__manage-option"
            >
              <div class="chat-input__manage-option-content">
                <ElIcon :size="14"><Setting /></ElIcon>
                <span>{{ t('model.manage') }}</span>
              </div>
            </ElOption>
          </ElSelect>

        </div>

        <div class="chat-input__toolbar-right">
          <!-- File upload (hidden input + icon button) -->
          <input
            ref="fileInputRef"
            type="file"
            multiple
            class="chat-input__hidden-input"
            aria-label="Upload file"
            @change="handleFileChange"
          />
          <ElButton
            size="small"
            text
            class="chat-input__icon-btn"
            @click="triggerFileUpload"
          >
            <ElIcon :size="14"><UploadFilled /></ElIcon>
          </ElButton>
          <!-- Stop button -->
          <ElButton
            v-if="isStreaming"
            type="danger"
            circle
            size="small"
            @click="handleStop"
          >
            <ElIcon :size="14"><CircleClose /></ElIcon>
          </ElButton>
          <!-- Send button -->
          <ElButton
            v-else
            type="primary"
            circle
            size="small"
            :disabled="!canSend"
            @click="handleSend"
          >
            <ElIcon :size="14"><Promotion /></ElIcon>
          </ElButton>
        </div>
      </div>
    </div>

    <ModelManager v-model:visible="managerVisible" />
  </div>
</template>

<style scoped>
.chat-input {
  --chat-input-radius: var(--ai-chat-input-radius, 14px);
  --chat-input-border: var(--ai-chat-input-border, var(--el-border-color-light, #dcdfe6));
  --chat-input-bg: var(--ai-chat-input-bg, var(--el-bg-color, #ffffff));
  --chat-input-shadow: var(--ai-chat-input-shadow, 0 2px 8px rgba(0, 0, 0, 0.06));
  --chat-input-toolbar-height: var(--ai-chat-input-toolbar-height, 38px);
}

.chat-input__container {
  display: flex;
  flex-direction: column;
  border-radius: var(--chat-input-radius);
  border: 1px solid var(--chat-input-border);
  background-color: var(--chat-input-bg);
  box-shadow: var(--chat-input-shadow);
  overflow: hidden;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.chat-input__container:focus-within {
  border-color: var(--el-color-primary-light-3, #b3d8ff);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-7, rgba(64, 158, 255, 0.12)),
    var(--chat-input-shadow);
}

/* === File previews === */
.chat-input__files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 14px 0;
}

.chat-input__file-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background-color: var(--el-fill-color-light);
  border-radius: var(--el-border-radius-base);
  font-size: 12px;
}

.chat-input__file-name {
  color: var(--el-text-color-regular);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-input__file-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: none;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  border-radius: 50%;
}

.chat-input__file-remove:hover {
  color: var(--el-color-danger);
  background-color: var(--el-fill-color);
}

/* === File upload status variants === */
.chat-input__file-item--uploading {
  position: relative;
  background-color: var(--el-color-primary-light-9, #ecf5ff);
}

.chat-input__file-item--success {
  background-color: var(--el-color-success-light, #f0f9eb);
}

.chat-input__file-item--failed {
  position: relative;
  background-color: var(--el-color-danger-light, #fef0f0);
}

/* Progress overlay */
.chat-input__file-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: var(--el-border-radius-base);
  overflow: hidden;
}

.chat-input__file-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--el-color-primary, #409eff);
  opacity: 0.3;
  transition: width 0.3s ease;
}

.chat-input__file-progress-text {
  position: relative;
  z-index: 1;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Error overlay */
.chat-input__file-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: var(--el-border-radius-base);
  padding: 0 6px;
}

.chat-input__file-error-text {
  font-size: 11px;
  color: var(--el-color-danger, #f56c6c);
  white-space: nowrap;
}

.chat-input__file-retry {
  font-size: 11px;
  color: var(--el-color-primary, #409eff);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
}

.chat-input__file-retry:hover {
  text-decoration: underline;
}

/* === Textarea === */
.chat-input__textarea {
  display: block;
  width: 100%;
  padding: 12px 14px 4px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 22px;
  font-family: inherit;
  min-height: 44px;
  max-height: 176px;
  overflow-y: auto;
}

.chat-input__textarea::placeholder {
  color: var(--el-text-color-placeholder);
}

/* === Toolbar === */
.chat-input__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--chat-input-toolbar-height);
  padding: 0 8px 6px;
  gap: 4px;
}

.chat-input__toolbar-left {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.chat-input__toolbar-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Compact selects in toolbar — strip borders */
.chat-input__selector {
  flex-shrink: 0;
}

.chat-input__selector :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background: transparent;
  padding: 0 4px;
}

.chat-input__selector :deep(.el-input__wrapper:hover) {
  box-shadow: none !important;
}

.chat-input__selector :deep(.el-input__inner) {
  font-size: 12px;
}

.chat-input__selector :deep(.el-select__caret) {
  font-size: 12px;
}

/* Divider in model dropdown */
.chat-input__dropdown-divider {
  height: 1px;
  background-color: var(--el-border-color-lighter);
  margin: 4px 0;
}

/* Model management option */
.chat-input__manage-option-content {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.chat-input__manage-option:hover .chat-input__manage-option-content {
  color: var(--el-color-primary);
}

/* Agent option layout */
.chat-input__agent-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

/* Icon buttons in toolbar */
.chat-input__icon-btn {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.chat-input__icon-btn:hover {
  color: var(--el-text-color-primary);
}

/* Hidden file input */
.chat-input__hidden-input {
  display: none;
}
</style>
