<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
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
} from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { useModel } from '../composables/useModel'
import { useLocale } from '../composables/useLocale'
import type { ModelConfig } from '../types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const { models, createModel,
  deleteModel } = useModel()
const { t } = useLocale()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val),
})

const selectedModelId = ref<string | null>(null)

const form = reactive({
  name: '',
  provider: 'openai',
  endpoint: '',
  apiKey: '',
  modelName: '',
  temperature: 0.7,
  maxTokens: 4096,
})

const providers = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'custom', label: 'Custom' },
]

function selectModelItem(model: ModelConfig) {
  selectedModelId.value = selectedModelId.value === model.id ? null : model.id
}

async function handleCreate() {
  await createModel({
    name: form.name,
    provider: form.provider,
    endpoint: form.endpoint,
    apiKey: form.apiKey,
    modelName: form.modelName,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
  })
  // Reset form
  form.name = ''
  form.provider = 'openai';
  form.endpoint = ''
  form.apiKey = ''
  form.modelName = '';
  form.temperature = 0.7;
  form.maxTokens = 4096;
}

async function handleDelete(id: string) {
  await deleteModel(id);
  if (selectedModelId.value === id) {
    selectedModelId.value = null;
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
        <ElScrollbar>
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
              <span class="model-manager__item-name">{{ model.name }}</span>
              <span class="model-manager__item-meta">{{ model.provider }} / {{ model.modelName }}</span>
            </div>
            <ElPopconfirm
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

      <!-- Right Panel: Create Form -->
      <div class="model-manager__form-panel">
        <ElScrollbar>
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
                data-testid="el-input"
              />
            </ElFormItem>

            <ElFormItem :label="t('model.provider')">
              <ElSelect v-model="form.provider" data-testid="el-select">
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
                data-testid="el-input"
              />
            </ElFormItem>

            <ElFormItem :label="t('model.apiKey')">
              <ElInput
                v-model="form.apiKey"
                type="password"
                show-password
                :placeholder="t('model.apiKey')"
                data-testid="el-input"
              />
            </ElFormItem>

            <ElFormItem :label="t('model.modelName')">
              <ElInput
                v-model="form.modelName"
                :placeholder="t('model.modelName')"
                data-testid="el-input"
              />
            </ElFormItem>

            <ElFormItem :label="t('model.temperature')">
              <ElSlider
                v-model="form.temperature"
                :min="0"
                :max="2"
                :step="0.1"
                data-testid="el-slider"
              />
            </ElFormItem>

            <ElFormItem :label="t('model.maxTokens')">
              <ElInputNumber
                v-model="form.maxTokens"
                :min="1"
                :max="100000"
                data-testid="el-input-number"
              />
            </ElFormItem>

            <ElFormItem>
              <ElButton type="primary" data-testid="el-button" @click="handleCreate">
                {{ t('model.create') }}
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

/* Make scrollbars fill their panels */
.model-manager__list-panel :deep(.el-scrollbar),
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
</style>
