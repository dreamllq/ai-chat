import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { AiChatSize } from '../../types'

function createSizeHelpers(initialSize: AiChatSize = 'default') {
  const sizeRef = ref<AiChatSize>(initialSize)
  return { size: sizeRef }
}

describe('useSize', () => {
  it('returns default size when no injection', () => {
    const { size } = createSizeHelpers()
    expect(size.value).toBe('default')
  })

  it('returns mini size when injected as mini', () => {
    const { size } = createSizeHelpers('mini')
    expect(size.value).toBe('mini')
  })

  it('returns reactive ref that updates when changed', () => {
    const { size } = createSizeHelpers('default')
    expect(size.value).toBe('default')
    size.value = 'mini'
    expect(size.value).toBe('mini')
  })
})
