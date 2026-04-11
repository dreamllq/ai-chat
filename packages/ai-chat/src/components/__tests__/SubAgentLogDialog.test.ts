import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { db } from '../../database/db'
import type { SubAgentExecution } from '../../types'
import SubAgentLogDialog from '../SubAgentLogDialog.vue'

const mockT = vi.fn((path: string, params?: Record<string, string>) => {
  const map: Record<string, string> = {
    'subAgent.logTitle': 'Agent Execution Log',
    'subAgent.logTimeline': 'Timeline',
    'subAgent.logStart': 'Start',
    'subAgent.logToken': 'Token',
    'subAgent.logReasoning': 'Thinking',
    'subAgent.logToolCall': 'Tool Call',
    'subAgent.logToolResult': 'Tool Result',
    'subAgent.logDone': 'Done',
    'subAgent.logError': 'Error',
    'subAgent.running': 'Running',
    'subAgent.completed': 'Completed',
    'subAgent.failed': 'Failed',
    'subAgent.task': 'Task',
    'subAgent.output': 'Output',
    'subAgent.noLogs': 'No logs available',
    'subAgent.duration': 'Duration: {duration}',
  }
  let result = map[path] ?? path
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      result = result.replace(`{${key}}`, val)
    })
  }
  return result
})

vi.mock('../../composables/useLocale', () => ({
  useLocale: () => ({
    t: mockT,
    locale: { value: {} },
    setLocale: vi.fn(),
  }),
}))

function createExecution(overrides: Partial<SubAgentExecution> = {}): SubAgentExecution {
  return {
    id: 'exec-1',
    parentExecutionId: null,
    conversationId: 'conv-1',
    parentMessageId: 'msg-1',
    agentId: 'agent-1',
    agentName: 'Research Agent',
    task: 'Search for information',
    status: 'completed',
    startTime: 1000,
    endTime: 2500,
    output: 'Result found',
    reasoningContent: null,
    error: null,
    depth: 1,
    logs: [
      { timestamp: 1100, type: 'start', content: 'Starting task' },
      { timestamp: 1200, type: 'token', content: 'Processing...' },
      { timestamp: 1300, type: 'tool_call', content: 'search("query")' },
      { timestamp: 1400, type: 'tool_result', content: 'Found 3 results' },
      { timestamp: 1500, type: 'done', content: 'Task completed' },
    ],
    ...overrides,
  }
}

async function flushLiveQuery(): Promise<void> {
  await vi.waitFor(() => {}, { timeout: 200 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 50))
  await nextTick()
}

function mountDialog(props: { modelValue: boolean; executionId: string | null }) {
  return mount(SubAgentLogDialog, {
    props,
    global: {
      stubs: {
        ElDialog: {
          template: `
            <div v-if="modelValue" data-testid="sub-agent-log-dialog">
              <slot />
            </div>
          `,
          props: ['modelValue'],
        },
        ElScrollbar: {
          template: '<div class="el-scrollbar"><slot /></div>',
        },
        ElEmpty: {
          template: '<div data-testid="el-empty">{{ description }}</div>',
          props: ['description'],
        },
      },
    },
  })
}

describe('SubAgentLogDialog', () => {
  beforeEach(async () => {
    mockT.mockClear()
    await db.subAgentExecutions.clear()
  })

  it('does not render dialog content when modelValue is false', async () => {
    const execution = createExecution()
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: false, executionId: 'exec-1' })
    expect(wrapper.find('[data-testid="sub-agent-log-dialog"]').exists()).toBe(false)
  })

  it('loads and renders execution data when dialog is open', async () => {
    const execution = createExecution()
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    expect(wrapper.find('.sub-agent-log__agent-name').text()).toBe('Research Agent')
    expect(wrapper.find('.sub-agent-log__task').text()).toContain('Search for information')
  })

  it('renders timeline entries sorted by timestamp', async () => {
    const execution = createExecution({
      reasoningContent: null,
      logs: [
        { timestamp: 1500, type: 'done', content: 'Last' },
        { timestamp: 1100, type: 'start', content: 'First' },
        { timestamp: 1300, type: 'tool_call', content: 'Middle' },
      ],
    })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    const entries = wrapper.findAll('.sub-agent-log__entry')
    expect(entries).toHaveLength(3)
    expect(entries[0].find('.sub-agent-log__entry-content').text()).toBe('First')
    expect(entries[1].find('.sub-agent-log__entry-content').text()).toBe('Middle')
    expect(entries[2].find('.sub-agent-log__entry-content').text()).toBe('Last')
  })

  it('shows different icons for different log types', async () => {
    const execution = createExecution({
      logs: [
        { timestamp: 1100, type: 'start', content: 's' },
        { timestamp: 1200, type: 'error', content: 'e' },
        { timestamp: 1300, type: 'done', content: 'd' },
      ],
    })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    const entries = wrapper.findAll('.sub-agent-log__entry')
    expect(entries[0].find('.sub-agent-log__entry-icon').text()).toBe('🟢')
    expect(entries[1].find('.sub-agent-log__entry-icon').text()).toBe('❌')
    expect(entries[2].find('.sub-agent-log__entry-icon').text()).toBe('✅')
  })

  it('applies different CSS classes for different log types', async () => {
    const execution = createExecution({
      logs: [
        { timestamp: 1100, type: 'start', content: 's' },
        { timestamp: 1200, type: 'tool_call', content: 'tc' },
        { timestamp: 1400, type: 'tool_result', content: 'tr' },
        { timestamp: 1500, type: 'done', content: 'd' },
        { timestamp: 1600, type: 'error', content: 'e' },
      ],
    })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    const entries = wrapper.findAll('.sub-agent-log__entry')
    expect(entries[0].classes()).toContain('sub-agent-log__entry--start')
    expect(entries[1].classes()).toContain('sub-agent-log__entry--tool-call')
    expect(entries[2].classes()).toContain('sub-agent-log__entry--tool-result')
    expect(entries[3].classes()).toContain('sub-agent-log__entry--done')
    expect(entries[4].classes()).toContain('sub-agent-log__entry--error')
  })

  it('emits update:modelValue with false when dialog closes', async () => {
    const execution = createExecution()
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    await wrapper.vm.$emit('update:modelValue', false)

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('shows empty state when execution is not found', async () => {
    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-nonexistent' })
    await flushLiveQuery()

    expect(wrapper.find('[data-testid="el-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="el-empty"]').text()).toBe('No logs available')
  })

  it('shows no logs message when execution has empty logs', async () => {
    const execution = createExecution({ logs: [] })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    expect(wrapper.find('.sub-agent-log__empty').text()).toBe('No logs available')
  })

  it('displays output section when output is present', async () => {
    const execution = createExecution({
      output: 'The answer is 42',
      logs: [
        { timestamp: 1100, type: 'start', content: 'Starting task' },
        { timestamp: 1200, type: 'token', content: 'The answer is 42' },
        { timestamp: 1500, type: 'done', content: 'Task completed' },
      ],
    })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    expect(wrapper.find('.sub-agent-log__step').exists()).toBe(true)
    expect(wrapper.find('.sub-agent-log__bubble-content').text()).toContain('The answer is 42')
  })

  it('does not display output section when output is null and logs are empty', async () => {
    const execution = createExecution({ output: null, logs: [] })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    expect(wrapper.find('.sub-agent-log__step').exists()).toBe(false)
  })

  it('reconstructs output from logs when iteration markers are present', async () => {
    const execution = createExecution({
      output: 'Step1 output Step2 answer',
      reasoningContent: null,
      logs: [
        { timestamp: 1000, type: 'iteration_start', content: 'Iteration 1' },
        { timestamp: 1100, type: 'token', content: 'Step1 output ' },
        { timestamp: 1200, type: 'iteration_start', content: 'Iteration 2' },
        { timestamp: 1300, type: 'token', content: 'Step2 answer' },
        { timestamp: 1400, type: 'done', content: '' },
      ],
    })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    const steps = wrapper.findAll('.sub-agent-log__step')
    expect(steps).toHaveLength(2)
    expect(steps[0].find('.sub-agent-log__bubble-content').text()).toContain('Step1 output')
    expect(steps[1].find('.sub-agent-log__bubble-content').text()).toContain('Step2 answer')
  })

  it('displays error section when error is present', async () => {
    const execution = createExecution({ error: 'Something went wrong', status: 'failed' })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    expect(wrapper.find('.sub-agent-log__error').exists()).toBe(true)
    expect(wrapper.find('.sub-agent-log__error-content').text()).toBe('Something went wrong')
  })

  it('formats timestamps as HH:mm:ss', async () => {
    const ts = new Date(2025, 5, 15, 14, 30, 45).getTime()
    const execution = createExecution({
      logs: [{ timestamp: ts, type: 'start', content: 'started' }],
    })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    expect(wrapper.find('.sub-agent-log__entry-time').text()).toBe('14:30:45')
  })

  it('does not render sub-agent-log when executionId is null', async () => {
    const wrapper = mountDialog({ modelValue: true, executionId: null })
    await flushLiveQuery()

    expect(wrapper.find('.sub-agent-log').exists()).toBe(false)
  })

  it('reactively updates when DB record changes', async () => {
    const execution = createExecution({ status: 'running', output: null, endTime: null, logs: [] })
    await db.subAgentExecutions.add(execution)

    const wrapper = mountDialog({ modelValue: true, executionId: 'exec-1' })
    await flushLiveQuery()

    expect(wrapper.find('.sub-agent-log__status--running').exists()).toBe(true)
    expect(wrapper.find('.sub-agent-log__step').exists()).toBe(false)

    await db.subAgentExecutions.update('exec-1', {
      status: 'completed',
      output: 'Done!',
      endTime: 3000,
    })
    await flushLiveQuery()

    expect(wrapper.find('.sub-agent-log__status--completed').exists()).toBe(true)
    expect(wrapper.find('.sub-agent-log__step').exists()).toBe(true)
    expect(wrapper.find('.sub-agent-log__bubble-content').text()).toContain('Done!')
  })
})
