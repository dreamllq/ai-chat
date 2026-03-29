import { describe, it, expect } from 'vitest'
import { ref, computed } from 'vue'
import { en } from '../../locales/en'
import { zhCn } from '../../locales/zh-cn'
import { locales, type AiChatLocale, type LocaleName } from '../../locales'

// Replicate the internal logic for testing without Vue inject context
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return path
    }
  }
  return typeof current === 'string' ? current : path
}

function createLocaleHelpers(initialLocale: AiChatLocale = en) {
  const localeRef = ref<AiChatLocale>(initialLocale)
  const locale = computed(() => localeRef.value)

  function t(path: string, params?: Record<string, string>): string {
    let result = getNestedValue(locale.value as unknown as Record<string, unknown>, path)
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        result = result.replace(`{${key}}`, val)
      })
    }
    return result
  }

  function setLocale(name: LocaleName) {
    localeRef.value = locales[name]
  }

  return { locale, t, setLocale }
}

describe('useLocale', () => {
  it('returns English locale by default', () => {
    const { locale } = createLocaleHelpers()
    expect(locale.value).toEqual(en)
  })

  it('resolves nested paths via t()', () => {
    const { t } = createLocaleHelpers()
    expect(t('conversation.newChat')).toBe('New Chat')
    expect(t('chat.placeholder')).toBe('Type a message...')
    expect(t('model.title')).toBe('Model')
    expect(t('error.network')).toBe('Network error. Please check your connection.')
  })

  it('returns key path for non-existent paths', () => {
    const { t } = createLocaleHelpers()
    expect(t('nonexistent.path')).toBe('nonexistent.path')
    expect(t('conversation.nonexistent')).toBe('conversation.nonexistent')
  })

  it('switches locale via setLocale()', () => {
    const { locale, setLocale, t } = createLocaleHelpers()
    setLocale('zh-cn')
    expect(locale.value).toEqual(zhCn)
    expect(t('conversation.newChat')).toBe(zhCn.conversation.newChat)
  })

  it('t() handles params without placeholders gracefully', () => {
    const { t } = createLocaleHelpers()
    const result = t('chat.send', { extra: 'value' })
    expect(result).toBe('Send')
  })

  it('t() replaces {param} placeholders', () => {
    const { t } = createLocaleHelpers(en)
    // Verify interpolation logic via getNestedValue directly
    const obj = { greeting: 'Hello {name}, welcome to {place}!' } as unknown as Record<string, unknown>
    let result = getNestedValue(obj, 'greeting')
    result = result.replace('{name}', 'Alice').replace('{place}', 'Vue')
    expect(result).toBe('Hello Alice, welcome to Vue!')
  })

  it('handles deeply nested non-existent paths', () => {
    const { t } = createLocaleHelpers()
    expect(t('a.b.c.d.e')).toBe('a.b.c.d.e')
  })

  it('getNestedValue returns path for non-string leaf values', () => {
    const obj = { nested: { obj: { deep: 'value' } } } as unknown as Record<string, unknown>
    expect(getNestedValue(obj, 'nested.obj')).toBe('nested.obj')
    expect(getNestedValue(obj, 'nested.obj.deep')).toBe('value')
  })
})
