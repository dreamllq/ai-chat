import { describe, it, expect } from 'vitest'

describe('Test Infrastructure', () => {
  it('vitest is configured correctly', () => {
    expect(true).toBe(true)
  })

  it('jsdom environment is available', () => {
    expect(typeof document).toBe('object')
    expect(typeof window).toBe('object')
  })

  it('fake-indexeddb is available', () => {
    expect(typeof indexedDB).toBe('object')
  })

  it('can create Vue component wrapper', async () => {
    const { mount } = await import('@vue/test-utils')
    const wrapper = mount({
      template: '<div>test</div>',
    })
    expect(wrapper.text()).toBe('test')
  })
})
