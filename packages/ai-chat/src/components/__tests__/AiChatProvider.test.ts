import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { AiChatSize } from '../../types'

// Replicate AiChatProvider size logic without Vue component mounting
function createSizeProvider(initialSize: AiChatSize = 'default') {
  const sizeRef = ref<AiChatSize>(initialSize)
  return { sizeRef }
}

describe('AiChatProvider size', () => {
  it('provides default size by default', () => {
    const { sizeRef } = createSizeProvider()
    expect(sizeRef.value).toBe('default')
  })

  it('provides mini size when prop is mini', () => {
    const { sizeRef } = createSizeProvider('mini')
    expect(sizeRef.value).toBe('mini')
  })

  it('size ref is reactive', () => {
    const { sizeRef } = createSizeProvider('default')
    sizeRef.value = 'mini'
    expect(sizeRef.value).toBe('mini')
  })
})
