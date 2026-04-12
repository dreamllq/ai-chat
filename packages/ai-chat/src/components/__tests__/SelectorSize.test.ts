import { describe, it, expect } from 'vitest'
import { ref, computed } from 'vue'
import type { AiChatSize } from '../../types'

function createSelectorSize(prefix: string, initialSize: AiChatSize = 'default') {
  const size = ref<AiChatSize>(initialSize)
  const selectorClasses = computed(() => ({ [`${prefix}--mini`]: size.value === 'mini' }))
  return { size, selectorClasses }
}

describe('Selector size (ModelSelector + AgentSelector)', () => {
  it('ModelSelector has no mini class by default', () => {
    const { selectorClasses } = createSelectorSize('model-selector')
    expect(selectorClasses.value['model-selector--mini']).toBe(false)
  })

  it('ModelSelector applies mini class when size is mini', () => {
    const { selectorClasses } = createSelectorSize('model-selector', 'mini')
    expect(selectorClasses.value['model-selector--mini']).toBe(true)
  })

  it('AgentSelector has no mini class by default', () => {
    const { selectorClasses } = createSelectorSize('agent-selector')
    expect(selectorClasses.value['agent-selector--mini']).toBe(false)
  })

  it('AgentSelector applies mini class when size is mini', () => {
    const { selectorClasses } = createSelectorSize('agent-selector', 'mini')
    expect(selectorClasses.value['agent-selector--mini']).toBe(true)
  })

  it('both react to size change', () => {
    const sharedSize = ref<AiChatSize>('default')
    const modelClasses = computed(() => ({ 'model-selector--mini': sharedSize.value === 'mini' }))
    const agentClasses = computed(() => ({ 'agent-selector--mini': sharedSize.value === 'mini' }))

    sharedSize.value = 'mini'
    expect(modelClasses.value['model-selector--mini']).toBe(true)
    expect(agentClasses.value['agent-selector--mini']).toBe(true)

    sharedSize.value = 'default'
    expect(modelClasses.value['model-selector--mini']).toBe(false)
    expect(agentClasses.value['agent-selector--mini']).toBe(false)
  })
})
