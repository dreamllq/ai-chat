<script setup lang="ts">
import { computed } from 'vue'
import { ElSelect, ElOption, ElTag } from 'element-plus'
import { agentRegistry } from '../services/agent'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useLocale()

const agents = computed(() => {
  // Depend on version so registry changes trigger re-computation
  void agentRegistry.version.value
  return agentRegistry.getAllDefinitions()
})

function getAgentName(agent: { name: string; nameKey?: string }): string {
  return agent.nameKey ? t(agent.nameKey) : agent.name
}

function getAgentDesc(agent: { description?: string; descriptionKey?: string }): string | undefined {
  if (agent.descriptionKey) return t(agent.descriptionKey)
  return agent.description
}

const placeholder = computed(() => t('agent.select'))

function handleChange(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <ElSelect
    :model-value="modelValue"
    :placeholder="placeholder"
    class="agent-selector"
    @update:model-value="handleChange"
  >
    <ElOption
      v-for="agent in agents"
      :key="agent.id"
      :value="agent.id"
      :label="getAgentName(agent)"
    >
      <div class="agent-selector__option">
        <div class="agent-selector__option-info">
          <span class="agent-selector__option-name">{{ getAgentName(agent) }}</span>
          <span v-if="getAgentDesc(agent)" class="agent-selector__option-desc">
            {{ getAgentDesc(agent) }}
          </span>
        </div>
        <ElTag v-if="agent.isBuiltin" size="small" type="info">
          {{ t('agent.builtin') }}
        </ElTag>
      </div>
    </ElOption>
  </ElSelect>
</template>

<style scoped>
.agent-selector {
  width: 100%;
}

.agent-selector__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.agent-selector__option-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.agent-selector__option-name {
  font-size: 14px;
  line-height: 1.4;
}

.agent-selector__option-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
