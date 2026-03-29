import { ref, computed } from 'vue'
import { ModelService } from '../services/database'
import { useObservable } from './useObservable'
import type { ModelConfig } from '../types'

// Module-level singleton — shared across all useModel() callers
const currentModelId = ref<string | null>(null)

/** Reset singleton state (for testing) */
export function _resetModelState() {
  currentModelId.value = null
}

export function useModel() {
  const modelService = new ModelService()
  const models = useObservable<ModelConfig[]>(() => modelService.getAll())
  const currentModel = computed(() =>
    models.value?.find((m) => m.id === currentModelId.value),
  )

  async function createModel(
    data: Omit<ModelConfig, 'id' | 'createdAt'>,
  ): Promise<ModelConfig> {
    return modelService.create(data)
  }

  async function deleteModel(id: string): Promise<void> {
    await modelService.delete(id)
    if (currentModelId.value === id) {
      const remaining = models.value?.filter((m) => m.id !== id)
      currentModelId.value = remaining?.[0]?.id ?? null
    }
  }

  function selectModel(id: string): void {
    currentModelId.value = id
  }

  async function initDefault(): Promise<void> {
    if (!currentModelId.value && models.value && models.value.length > 0) {
      currentModelId.value = models.value[0].id
    }
  }

  return {
    models,
    currentModelId,
    currentModel,
    createModel,
    deleteModel,
    selectModel,
    initDefault,
  }
}
