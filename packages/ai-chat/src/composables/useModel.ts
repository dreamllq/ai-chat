import { ref, computed, watch } from 'vue'
import { ModelService } from '../services/database'
import { useObservable } from './useObservable'
import type { ModelConfig } from '../types'

const STORAGE_KEY = 'ai-chat:selected-model-id'

// Module-level singleton — shared across all useModel() callers
const currentModelId = ref<string | null>(null)
let modelConfig: { defaultModelId?: string; showModelSelector: boolean } = { showModelSelector: true }
let propModels: ModelConfig[] = []

// Restore persisted selection on module load
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) currentModelId.value = saved
} catch {}

/** Reset singleton state (for testing) */
export function _resetModelState() {
  currentModelId.value = null
  modelConfig = { showModelSelector: true }
  propModels = []
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function useModel() {
  const modelService = new ModelService()
  const dbModels = useObservable<ModelConfig[]>(() => modelService.getAll())

  const models = computed(() => {
    const db = dbModels.value ?? []
    const merged = [...db]
    for (const pm of propModels) {
      if (!db.some((d) => d.id === pm.id)) {
        merged.push(pm)
      }
    }
    return merged
  })

  const currentModel = computed(() =>
    models.value?.find((m) => m.id === currentModelId.value),
  )

  function resolveDefaultModel(loaded: ModelConfig[]): void {
    if (loaded.length === 0) return

    if (!modelConfig.showModelSelector) {
      // When selector is hidden, always use defaultModelId directly, ignoring localStorage
      const targetId = modelConfig.defaultModelId && loaded.some(m => m.id === modelConfig.defaultModelId)
        ? modelConfig.defaultModelId
        : loaded[0].id
      currentModelId.value = targetId
      return
    }

    // Validate persisted selection against loaded models
    if (currentModelId.value && loaded.some((m) => m.id === currentModelId.value)) {
      return
    }

    // Saved model no longer exists — try defaultModelId, then fall back to first available
    if (modelConfig.defaultModelId && loaded.some(m => m.id === modelConfig.defaultModelId)) {
      currentModelId.value = modelConfig.defaultModelId
      try { localStorage.setItem(STORAGE_KEY, modelConfig.defaultModelId!) } catch {}
      return
    }

    const firstId = loaded[0].id
    currentModelId.value = firstId
    try {
      localStorage.setItem(STORAGE_KEY, firstId)
    } catch {}
  }

  watch(models, (loaded) => {
    resolveDefaultModel(loaded)
  })

  async function createModel(
    data: Omit<ModelConfig, 'id' | 'createdAt'>,
  ): Promise<ModelConfig> {
    return modelService.create(data)
  }

  async function updateModel(id: string, data: Partial<ModelConfig>): Promise<void> {
    await modelService.update(id, data)
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

  async function initDefault(options?: {
    defaultModelId?: string
    showModelSelector?: boolean
    models?: ModelConfig[]
  }): Promise<void> {
    if (options) {
      modelConfig = {
        defaultModelId: options.defaultModelId,
        showModelSelector: options.showModelSelector ?? true,
      }
      if (options.models) {
        propModels = options.models
      }
    }
    resolveDefaultModel(models.value ?? [])
  }

  return {
    models,
    currentModelId,
    currentModel,
    createModel,
    updateModel,
    deleteModel,
    selectModel,
    initDefault,
  }
}
