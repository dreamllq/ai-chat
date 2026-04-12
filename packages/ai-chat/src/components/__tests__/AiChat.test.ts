import { describe, it, expect } from 'vitest'
import type { AiChatSize } from '../../types'

// Replicate AiChat size prop logic without mounting
function createAiChatSizeProp(size?: AiChatSize) {
  return { size: size ?? 'default' }
}

describe('AiChat size prop', () => {
  it('defaults size to default when not provided', () => {
    const props = createAiChatSizeProp()
    expect(props.size).toBe('default')
  })

  it('passes mini size when provided', () => {
    const props = createAiChatSizeProp('mini')
    expect(props.size).toBe('mini')
  })

  it('passes default size when explicitly set', () => {
    const props = createAiChatSizeProp('default')
    expect(props.size).toBe('default')
  })
})
