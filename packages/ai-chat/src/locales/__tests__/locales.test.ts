import { describe, it, expect } from 'vitest'
import { en } from '../en'
import { zhCn } from '../zh-cn'
import { ja } from '../ja'
import { localeInjectionKey, locales } from '../index'

function getDeepKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getDeepKeys(value as Record<string, unknown>, fullKey))
    }
    else {
      keys.push(fullKey)
    }
  }
  return keys
}

function getDeepValues(obj: Record<string, unknown>): unknown[] {
  const values: unknown[] = []
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      values.push(...getDeepValues(value as Record<string, unknown>))
    }
    else {
      values.push(value)
    }
  }
  return values
}

describe('Locales', () => {
  it('en locale is complete with no undefined values', () => {
    const values = getDeepValues(en as unknown as Record<string, unknown>)
    for (const value of values) {
      expect(value).toBeDefined()
      expect(value).not.toBe('')
    }
  })

  it('zh-cn has same keys as en', () => {
    const enKeys = getDeepKeys(en as unknown as Record<string, unknown>).sort()
    const zhKeys = getDeepKeys(zhCn as unknown as Record<string, unknown>).sort()
    expect(zhKeys).toEqual(enKeys)
  })

  it('ja has same keys as en', () => {
    const enKeys = getDeepKeys(en as unknown as Record<string, unknown>).sort()
    const jaKeys = getDeepKeys(ja as unknown as Record<string, unknown>).sort()
    expect(jaKeys).toEqual(enKeys)
  })

  it('all subAgent values are non-empty strings in every locale', () => {
    for (const locale of [en, zhCn, ja]) {
      for (const [key, value] of Object.entries(locale.subAgent)) {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
      }
    }
  })

  it('localeInjectionKey is a Symbol', () => {
    expect(typeof localeInjectionKey).toBe('symbol')
  })

  it('locales record contains all 3 languages', () => {
    expect(Object.keys(locales)).toEqual(['zh-cn', 'en', 'ja'])
    expect(locales['zh-cn']).toBe(zhCn)
    expect(locales.en).toBe(en)
    expect(locales.ja).toBe(ja)
  })
})
