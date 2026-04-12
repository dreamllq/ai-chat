<script setup lang="ts">
import { provide, ref, watch } from 'vue'
import { localeInjectionKey, type AiChatLocale, type LocaleName, locales } from '../locales'
import { sizeInjectionKey } from '../size'
import type { AiChatSize } from '../types'

const STORAGE_KEY = 'ai-chat-locale'

function resolveLocale(value: AiChatLocale | LocaleName): AiChatLocale {
  return typeof value === 'string' ? locales[value] : value
}

function getInitialLocale(): AiChatLocale {
  // Prefer persisted locale name from localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in locales) {
      return locales[saved as LocaleName]
    }
  } catch { /* localStorage unavailable */ }
  return resolveLocale(props.locale)
}

const props = withDefaults(defineProps<{
  locale?: AiChatLocale | LocaleName
  size?: AiChatSize
}>(), {
  locale: 'en',
  size: 'default',
})

const localeRef = ref<AiChatLocale>(getInitialLocale())

// React to prop changes (parent switches locale)
watch(() => props.locale, (val) => {
  localeRef.value = resolveLocale(val)
})

provide(localeInjectionKey, localeRef)

const sizeRef = ref<AiChatSize>(props.size)

watch(() => props.size, (val) => {
  sizeRef.value = val ?? 'default'
})

provide(sizeInjectionKey, sizeRef)
</script>

<template>
  <slot />
</template>
