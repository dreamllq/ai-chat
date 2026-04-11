<script setup lang="ts">
import { reactive, computed, ref, watch } from 'vue'
import {
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElSlider,
  ElButton,
  ElPopconfirm,
  ElIcon,
  ElScrollbar,
  ElMessage,
} from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import { useModel } from '../composables/useModel'
import { useLocale } from '../composables/useLocale'
import type { ModelConfig } from '../types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const { models, createModel, updateModel,
  deleteModel, isPropModel } = useModel()
const { t } = useLocale()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val),
})

const selectedModelId = ref<string | null>(null)
const isNewMode = ref(true)
const isSelectedPropModel = computed(() =>
  selectedModelId.value ? isPropModel(selectedModelId.value) : false,
)
const isFieldDisabled = computed(() => !isNewMode.value && isSelectedPropModel.value)

const form = reactive({
  name: '',
  provider: 'qwen',
  endpoint: '',
  apiKey: '',
  modelName: '',
  temperature: 0.7,
  maxTokens: 4096,
})

const providers = computed(() => [
  { value: 'qwen', label: '通义千问' },
  { value: 'zhipu', label: '智谱' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'other', label: t('model.providerOther') },
])

const PROVIDER_PRESETS: Record<string, { endpoint: string; modelName: string }> = {
  qwen: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelName: 'qwen-turbo' },
  zhipu: { endpoint: 'https://open.bigmodel.cn/api/paas/v4', modelName: 'glm-4-flash' },
  deepseek: { endpoint: 'https://api.deepseek.com/v1', modelName: 'deepseek-chat' },
}

const modelList = ref<string[]>([])
const isLoadingModels = ref(false)

let fetchAbortController: AbortController | null = null

async function fetchModels() {
  if (form.provider === 'other' || !form.endpoint || !form.apiKey) {
    modelList.value = []
    return
  }
  fetchAbortController?.abort()
  const controller = new AbortController()
  fetchAbortController = controller

  isLoadingModels.value = true
  try {
    const response = await fetch(`${form.endpoint}/models`, {
      headers: { 'Authorization': `Bearer ${form.apiKey}` },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (fetchAbortController === controller) {
      modelList.value = (data.data || []).map((m: { id: string }) => m.id).sort()
    }
  } catch (e) {
    if (controller.signal.aborted) return
    if (fetchAbortController === controller) {
      modelList.value = []
    }
  } finally {
    if (fetchAbortController === controller) {
      isLoadingModels.value = false
    }
  }
}

watch(models, (val) => {
  if (selectedModelId.value) return
  if (val && val.length > 0) {
    selectModelItem(val[0])
  }
}, { immediate: true })

watch(() => form.provider, (provider) => {
  const preset = PROVIDER_PRESETS[provider]
  if (preset) {
    form.endpoint = preset.endpoint
    if (isNewMode.value) {
      form.modelName = preset.modelName
    }
    if (form.apiKey) {
      fetchModels()
    }
  } else {
    if (isNewMode.value) {
      form.endpoint = ''
      form.modelName = ''
    }
    modelList.value = []
  }
})

let apiKeyTimer: ReturnType<typeof setTimeout> | null = null
watch(() => form.apiKey, () => {
  if (apiKeyTimer) clearTimeout(apiKeyTimer)
  apiKeyTimer = setTimeout(() => {
    if (form.provider !== 'other' && form.endpoint && form.apiKey) {
      fetchModels()
    }
  }, 600)
})

function fillForm(model: ModelConfig) {
  form.name = model.name
  form.provider = model.provider
  form.endpoint = model.endpoint
  form.apiKey = model.apiKey
  form.modelName = model.modelName
  form.temperature = model.temperature ?? 0.7
  form.maxTokens = model.maxTokens ?? 4096
}

function resetForm() {
  form.name = ''
  form.provider = 'qwen'
  form.endpoint = ''
  form.apiKey = ''
  form.modelName = ''
  form.temperature = 0.7
  form.maxTokens = 4096
  modelList.value = []
}

function handleNewModel() {
  selectedModelId.value = null
  isNewMode.value = true
  resetForm()
}

function selectModelItem(model: ModelConfig) {
  if (selectedModelId.value === model.id) return
  selectedModelId.value = model.id
  isNewMode.value = false
  fillForm(model)
}

async function handleCreate() {
  const created = await createModel({
    name: form.name,
    provider: form.provider,
    endpoint: form.endpoint,
    apiKey: form.apiKey,
    modelName: form.modelName,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
  })
  selectedModelId.value = created.id
  isNewMode.value = false
  ElMessage.success(t('model.createSuccess'))
}

async function handleUpdate() {
  if (!selectedModelId.value) return
  const model = models.value?.find(m => m.id === selectedModelId.value)
  if (!model) return
  await updateModel(model.id, {
    name: form.name,
    provider: form.provider,
    endpoint: form.endpoint,
    apiKey: form.apiKey,
    modelName: form.modelName,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
  })
  ElMessage.success(t('model.updateSuccess'))
}

async function handleDelete(id: string) {
  await deleteModel(id)
  if (selectedModelId.value === id) {
    const remaining = (models.value ?? []).filter(m => m.id !== id)
    if (remaining.length > 0) {
      selectModelItem(remaining[0])
    } else {
      handleNewModel()
    }
  }
}
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :title="t('model.title')"
    width="760px"
    destroy-on-close
    append-to-body
    data-testid="el-dialog"
  >
    <div class="model-manager">
      <!-- Left Panel: Model List -->
      <div class="model-manager__list-panel">
        <div class="model-manager__list-header">
          <ElButton
            type="primary"
            :icon="Plus"
            size="small"
            class="model-manager__new-btn"
            data-testid="new-model-btn"
            @click="handleNewModel"
          >
            {{ t('model.addNew') }}
          </ElButton>
        </div>
        <ElScrollbar class="model-manager__list-scroll">
          <div v-if="(models ?? []).length === 0" class="model-manager__empty">
            {{ t('model.emptyList') }}
          </div>
          <div
            v-for="model in (models ?? [])"
            :key="model.id"
            class="model-manager__item"
            :class="{ 'model-manager__item--active': selectedModelId === model.id }"
            @click="selectModelItem(model)"
          >
            <div class="model-manager__item-content">
              <div class="model-manager__item-row">
                <span class="model-manager__item-name">{{ model.name }}</span>
              </div>
              <span class="model-manager__item-meta">{{ model.provider }} / {{ model.modelName }}</span>
            </div>
            <ElPopconfirm
              v-if="!isPropModel(model.id)"
              :title="t('model.deleteConfirm')"
              data-testid="el-popconfirm"
              @confirm="handleDelete(model.id)"
            >
              <template #reference>
                <ElButton
                  class="model-manager__item-delete"
                  type="danger"
                  :icon="Delete"
                  size="small"
                  circle
                  data-testid="delete-btn"
                  @click.stop
                />
              </template>
            </ElPopconfirm>
          </div>
        </ElScrollbar>
      </div>

      <!-- Right Panel: Form -->
      <div class="model-manager__form-panel">
        <ElScrollbar>
          <!-- Edit mode header -->
          <div v-if="!isNewMode" class="model-manager__edit-header">
            <span class="model-manager__edit-title">{{ form.name }}</span>
          </div>
          <!-- Prop model readonly notice -->
          <div v-if="!isNewMode && isSelectedPropModel" class="model-manager__readonly-notice">
            {{ t('model.propModelReadOnly') }}
          </div>
          <!-- Single unified form -->
          <ElForm
            :model="form"
            label-width="120px"
            label-position="right"
            data-testid="el-form"
            class="model-manager__form"
          >
            <ElFormItem :label="t('model.name')">
              <ElInput
                v-model="form.name"
                :placeholder="t('model.name')"
                :disabled="isFieldDisabled"
                data-testid="el-input"
              />
            </ElFormItem>

            <ElFormItem :label="t('model.provider')">
              <ElSelect v-model="form.provider" :disabled="isFieldDisabled" data-testid="el-select">
                <ElOption
                  v-for="p in providers"
                  :key="p.value"
                  :value="p.value"
                  :label="p.label"
                  data-testid="el-option"
                />
              </ElSelect>
            </ElFormItem>

            <ElFormItem :label="t('model.endpoint')">
              <ElInput
                v-model="form.endpoint"
                :placeholder="t('model.endpoint')"
                :disabled="isFieldDisabled || form.provider !== 'other'"
                data-testid="el-input"
              />
            </ElFormItem>

            <ElFormItem :label="t('model.apiKey')">
              <ElInput
                v-model="form.apiKey"
                type="password"
                show-password
                :placeholder="t('model.apiKeyPlaceholder')"
                :disabled="isFieldDisabled"
                data-testid="el-input"
              />
            </ElFormItem>

            <ElFormItem :label="t('model.modelName')">
              <ElSelect
                v-model="form.modelName"
                :placeholder="t('model.modelName')"
                filterable
                allow-create
                default-first-option
                :loading="isLoadingModels"
                :disabled="isFieldDisabled"
                data-testid="el-select"
              >
                <ElOption
                  v-for="name in modelList"
                  :key="name"
                  :value="name"
                  :label="name"
                />
              </ElSelect>
            </ElFormItem>

            <ElFormItem :label="t('model.temperature')">
              <ElSlider
                v-model="form.temperature"
                :min="0"
                :max="2"
                :step="0.1"
                :disabled="isFieldDisabled"
                data-testid="el-slider"
              />
            </ElFormItem>

            <ElFormItem :label="t('model.maxTokens')">
              <ElInputNumber
                v-model="form.maxTokens"
                :min="1"
                :max="100000"
                :disabled="isFieldDisabled"
                data-testid="el-input-number"
              />
            </ElFormItem>

            <!-- Button: create in new mode, save in edit mode (hidden for prop models) -->
            <ElFormItem v-if="isNewMode || !isSelectedPropModel">
              <ElButton type="primary" data-testid="el-button" @click="isNewMode ? handleCreate() : handleUpdate()">
                {{ isNewMode ? t('model.create') : t('model.save') }}
              </ElButton>
            </ElFormItem>
          </ElForm>
        </ElScrollbar>
      </div>
    </div>
  </ElDialog>
</template>

<style scoped>
.model-manager {
  display: flex;
  max-height: calc(70vh - 100px);
  min-height: 420px;
  overflow: hidden;
}

/* Left Panel */
.model-manager__list-panel {
  width: 240px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  min-height: 0;
  overflow: hidden;
}

.model-manager__list-header {
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.model-manager__new-btn {
  width: 100%;
}

.model-manager__list-scroll {
  flex: 1;
  min-height: 0;
}

.model-manager__empty {
  padding: 32px 16px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  text-align: center;
  line-height: 1.6;
}

.model-manager__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.model-manager__item:hover {
  background: var(--el-fill-color);
}

.model-manager__item--active {
  background: var(--el-color-primary-light-9);
}

.model-manager__item--active:hover {
  background: var(--el-color-primary-light-8);
}

.model-manager__item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.model-manager__item-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-manager__item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-manager__item-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-manager__item-delete {
  opacity: 0;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
  margin-left: 4px;
}

.model-manager__item:hover .model-manager__item-delete {
  opacity: 1;
}

/* Right Panel */
.model-manager__form-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Edit header */
.model-manager__edit-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 24px 8px;
}

.model-manager__edit-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* Make scrollbars fill their panels */
.model-manager__list-panel :deep(.el-scrollbar),
.model-manager__list-scroll :deep(.el-scrollbar),
.model-manager__form-panel :deep(.el-scrollbar) {
  height: 100%;
}

.model-manager__form {
  padding: 20px 24px 8px;
}

.model-manager__form :deep(.el-form-item__label) {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.model-manager__form :deep(.el-select) {
  width: 100%;
}

.model-manager__form :deep(.el-slider) {
  padding-right: 20px;
}

.model-manager__readonly-notice {
  margin: 0 24px 12px;
  padding: 8px 12px;
  background: var(--el-color-info-light-9);
  border-radius: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
</style>
