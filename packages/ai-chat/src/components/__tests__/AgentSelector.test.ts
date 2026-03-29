import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AgentDefinition } from '../../types'
import AgentSelector from '../AgentSelector.vue'

// Mock agentRegistry
const mockGetAllDefinitions = vi.fn()

vi.mock('../../services/agent', () => ({
  agentRegistry: {
    getAllDefinitions: () => mockGetAllDefinitions(),
  },
}))

// Mock useLocale
const mockT = vi.fn((path: string) => {
  const map: Record<string, string> = {
    'agent.select': 'Select Agent',
    'agent.builtin': 'Built-in',
    'agent.custom': 'Custom',
  }
  return map[path] ?? path
})

vi.mock('../../composables/useLocale', () => ({
  useLocale: () => ({
    t: mockT,
    locale: { value: {} },
    setLocale: vi.fn(),
  }),
}))

// Element Plus stubs
const ElSelectStub = {
  name: 'ElSelect',
  template: `
    <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <slot />
    </select>
  `,
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue', 'change'],
}

const ElOptionStub = {
  name: 'ElOption',
  template: '<option :value="value"><slot /></option>',
  props: ['value', 'label'],
}

const ElTagStub = {
  name: 'ElTag',
  template: '<span class="el-tag"><slot /></span>',
  props: ['type', 'size'],
}

function mountAgentSelector(props: Record<string, unknown> = {}) {
  return mount(AgentSelector, {
    props: {
      ...props,
    },
    global: {
      stubs: {
        ElSelect: ElSelectStub,
        ElOption: ElOptionStub,
        ElTag: ElTagStub,
      },
    },
  })
}

const builtinAgent: AgentDefinition = {
  id: 'builtin-chat',
  name: 'Chat Agent',
  description: 'A built-in chat agent',
  isBuiltin: true,
}

const customAgent: AgentDefinition = {
  id: 'custom-agent',
  name: 'Custom Agent',
  description: 'A custom agent',
  isBuiltin: false,
}

const agentNoDesc: AgentDefinition = {
  id: 'simple-agent',
  name: 'Simple Agent',
}

describe('AgentSelector', () => {
  beforeEach(() => {
    mockGetAllDefinitions.mockReset()
    mockT.mockClear()
  })

  it('renders agent list from registry', () => {
    mockGetAllDefinitions.mockReturnValue([builtinAgent, customAgent])

    const wrapper = mountAgentSelector()
    const options = wrapper.findAllComponents({ name: 'ElOption' })

    expect(options).toHaveLength(2)
    expect(options[0].props('value')).toBe('builtin-chat')
    expect(options[1].props('value')).toBe('custom-agent')
  })

  it('displays agent name and description', () => {
    mockGetAllDefinitions.mockReturnValue([builtinAgent])

    const wrapper = mountAgentSelector()
    const option = wrapper.findComponent({ name: 'ElOption' })

    expect(option.props('label')).toBe('Chat Agent')
    // Check that description text appears in the option content
    expect(option.text()).toContain('Chat Agent')
    expect(option.text()).toContain('A built-in chat agent')
  })

  it('shows built-in badge for built-in agents', () => {
    mockGetAllDefinitions.mockReturnValue([builtinAgent])

    const wrapper = mountAgentSelector()
    const tags = wrapper.findAllComponents({ name: 'ElTag' })

    expect(tags.length).toBeGreaterThanOrEqual(1)
    expect(tags[0].text()).toBe('Built-in')
  })

  it('does not show built-in badge for custom agents', () => {
    mockGetAllDefinitions.mockReturnValue([customAgent])

    const wrapper = mountAgentSelector()
    const tags = wrapper.findAllComponents({ name: 'ElTag' })

    // Custom agent should not have a Built-in tag
    const builtinTags = tags.filter(t => t.text() === 'Built-in')
    expect(builtinTags).toHaveLength(0)
  })

  it('emits update:modelValue when selection changes', async () => {
    mockGetAllDefinitions.mockReturnValue([builtinAgent, customAgent])

    const wrapper = mountAgentSelector()
    const select = wrapper.findComponent({ name: 'ElSelect' })

    select.vm.$emit('update:modelValue', 'custom-agent')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['custom-agent'])
  })

  it('pre-selects the modelValue agent', () => {
    mockGetAllDefinitions.mockReturnValue([builtinAgent, customAgent])

    const wrapper = mountAgentSelector({ modelValue: 'custom-agent' })
    const select = wrapper.findComponent({ name: 'ElSelect' })

    expect(select.props('modelValue')).toBe('custom-agent')
  })

  it('shows placeholder when no modelValue is set', () => {
    mockGetAllDefinitions.mockReturnValue([builtinAgent])

    const wrapper = mountAgentSelector()
    const select = wrapper.findComponent({ name: 'ElSelect' })

    expect(select.props('placeholder')).toBe('Select Agent')
  })

  it('renders without description when agent has no description', () => {
    mockGetAllDefinitions.mockReturnValue([agentNoDesc])

    const wrapper = mountAgentSelector()
    const option = wrapper.findComponent({ name: 'ElOption' })

    expect(option.props('value')).toBe('simple-agent')
    expect(option.text()).toContain('Simple Agent')
  })

  it('renders multiple agents with correct count', () => {
    mockGetAllDefinitions.mockReturnValue([builtinAgent, customAgent, agentNoDesc])

    const wrapper = mountAgentSelector()
    const options = wrapper.findAllComponents({ name: 'ElOption' })

    expect(options).toHaveLength(3)
  })

  it('uses useLocale for placeholder text', () => {
    mockGetAllDefinitions.mockReturnValue([])

    mountAgentSelector()

    expect(mockT).toHaveBeenCalledWith('agent.select')
  })
})
