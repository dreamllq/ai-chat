<script setup lang="ts">
import { reactive, computed } from 'vue'
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
} from 'element-plus'
import { useModel } from '../composables/useModel'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const { models, createModel, deleteModel } = useModel()
const { t } = useLocale()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val),
})

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
  form.provider = 'openai'
  form.endpoint = ''
  form.apiKey = ''
  form.modelName = ''
  form.temperature = 0.7
  form.maxTokens = 4096
}

async function handleDelete(id: string) {
  await deleteModel(id)
}
</script>

<template>
  <ElDialog v-model="dialogVisible" :title="t('model.title')" data-testid="el-dialog">
    <!-- Model List -->
    <div class="model-list">
      <div
        v-for="model in (models ?? [])"
        :key="model.id"
        class="model-item"
      >
        <span>{{ model.name }}</span>
        <ElPopconfirm
          :title="t('model.delete') + '?'"
          data-testid="el-popconfirm"
          @confirm="handleDelete(model.id)"
        >
          <template #reference>
            <ElButton type="danger" size="small" data-testid="delete-btn">
              {{ t('model.delete') }}
            </ElButton>
          </template>
        </ElPopconfirm>
      </div>
    </div>

    <!-- Create Form -->
    <ElForm :model="form" data-testid="el-form">
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
  </ElDialog>
</template>
