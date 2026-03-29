import { ref, computed, watch } from 'vue'
import { ModelService } from '../services/database'
import { useObservable } from './useObservable'
import type { ModelConfig } from '../types'

const STORAGE_KEY = 'ai-chat:selected-model-id'

// Module-level singleton — shared across all useModel() callers
const currentModelId = ref<string | null>(null)

// Restore persisted selection on module load
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) currentModelId.value = saved
} catch {}

/** Reset singleton state (for testing) */
export function _resetModelState() {
  currentModelId.value = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function useModel() {
  const modelService = new ModelService()
  const models = useObservable<ModelConfig[]>(() => modelService.getAll())
  const currentModel = computed(() =>
    models.value?.find((m) => m.id === currentModelId.value),
  )

  // Validate persisted selection against loaded models
  watch(models, (loaded) => {
    if (currentModelId.value && loaded && loaded.length > 0) {
      const exists = loaded.some((m) => m.id === currentModelId.value)
      if (!exists) {
        // Saved model no longer exists — fall back to first available
        const firstId = loaded[0].id
        currentModelId.value = firstId
        try {
          localStorage.setItem(STORAGE_KEY, firstId)
        } catch {}
      }
    }
  })

  async function createModel(
    data: Omit<ModelConfig, 'id' | 'createdAt'>,
  ): Promise<ModelConfig> {
    return modelService.create(data)
  }

  async function deleteModel(id: string): Promise<void> {
    await modelService.delete(id)
    if (currentModelId.value === id) {
      const remaining = models.value?.filter((m) => m.id !== id)
      const nextId = remaining?.[0]?.id ?? null
      currentModelId.value = nextId
      try {
        if (nextId) localStorage.setItem(STORAGE_KEY, nextId)
        else localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
  }

  function selectModel(id: string): void {
    currentModelId.value = id
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {}
  }

  async function initDefault(): Promise<void> {
    // Only set default if no selection exists (including restored one)
    if (!currentModelId.value && models.value && models.value.length > 0) {
      const firstId = models.value[0].id
      currentModelId.value = firstId
      try {
        localStorage.setItem(STORAGE_KEY, firstId)
      } catch {}
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
