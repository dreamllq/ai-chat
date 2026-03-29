<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { ElSelect, ElOption, ElTag, ElButton, ElIcon } from 'element-plus'
import { Promotion, CircleClose, UploadFilled, Setting } from '@element-plus/icons-vue'
import { useLocale } from '../composables/useLocale'
import { useModel } from '../composables/useModel'
import { agentRegistry } from '../services/agent'
import ModelManager from './ModelManager.vue'
import type { FileUploadService } from '../types'

const MANAGE_MODEL_VALUE = '__manage_models__'

const props = defineProps<{
  isStreaming?: boolean
  fileUploadService?: FileUploadService | null
  currentAgentId?: string
}>()

const emit = defineEmits<{
  send: [payload: { content: string; files?: File[] }]
  stop: []
  'update:currentAgentId': [value: string]
  'update:currentModelId': [value: string]
}>()

const { t } = useLocale()
const { models, currentModelId } = useModel()

const inputText = ref('')
const selectedFiles = ref<File[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const managerVisible = ref(false)

const trimmedText = computed(() => inputText.value.trim())
const canSend = computed(() => trimmedText.value.length > 0 || selectedFiles.value.length > 0)
const agents = computed(() => {
  // Depend on version so registry changes trigger re-computation
  void agentRegistry.version.value
  return agentRegistry.getAllDefinitions()
})

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 22
  const maxHeight = lineHeight * 8
  el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
}

watch(inputText, () => nextTick(autoResize))

function handleSend() {
  if (!canSend.value || props.isStreaming) return
  const payload: { content: string; files?: File[] } = { content: trimmedText.value }
  if (selectedFiles.value.length > 0) {
    payload.files = [...selectedFiles.value]
  }
  emit('send', payload)
  inputText.value = ''
  selectedFiles.value = []
  nextTick(autoResize)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
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
    const newFiles = Array.from(target.files)
    selectedFiles.value = [...selectedFiles.value, ...newFiles]
  }
  target.value = ''
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1)
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
      <div v-if="selectedFiles.length > 0" class="chat-input__files">
        <div v-for="(file, index) in selectedFiles" :key="index" class="chat-input__file-item">
          <span class="chat-input__file-name">{{ file.name }}</span>
          <button class="chat-input__file-remove" @click="removeFile(index)">×</button>
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
              :label="agent.name"
            >
              <div class="chat-input__agent-option">
                <span>{{ agent.name }}</span>
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
