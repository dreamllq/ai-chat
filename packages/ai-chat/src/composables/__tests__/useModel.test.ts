import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useModel, _resetModelState } from '../useModel'
import { db } from '../../database/db'
import type { ModelConfig } from '../../types'

// Helper to test composables that use lifecycle hooks (onUnmounted etc.)
function withSetup<T>(composable: () => T): { result: T; wrapper: ReturnType<typeof mount> } {
  let result!: T
  const App = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  const wrapper = mount(App)
  return { result, wrapper }
}

// Helper to wait for Dexie liveQuery to propagate
async function flushLiveQuery(): Promise<void> {
  // liveQuery emits asynchronously; wait a tick for reactivity
  await vi.waitFor(() => {}, { timeout: 200 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 50))
}

// Sample model data factory
function createModelData(overrides: Partial<Omit<ModelConfig, 'id' | 'createdAt'>> = {}) {
  return {
    name: 'Test Model',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    apiKey: 'sk-test-key',
    modelName: 'gpt-4',
    ...overrides,
  }
}

describe('useModel', () => {
  beforeEach(async () => {
    // Clear models table before each test
    await db.models.clear()
    // Reset module-level singleton state
    _resetModelState()
  })

  it('createModel adds a model and it appears in models list', async () => {
    const { result } = withSetup(() => useModel())

    const created = await result.createModel(createModelData({ name: 'GPT-4' }))
    expect(created.id).toBeDefined()
    expect(created.name).toBe('GPT-4')

    await flushLiveQuery()

    // models ref should now contain the created model
    expect(result.models.value).toBeDefined()
    expect(result.models.value!.length).toBeGreaterThanOrEqual(1)
    expect(result.models.value!.some((m) => m.id === created.id)).toBe(true)
  })

  it('deleteModel removes a model from list', async () => {
    const { result } = withSetup(() => useModel())

    const created = await result.createModel(createModelData({ name: 'ToDelete' }))
    await flushLiveQuery()
    expect(result.models.value!.some((m) => m.id === created.id)).toBe(true)

    await result.deleteModel(created.id)
    await flushLiveQuery()

    expect(result.models.value!.some((m) => m.id === created.id)).toBe(false)
  })

  it('selectModel changes currentModelId', async () => {
    const { result } = withSetup(() => useModel())

    expect(result.currentModelId.value).toBeNull()

    result.selectModel('model-123')
    expect(result.currentModelId.value).toBe('model-123')
  })

  it('deleting current model auto-selects first available or null', async () => {
    const { result } = withSetup(() => useModel())

    const model1 = await result.createModel(createModelData({ name: 'Model1' }))
    const model2 = await result.createModel(createModelData({ name: 'Model2' }))
    await flushLiveQuery()

    // Select model2 as current
    result.selectModel(model2.id)
    expect(result.currentModelId.value).toBe(model2.id)

    // Delete model2 — should auto-select first model
    await result.deleteModel(model2.id)
    await flushLiveQuery()

    expect(result.currentModelId.value).toBe(model1.id)

    // Now delete the remaining model — should be null
    await result.deleteModel(model1.id)
    await flushLiveQuery()

    expect(result.currentModelId.value).toBeNull()
  })

  it('initDefault selects first model when none selected', async () => {
    const { result } = withSetup(() => useModel())

    await result.createModel(createModelData({ name: 'First' }))
    await result.createModel(createModelData({ name: 'Second' }))
    await flushLiveQuery()

    expect(result.currentModelId.value).toBeNull()

    await result.initDefault()

    // Should select some model from the list
    expect(result.currentModelId.value).not.toBeNull()
    const ids = result.models.value!.map((m) => m.id)
    expect(ids).toContain(result.currentModelId.value)
  })

  it('initDefault does nothing when already selected', async () => {
    const { result } = withSetup(() => useModel())

    await result.createModel(createModelData({ name: 'First' }))
    const model2 = await result.createModel(createModelData({ name: 'Second' }))
    await flushLiveQuery()

    result.selectModel(model2.id)

    await result.initDefault()

    // Should still be model2, not changed to first
    expect(result.currentModelId.value).toBe(model2.id)
  })

  it('currentModel computed returns the right model object', async () => {
    const { result } = withSetup(() => useModel())

    const model = await result.createModel(createModelData({ name: 'TargetModel' }))
    await flushLiveQuery()

    result.selectModel(model.id)

    expect(result.currentModel.value).toBeDefined()
    expect(result.currentModel.value!.id).toBe(model.id)
    expect(result.currentModel.value!.name).toBe('TargetModel')
    expect(result.currentModel.value!.provider).toBe('openai')
  })

  it('currentModel returns undefined when no model is selected', async () => {
    const { result } = withSetup(() => useModel())

    await result.createModel(createModelData({ name: 'SomeModel' }))
    await flushLiveQuery()

    expect(result.currentModelId.value).toBeNull()
    expect(result.currentModel.value).toBeUndefined()
  })
})
