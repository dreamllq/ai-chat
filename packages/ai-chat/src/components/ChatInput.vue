<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElInput, ElButton } from 'element-plus'
import { useLocale } from '../composables/useLocale'
import type { FileUploadService } from '../types'

const props = defineProps<{
  isStreaming?: boolean
  fileUploadService?: FileUploadService | null
}>()

const emit = defineEmits<{
  send: [payload: { content: string; files?: File[] }]
  stop: []
}>()

const { t } = useLocale()

const inputText = ref('')
const selectedFiles = ref<File[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

const trimmedText = computed(() => inputText.value.trim())
const canSend = computed(() => trimmedText.value.length > 0 || selectedFiles.value.length > 0)

function handleSend() {
  if (!canSend.value || props.isStreaming) return

  const payload: { content: string; files?: File[] } = {
    content: trimmedText.value,
  }

  if (selectedFiles.value.length > 0) {
    payload.files = [...selectedFiles.value]
  }

  emit('send', payload)
  inputText.value = ''
  selectedFiles.value = []
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
  // Reset the input so the same file can be selected again
  target.value = ''
}

function removeFile(index: number) {
  selectedFiles.value.splice(index, 1)
}
</script>

<template>
  <div class="chat-input">
    <!-- File preview area -->
    <div v-if="selectedFiles.length > 0" class="chat-input__files">
      <div v-for="(file, index) in selectedFiles" :key="index" class="chat-input__file-item">
        <span class="chat-input__file-name">{{ file.name }}</span>
        <button class="chat-input__file-remove" @click="removeFile(index)">×</button>
      </div>
    </div>

    <div class="chat-input__row">
      <ElInput
        v-model="inputText"
        type="textarea"
        :placeholder="t('chat.placeholder')"
        :autosize="{ minRows: 1, maxRows: 6 }"
        resize="none"
        @keydown="handleKeydown"
      />

      <!-- File upload button -->
      <template v-if="fileUploadService">
        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="chat-input__hidden-input"
          @change="handleFileChange"
        />
        <ElButton @click="triggerFileUpload">
          {{ t('upload.button') }}
        </ElButton>
      </template>

      <!-- Send / Stop button -->
      <ElButton
        v-if="isStreaming"
        type="danger"
        @click="handleStop"
      >
        {{ t('chat.stop') }}
      </ElButton>
      <ElButton
        v-else
        type="primary"
        :disabled="!canSend"
        @click="handleSend"
      >
        {{ t('chat.send') }}
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-input__row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.chat-input__row :deep(.el-textarea) {
  flex: 1;
}

.chat-input__hidden-input {
  display: none;
}

.chat-input__files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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
</style>
