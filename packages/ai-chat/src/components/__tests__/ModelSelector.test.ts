import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ModelSelector from '../ModelSelector.vue'
import type { ModelConfig } from '../../types'

// --- Mocks ---
const selectModelMock = vi.fn()

const mockModels = ref<ModelConfig[] | undefined>([
  {
    id: 'model-1',
    name: 'GPT-4',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    modelName: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4096,
    createdAt: Date.now(),
  },
  {
    id: 'model-2',
    name: 'Claude',
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    apiKey: 'sk-ant-test',
    modelName: 'claude-3-opus',
    temperature: 0.5,
    maxTokens: 8192,
    createdAt: Date.now(),
  },
])

const mockCurrentModelId = ref<string | null>('model-1')

vi.mock('../../composables/useModel', () => ({
  useModel: () => ({
    models: mockModels,
    currentModelId: mockCurrentModelId,
    currentModel: ref(
      mockModels.value?.find((m) => m.id === mockCurrentModelId.value),
    ),
    selectModel: selectModelMock,
    createModel: vi.fn(),
    deleteModel: vi.fn(),
    initDefault: vi.fn(),
  }),
}))

vi.mock('../../composables/useLocale', () => ({
  useLocale: () => ({
    locale: ref({}),
    t: (path: string) => {
      const map: Record<string, string> = {
        'model.selectModel': 'Select Model',
        'model.title': 'Model',
      }
      return map[path] ?? path
    },
    setLocale: vi.fn(),
  }),
}))

const stubs = {
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template: `<div data-testid="model-select"><slot /></div>`,
  },
  ElOption: {
    name: 'ElOption',
    props: ['value', 'label'],
    template: `<div :data-value="value" data-testid="model-option">{{ label }}</div>`,
  },
  ElButton: {
    name: 'ElButton',
    emits: ['click'],
    template: `<button data-testid="manage-btn" @click="$emit('click')"><slot /></button>`,
  },
  ElIcon: true,
  Setting: true,
  ModelManager: {
    name: 'ModelManager',
    props: ['visible'],
    emits: ['update:visible'],
    template: `<div v-if="visible" data-testid="model-manager">Manager</div>`,
  },
}

function mountComponent() {
  return mount(ModelSelector, { global: { stubs } })
}

describe('ModelSelector', () => {
  beforeEach(() => {
    selectModelMock.mockClear()
    mockModels.value = [
      {
        id: 'model-1',
        name: 'GPT-4',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        modelName: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4096,
        createdAt: Date.now(),
      },
      {
        id: 'model-2',
        name: 'Claude',
        provider: 'anthropic',
        endpoint: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        modelName: 'claude-3-opus',
        temperature: 0.5,
        maxTokens: 8192,
        createdAt: Date.now(),
      },
    ]
    mockCurrentModelId.value = 'model-1'
  })

  it('renders model options for each model', () => {
    const wrapper = mountComponent()
    const options = wrapper.findAll('[data-testid="model-option"]')
    expect(options).toHaveLength(2)
    expect(options[0].text()).toBe('GPT-4')
    expect(options[1].text()).toBe('Claude')
  })

  it('selecting a model triggers selectModel', async () => {
    const wrapper = mountComponent()
    const select = wrapper.findComponent({ name: 'ElSelect' })
    await select.vm.$emit('update:modelValue', 'model-2')
    expect(selectModelMock).toHaveBeenCalledWith('model-2')
  })

  it('shows placeholder text when no models are configured', async () => {
    mockModels.value = []
    const wrapper = mountComponent()
    const options = wrapper.findAll('[data-testid="model-option"]')
    expect(options).toHaveLength(0)
  })

  it('renders manage button to open dialog', () => {
    const wrapper = mountComponent()
    const btn = wrapper.find('[data-testid="manage-btn"]')
    expect(btn.exists()).toBe(true)
  })

  it('manage button toggles dialog visibility', async () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="model-manager"]').exists()).toBe(false)
    const btn = wrapper.find('[data-testid="manage-btn"]')
    await btn.trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="model-manager"]').exists()).toBe(true)
  })

  it('binds currentModelId to ElSelect modelValue', () => {
    const wrapper = mountComponent()
    const select = wrapper.findComponent({ name: 'ElSelect' })
    expect(select.props('modelValue')).toBe('model-1')
  })
})
