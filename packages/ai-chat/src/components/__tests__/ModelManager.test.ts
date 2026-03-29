import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ModelManager from '../ModelManager.vue'
import type { ModelConfig } from '../../types'

// --- Mocks ---
const createModelMock = vi.fn().mockResolvedValue({})
const deleteModelMock = vi.fn().mockResolvedValue(undefined)
const updateModelMock = vi.fn().mockResolvedValue(undefined)

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
        'model.builtin': 'Built-in',
        'model.emptyList': 'No models configured',
      }
      return map[path] ?? path
    },
    setLocale: vi.fn(),
  }),
}))

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
    props: ['modelValue', 'type', 'showPassword', 'placeholder'],
    emits: ['update:modelValue'],
    template: `
      <input
        :type="type === 'password' && !showPassword ? 'password' : 'text'"
        :value="modelValue"
        :placeholder="placeholder"
        data-testid="el-input"
        @input="$emit('update:modelValue', $event.target.value)"
      />
    `,
  },
  ElInputNumber: {
    name: 'ElInputNumber',
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:modelValue'],
    template: `
      <input
        type="number"
        :value="modelValue"
        data-testid="el-input-number"
        @input="$emit('update:modelValue', Number($event.target.value))"
      />
    `,
  },
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: `
      <select :value="modelValue" data-testid="el-select" @change="$emit('update:modelValue', $event.target.value)">
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
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:modelValue'],
    template: `
      <input
        type="range"
        :value="modelValue"
        data-testid="el-slider"
        @input="$emit('update:modelValue', Number($event.target.value))"
      />
    `,
  },
  ElButton: {
    name: 'ElButton',
    props: ['type', 'size'],
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
    createModelMock.mockClear()
    deleteModelMock.mockClear()
    updateModelMock.mockClear()
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

  it('shows create form by default (new mode)', () => {
    const form = wrapper.find('[data-testid="el-form"]')
    expect(form.exists()).toBe(true)
    // In create mode, there should be a "Create Model" button
    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const createBtn = buttons.find((btn) => btn.text().includes('Create'))
    expect(createBtn).toBeDefined()
  })

  it('clicking custom model fills form and shows save button', async () => {
    // Click the first model item (custom model)
    const items = wrapper.findAll('.model-manager__item')
    expect(items.length).toBeGreaterThanOrEqual(1)
    await items[0].trigger('click')
    await nextTick()

    // Should now be in edit mode with save button
    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeDefined()

    // Form should be filled with model data
    const inputs = wrapper.findAll('[data-testid="el-input"]')
    const nameInput = inputs.find((input) => (input.element as HTMLInputElement).value === 'GPT-4')
    expect(nameInput).toBeDefined()
  })

  it('clicking already-selected model does nothing (stays in edit mode)', async () => {
    const items = wrapper.findAll('.model-manager__item')
    // Select
    await items[0].trigger('click')
    await nextTick()

    // Should be in edit mode with save button
    let buttons = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeDefined()

    // Click same item again — should stay in edit mode
    await items[0].trigger('click')
    await nextTick()

    buttons = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn2 = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn2).toBeDefined()
  })

  it('clicking "Add Model" button resets to create mode', async () => {
    // First select a model to enter edit mode
    const items = wrapper.findAll('.model-manager__item')
    await items[0].trigger('click')
    await nextTick()

    // Click "Add Model" button
    const newBtn = wrapper.find('[data-testid="new-model-btn"]')
    await newBtn.trigger('click')
    await nextTick()

    // Should show create button
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

  it('create button submits form with createModel', async () => {
    const inputs = wrapper.findAll('[data-testid="el-input"]')
    // Name input is the first one
    await inputs[0].setValue('Test Model')

    // Find and click create button
    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const createBtn = buttons.find(
      (btn) => btn.text().includes('Create'),
    )
    expect(createBtn).toBeDefined()
    await createBtn!.trigger('click')
    expect(createModelMock).toHaveBeenCalled()
  })

  it('save button in edit mode calls updateModel with all fields for custom model', async () => {
    // Click the custom model to enter edit mode
    const items = wrapper.findAll('.model-manager__item')
    await items[0].trigger('click')
    await nextTick()

    // Click save
    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    expect(saveBtn).toBeDefined()
    await saveBtn!.trigger('click')

    // Custom model should update all fields
    expect(updateModelMock).toHaveBeenCalledWith('model-1', expect.objectContaining({
      name: 'GPT-4',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
    }))
  })

  it('save button in edit mode for builtin model only updates limited fields', async () => {
    mockModels.value = [
      {
        id: 'builtin-1',
        name: 'GPT-4 Builtin',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKey: '',
        modelName: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4096,
        isBuiltin: true,
        createdAt: Date.now(),
      },
    ]
    await nextTick()
    wrapper = mountComponent()

    // Click the builtin model
    const items = wrapper.findAll('.model-manager__item')
    await items[0].trigger('click')
    await nextTick()

    // Click save
    const buttons = wrapper.findAll('[data-testid="el-button"]')
    const saveBtn = buttons.find((btn) => btn.text().includes('Save'))
    await saveBtn!.trigger('click')

    // Builtin model should only update apiKey, temperature, maxTokens
    expect(updateModelMock).toHaveBeenCalledWith('builtin-1', expect.objectContaining({
      apiKey: '',
      temperature: 0.7,
      maxTokens: 4096,
    }))
    // Should NOT include name, provider, endpoint, modelName
    const call = updateModelMock.mock.calls[0][1] as Record<string, unknown>
    expect(call).not.toHaveProperty('name')
    expect(call).not.toHaveProperty('provider')
    expect(call).not.toHaveProperty('endpoint')
    expect(call).not.toHaveProperty('modelName')
  })
})
