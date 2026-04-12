import { describe, it, expect } from 'vitest'
import { ref, computed } from 'vue'
import type { AiChatSize } from '../../types'

function createDialogSize(initialSize: AiChatSize = 'default') {
  const size = ref<AiChatSize>(initialSize)
  const dialogWidth = computed(() => size.value === 'mini' ? '480px' : '640px')
  const dialogClasses = computed(() => ({ 'sub-agent-log-dialog--mini': size.value === 'mini' }))
  const managerClasses = computed(() => ({ 'model-manager--mini': size.value === 'mini' }))
  return { size, dialogWidth, dialogClasses, managerClasses }
}

describe('Dialog size', () => {
  it('SubAgentLogDialog uses 640px width by default', () => {
    const { dialogWidth } = createDialogSize()
    expect(dialogWidth.value).toBe('640px')
  })

  it('SubAgentLogDialog uses 480px width in mini mode', () => {
    const { dialogWidth } = createDialogSize('mini')
    expect(dialogWidth.value).toBe('480px')
  })

  it('SubAgentLogDialog applies mini class when mini', () => {
    const { dialogClasses } = createDialogSize('mini')
    expect(dialogClasses.value['sub-agent-log-dialog--mini']).toBe(true)
  })

  it('ModelManager applies mini class when mini', () => {
    const { managerClasses } = createDialogSize('mini')
    expect(managerClasses.value['model-manager--mini']).toBe(true)
  })

  it('no mini classes by default', () => {
    const { dialogClasses, managerClasses } = createDialogSize()
    expect(dialogClasses.value['sub-agent-log-dialog--mini']).toBe(false)
    expect(managerClasses.value['model-manager--mini']).toBe(false)
  })

  it('reacts to size change', () => {
    const { size, dialogWidth, dialogClasses, managerClasses } = createDialogSize()
    expect(dialogWidth.value).toBe('640px')
    size.value = 'mini'
    expect(dialogWidth.value).toBe('480px')
    expect(dialogClasses.value['sub-agent-log-dialog--mini']).toBe(true)
    expect(managerClasses.value['model-manager--mini']).toBe(true)
  })
})
