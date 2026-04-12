<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElSelect, ElOption, ElButton, ElIcon } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import { useModel } from '../composables/useModel'
import { useLocale } from '../composables/useLocale'
import { useSize } from '../size'
import ModelManager from './ModelManager.vue'

const { models, currentModelId, selectModel } = useModel()
const { t } = useLocale()
const size = useSize()

const selectorClasses = computed(() => ({ 'model-selector--mini': size.value === 'mini' }))

const managerVisible = ref(false)

function handleChange(id: string) {
  selectModel(id)
}
</script>

<template>
  <div :class="['model-selector', selectorClasses]">
    <ElSelect
      :model-value="currentModelId"
      :placeholder="t('model.selectModel')"
      data-testid="model-select"
      @update:model-value="handleChange"
    >
      <ElOption
        v-for="model in (models ?? [])"
        :key="model.id"
        :value="model.id"
        :label="model.name"
        data-testid="model-option"
      />
    </ElSelect>
    <ElButton data-testid="manage-btn" @click="managerVisible = true">
      <ElIcon><Setting /></ElIcon>
    </ElButton>
    <ModelManager v-model:visible="managerVisible" />
  </div>
</template>

<style scoped>
.model-selector--mini :deep(.el-input__inner) {
  font-size: 12px;
}

.model-selector--mini :deep(.el-input__wrapper) {
  padding: 0 4px;
}
</style>
