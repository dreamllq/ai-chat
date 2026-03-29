import { inject, computed, ref, type Ref } from 'vue'
import { localeInjectionKey, en, type AiChatLocale, type LocaleName, locales } from '../locales'

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

export function useLocale() {
  const injectedLocale = inject(localeInjectionKey, ref(en)) as Ref<AiChatLocale>
  const locale = computed(() => injectedLocale.value)

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
    injectedLocale.value = locales[name]
  }

  return { locale, t, setLocale }
}
