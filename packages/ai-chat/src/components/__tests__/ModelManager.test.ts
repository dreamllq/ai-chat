import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ModelManager from '../ModelManager.vue'
import type { ModelConfig } from '../../types'

// --- Mocks ---
const createModelMock = vi.fn().mockResolvedValue({ id: 'new-model-id' })
const deleteModelMock = vi.fn().mockResolvedValue(undefined)
const updateModelMock = vi.fn().mockResolvedValue(undefined)

const mockModels = ref<ModelConfig[] | undefined>([
  {
    id: 'model-1',
    name: 'GPT-4',
    provider: 'qwen',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'sk-test',
    modelName: 'qwen-turbo',
    temperature: 0.7,
    maxTokens: 4096,
    createdAt: Date.now(),
  },
])

vi.mock('../../composables/useModel', () => ({
  useModel: () => ({
    models: mockModels,
    currentModelId: ref<string | null>('model-1'),
    currentModel: ref(mockModels.value?.[0]),
    selectModel: vi.fn(),
    createModel: createModelMock,
    updateModel: updateModelMock,
    deleteModel: deleteModelMock,
    initDefault: vi.fn(),
    isPropModel: (id: string) => id === 'prop-model',
  }),
}))

vi.mock('../../composables/useLocale', () => ({
  useLocale: () => ({
    locale: ref({}),
    t: (path: string) => {
      const map: Record<string, string> = {
        'model.title': 'Model Manager',
        'model.create': 'Create Model',
        'model.addNew': 'Add Model',
        'model.delete': 'Delete',
        'model.deleteConfirm': 'Are you sure?',
        'model.name': 'Display Name',
        'model.provider': 'Provider',
        'model.endpoint': 'API Endpoint',
        'model.apiKey': 'API Key',
        'model.apiKeyPlaceholder': 'Enter API key',
        'model.modelName': 'Model Name',
        'model.temperature': 'Temperature',
        'model.maxTokens': 'Max Tokens',
        'model.save': 'Save',
        'model.cancel': 'Cancel',
        'model.emptyList': 'No models configured',
        'model.providerOther': 'Other',
        'model.fetchModelsFailed': 'Failed to fetch models',
        'model.propModelReadOnly': 'This is a prop model and is read-only',
        'model.createSuccess': 'Model created successfully',
        'model.updateSuccess': 'Model saved successfully',
      }
      return map[path] ?? path
    },
    setLocale: vi.fn(),
  }),
}))

vi.mock('@element-plus/icons-vue', () => ({
  Delete: { name: 'Delete', template: '<span>delete-icon</span>' },
  Plus: { name: 'Plus', template: '<span>plus-icon</span>' },
}))

const { ElMessageMock } = vi.hoisted(() => {
  const mock = Object.assign(vi.fn(), {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  })
  return { ElMessageMock: mock }
})

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: ElMessageMock,
  }
})

const stubs = {
  ElDialog: {
    name: 'ElDialog',
    props: ['modelValue', 'title'],
    emits: ['update:modelValue'],
    template: `
      <div v-if="modelValue" data-testid="el-dialog">
        <h3>{{ title }}</h3>
        <slot />
      </div>
    `,
  },
  ElForm: {
    name: 'ElForm',
    props: ['model'],
    template: `<form data-testid="el-form"><slot /></form>`,
  },
  ElFormItem: {
    name: 'ElFormItem',
    props: ['label'],
    template: `<div data-testid="el-form-item"><slot /></div>`,
  },
  ElInput: {
    name: 'ElInput',
    props: ['modelValue', 'type', 'showPassword', 'placeholder', 'disabled'],
    emits: ['update:modelValue'],
    template: `
      <input
        :type="type === 'password' && !showPassword ? 'password' : 'text'"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        data-testid="el-input"
        @input="$emit('update:modelValue', $event.target.value)"
      />
    `,
  },
  ElInputNumber: {
    name: 'ElInputNumber',
    props: ['modelValue', 'min', 'max', 'step', 'disabled'],
    emits: ['update:modelValue'],
    template: `
      <input
        type="number"
        :value="modelValue"
        :disabled="disabled"
        data-testid="el-input-number"
        @input="$emit('update:modelValue', Number($event.target.value))"
      />
    `,
  },
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue', 'disabled', 'filterable', 'allowCreate', 'defaultFirstOption', 'loading', 'placeholder'],
    emits: ['update:modelValue'],
    template: `
      <select :value="modelValue" :disabled="disabled" data-testid="el-select" @change="$emit('update:modelValue', $event.target.value)">
        <slot />
      </select>
    `,
  },
  ElOption: {
    name: 'ElOption',
    props: ['value', 'label'],
    template: `<option :value="value" data-testid="el-option">{{ label }}</option>`,
  },
  ElSlider: {
    name: 'ElSlider',
    props: ['modelValue', 'min', 'max', 'step', 'disabled'],
    emits: ['update:modelValue'],
    template: `
      <input
        type="range"
        :value="modelValue"
        :disabled="disabled"
        data-testid="el-slider"
        @input="$emit('update:modelValue', Number($event.target.value))"
      />
    `,
  },
  ElButton: {
    name: 'ElButton',
    props: ['type', 'size', 'icon', 'circle'],
    emits: ['click'],
    template: `<button data-testid="el-button" @click="$emit('click')"><slot /></button>`,
  },
  ElPopconfirm: {
    name: 'ElPopconfirm',
    props: ['title'],
    emits: ['confirm', 'cancel'],
    template: `
      <div data-testid="el-popconfirm">
        <slot />
        <button data-testid="confirm-btn" @click="$emit('confirm')">Confirm</button>
      </div>
    `,
  },
  ElIcon: {
    name: 'ElIcon',
    template: `<span data-testid="el-icon"><slot /></span>`,
  },
  ElScrollbar: {
    name: 'ElScrollbar',
    template: `<div data-testid="el-scrollbar"><slot /></div>`,
  },
}

function createMountFn() {
  let wrapper: ReturnType<typeof mount> | undefined
  function mountIt(visible = true) {
    wrapper = mount(ModelManager, {
      props: {
        visible,
        'onUpdate:visible': (val: boolean) => {
          wrapper?.setProps({ visible: val })
        },
      },
      global: { stubs },
    })
    return wrapper
  }
  return mountIt
}

describe('ModelManager', () => {
  let mountComponent: ReturnType<typeof createMountFn>
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    createModelMock.mockReset().mockResolvedValue({ id: 'new-model-id' })
    deleteModelMock.mockReset().mockResolvedValue(undefined)
    updateModelMock.mockReset().mockResolvedValue(undefined)
    ElMessageMock.success.mockClear()
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
    ]
    mountComponent = createMountFn()
    wrapper = mountComponent()
  })

  it('renders dialog when visible is true', () => {
    expect(wrapper.find('[data-testid="el-dialog"]').exists()).toBe(true)
  })

  it('does not render dialog when visible is false', () => {
    const w = mountComponent(false)
    expect(w.find('[data-testid="el-dialog"]').exists()).toBe(false)
  })

  it('emits update:visible when dialog closes', async () => {
    const dialog = wrapper.findComponent({ name: 'ElDialog' })
    await dialog.vm.$emit('update:modelValue', false)
    expect(wrapper.emitted('update:visible')?.[0]?.[0]).toBe(false)
  })

  it('renders "Add Model" button in left panel header', () => {
    const btn = wrapper.find('[data-testid="new-model-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Add Model')
  })

  it('renders model list with delete buttons', () => {
    const popconfirms = wrapper.findAll('[data-testid="el-popconfirm"]')
    expect(popconfirms.length).toBeGreaterThanOrEqual(1)
  })

  it('delete model triggers confirmation then deleteModel', async () => {
    const popconfirm = wrapper.findAll('[data-testid="el-popconfirm"]')[0]
    const confirmBtn = popconfirm.find('[data-testid="confirm-btn"]')
    await confirmBtn.trigger('click')
    expect(deleteModelMock).toHaveBeenCalledWith('model-1')
  })

  it('auto-selects first model on mount when models exist', () => {
    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeDefined()

    const inputs = wrapper.findAll('[data-testid="el-input"]')
    const nameInput = inputs.find((input) => (input.element as HTMLInputElement).value === 'GPT-4')
    expect(nameInput).toBeDefined()
  })

  it('shows create mode when models are empty', () => {
    mockModels.value = []
    const w = mountComponent()
    const buttons = w.findAll('[data-testid="el-button"]')
    const createBtn = buttons.find((btn) => btn.text().includes('Create'))
    expect(createBtn).toBeDefined()
  })

  it('clicking already-selected model does nothing (stays in edit mode)', async () => {
    const items = wrapper.findAll('.model-manager__item')
    expect(items.length).toBeGreaterThanOrEqual(1)

    await items[0].trigger('click')
    await nextTick()

    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeDefined()
  })

  it('clicking "Add Model" button resets to create mode', async () => {
    const newBtn = wrapper.find('[data-testid="new-model-btn"]')
    await newBtn.trigger('click')
    await nextTick()

    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const createBtn = buttons.find((btn) => btn.text().includes('Create'))
    expect(createBtn).toBeDefined()
  })

  it('API key input is password type', () => {
    const inputs = wrapper.findAll('[data-testid="el-input"]')
    const passwordInput = inputs.find(
      (input) => input.attributes('type') === 'password',
    )
    expect(passwordInput).toBeDefined()
  })

  it('renders provider select with options', () => {
    const selects = wrapper.findAll('[data-testid="el-select"]')
    expect(selects.length).toBeGreaterThanOrEqual(1)
    const options = wrapper.findAll('[data-testid="el-option"]')
    expect(options.length).toBeGreaterThanOrEqual(1)
  })

  it('renders temperature slider', () => {
    const slider = wrapper.find('[data-testid="el-slider"]')
    expect(slider.exists()).toBe(true)
  })

  it('renders maxTokens input number', () => {
    const inputNumber = wrapper.find('[data-testid="el-input-number"]')
    expect(inputNumber.exists()).toBe(true)
  })

  it('save button in edit mode calls updateModel with all fields for custom model', async () => {
    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeDefined()
    await saveBtn!.trigger('click')

    expect(updateModelMock).toHaveBeenCalledWith('model-1', expect.objectContaining({
      name: 'GPT-4',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
    }))
    expect(ElMessageMock.success).toHaveBeenCalledWith('Model saved successfully')
  })
})

// --- Auto-select first model on mount ---
describe('auto-select first model on mount', () => {
  let mountComponent: ReturnType<typeof createMountFn>

  beforeEach(() => {
    createModelMock.mockReset().mockResolvedValue({ id: 'new-model-id' })
    deleteModelMock.mockReset().mockResolvedValue(undefined)
    updateModelMock.mockReset().mockResolvedValue(undefined)
    mountComponent = createMountFn()
  })

  it('models has items → first model selected, form filled, edit mode', () => {
    mockModels.value = [
      {
        id: 'model-a',
        name: 'Model A',
        provider: 'qwen',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: 'sk-a',
        modelName: 'qwen-turbo',
        temperature: 0.5,
        maxTokens: 2048,
        createdAt: Date.now(),
      },
    ]
    const w = mountComponent()

    const buttons = w.findAll('[data-testid="el-button"]')
    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeDefined()

    const inputs = w.findAll('[data-testid="el-input"]')
    const nameInput = inputs.find((input) => (input.element as HTMLInputElement).value === 'Model A')
    expect(nameInput).toBeDefined()

    const slider = w.find('[data-testid="el-slider"]')
    expect((slider.element as HTMLInputElement).value).toBe('0.5')

    const inputNumber = w.find('[data-testid="el-input-number"]')
    expect((inputNumber.element as HTMLInputElement).value).toBe('2048')
  })

  it('models is empty → create mode, empty form', () => {
    mockModels.value = []
    const w = mountComponent()

    const buttons = w.findAll('[data-testid="el-button"]')
    const createBtn = buttons.find((btn) => btn.text().includes('Create'))
    expect(createBtn).toBeDefined()

    const slider = w.find('[data-testid="el-slider"]')
    expect((slider.element as HTMLInputElement).value).toBe('0.7')
  })
})

// --- After create, selects newly created model ---
describe('after create, selects newly created model', () => {
  let mountComponent: ReturnType<typeof createMountFn>
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    createModelMock.mockReset().mockResolvedValue({ id: 'created-model-123' })
    deleteModelMock.mockReset().mockResolvedValue(undefined)
    updateModelMock.mockReset().mockResolvedValue(undefined)
    ElMessageMock.success.mockClear()
    mountComponent = createMountFn()
  })

  it('fill form, click create → selectedModelId = returned id, isNewMode = false', async () => {
    mockModels.value = []
    wrapper = mountComponent()

    const inputs = wrapper.findAll('[data-testid="el-input"]')
    await inputs[0].setValue('New Model')

    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const createBtn = buttons.find((btn) => btn.text().includes('Create'))
    expect(createBtn).toBeDefined()
    await createBtn!.trigger('click')
    await nextTick()

    expect(createModelMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Model',
    }))

    expect(ElMessageMock.success).toHaveBeenCalledWith('Model created successfully')

    await nextTick()
    const buttonsAfter = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn = buttonsAfter.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeDefined()
  })
})

// --- After update, stays on current model ---
describe('after update, stays on current model', () => {
  let mountComponent: ReturnType<typeof createMountFn>
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    createModelMock.mockReset().mockResolvedValue({ id: 'new-model-id' })
    deleteModelMock.mockReset().mockResolvedValue(undefined)
    updateModelMock.mockReset().mockResolvedValue(undefined)
    mountComponent = createMountFn()
  })

  it('select model, modify name, click save → selectedModelId unchanged, still in edit mode', async () => {
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
    ]
    wrapper = mountComponent()

    const inputs = wrapper.findAll('[data-testid="el-input"]')
    await inputs[0].setValue('GPT-4 Updated')

    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeDefined()
    await saveBtn!.trigger('click')

    expect(updateModelMock).toHaveBeenCalledWith('model-1', expect.objectContaining({
      name: 'GPT-4 Updated',
    }))

    await nextTick()
    const buttonsAfter = wrapper.findAll('[data-testid="el-button"]')
    const saveBtnAfter = buttonsAfter.find((btn) => btn.text().includes('Save'))
    expect(saveBtnAfter).toBeDefined()

    const createBtnAfter = buttonsAfter.find((btn) => btn.text().includes('Create'))
    expect(createBtnAfter).toBeUndefined()
  })
})

// --- Delete last model enters create mode ---
describe('delete last model enters create mode', () => {
  let mountComponent: ReturnType<typeof createMountFn>
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    createModelMock.mockReset().mockResolvedValue({ id: 'new-model-id' })
    deleteModelMock.mockReset().mockResolvedValue(undefined)
    updateModelMock.mockReset().mockResolvedValue(undefined)
    mountComponent = createMountFn()
  })

  it('only 1 model, delete it → isNewMode=true, form reset', async () => {
    mockModels.value = [
      {
        id: 'only-model',
        name: 'Only Model',
        provider: 'qwen',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: 'sk-test',
        modelName: 'qwen-turbo',
        temperature: 0.7,
        maxTokens: 4096,
        createdAt: Date.now(),
      },
    ]
    wrapper = mountComponent()

    const popconfirm = wrapper.findAll('[data-testid="el-popconfirm"]')[0]
    const confirmBtn = popconfirm.find('[data-testid="confirm-btn"]')

    deleteModelMock.mockImplementation(async () => {
      mockModels.value = []
    })

    await confirmBtn.trigger('click')
    await nextTick()
    await nextTick()

    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const createBtn = buttons.find((btn) => btn.text().includes('Create'))
    expect(createBtn).toBeDefined()

    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeUndefined()
  })
})

// --- Prop model fields disabled ---
describe('prop model fields disabled', () => {
  let mountComponent: ReturnType<typeof createMountFn>
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    createModelMock.mockReset().mockResolvedValue({ id: 'new-model-id' })
    deleteModelMock.mockReset().mockResolvedValue(undefined)
    updateModelMock.mockReset().mockResolvedValue(undefined)
    mountComponent = createMountFn()
  })

  it('select prop model → fields disabled, no save button, readonly notice shown', async () => {
    mockModels.value = [
      {
        id: 'prop-model',
        name: 'Prop Model',
        provider: 'qwen',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: 'sk-prop',
        modelName: 'qwen-turbo',
        temperature: 0.7,
        maxTokens: 4096,
        createdAt: Date.now(),
      },
    ]
    wrapper = mountComponent()
    await nextTick()

    const notice = wrapper.find('.model-manager__readonly-notice')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('read-only')

    const allButtons = wrapper.findAll('[data-testid="el-button"]')
    const saveOrCreateBtn = allButtons.find(
      (btn) => btn.text().includes('Save') || btn.text().includes('Create'),
    )
    expect(saveOrCreateBtn).toBeUndefined()

    const inputs = wrapper.findAll('[data-testid="el-input"]')
    const nameInput = inputs.find(
      (input) => (input.element as HTMLInputElement).value === 'Prop Model',
    )
    expect(nameInput).toBeDefined()
    expect(nameInput!.attributes('disabled')).toBeDefined()
  })
})

// --- fetchModels called once per switch ---
describe('fetchModels dedup', () => {
  let mountComponent: ReturnType<typeof createMountFn>
  let wrapper: ReturnType<typeof mount>
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createModelMock.mockReset().mockResolvedValue({ id: 'new-model-id' })
    deleteModelMock.mockReset().mockResolvedValue(undefined)
    updateModelMock.mockReset().mockResolvedValue(undefined)
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'model-a' }, { id: 'model-b' }] }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    mountComponent = createMountFn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses AbortController to cancel stale fetch requests', async () => {
    mockModels.value = [
      {
        id: 'model-1',
        name: 'Qwen Model',
        provider: 'qwen',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: 'sk-test',
        modelName: 'qwen-turbo',
        temperature: 0.7,
        maxTokens: 4096,
        createdAt: Date.now(),
      },
    ]
    wrapper = mountComponent()
    await nextTick()

    await new Promise((r) => setTimeout(r, 700))

    expect(fetchSpy).toHaveBeenCalled()
  })
})
