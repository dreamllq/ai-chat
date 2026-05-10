import { ref, computed, watch, type Ref } from 'vue'
import { ModelService } from '../services/database'
import { useObservable } from './useObservable'
import type { ModelConfig } from '../types'

function getStorageKey(chatId: string): string {
  return `ai-chat:${chatId}:selected-model-id`
}

const currentModelIdMap = new Map<string, Ref<string | null>>()

let modelConfig: { defaultModelId?: string; showModelSelector: boolean } = { showModelSelector: true }
let propModels: ModelConfig[] = []

function getOrCreateCurrentModelId(chatId: string): Ref<string | null> {
  let modelIdRef = currentModelIdMap.get(chatId)
  if (modelIdRef) return modelIdRef

  modelIdRef = ref<string | null>(null)
  // Restore persisted selection for this chatId
  try {
    const saved = localStorage.getItem(getStorageKey(chatId))
    if (saved) modelIdRef.value = saved
  } catch {}

  currentModelIdMap.set(chatId, modelIdRef)
  return modelIdRef
}

/** Reset singleton state (for testing) */
export function _resetModelState() {
  currentModelIdMap.clear()
  modelConfig = { showModelSelector: true }
  propModels = []
}

export function useModel(chatId = 'default') {
  const modelService = new ModelService()
  const dbModels = useObservable<ModelConfig[]>(() => modelService.getAll())

  const currentModelId = getOrCreateCurrentModelId(chatId)

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
      try { localStorage.setItem(getStorageKey(chatId), modelConfig.defaultModelId!) } catch {}
      return
    }

    const firstId = loaded[0].id
    currentModelId.value = firstId
    try {
      localStorage.setItem(getStorageKey(chatId), firstId)
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
        if (nextId) localStorage.setItem(getStorageKey(chatId), nextId)
        else localStorage.removeItem(getStorageKey(chatId))
      } catch {}
    }
  }

  function selectModel(id: string): void {
    currentModelId.value = id
    try {
      localStorage.setItem(getStorageKey(chatId), id)
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

  /** Check whether a model originates from props (not stored in IndexedDB) */
  function isPropModel(id: string): boolean {
    return propModels.some((m) => m.id === id) && !(dbModels.value ?? []).some((m) => m.id === id)
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
    isPropModel,
  }
}
