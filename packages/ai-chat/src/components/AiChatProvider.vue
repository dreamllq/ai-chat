<script setup lang="ts">
import { provide, ref } from 'vue'
import { localeInjectionKey, type AiChatLocale, type LocaleName, locales } from '../locales'

const props = withDefaults(defineProps<{
  locale?: AiChatLocale | LocaleName
}>(), {
  locale: 'en',
})

const localeRef = ref<AiChatLocale>(
  typeof props.locale === 'string' ? locales[props.locale] : props.locale
)

provide(localeInjectionKey, localeRef)
</script>

<template>
  <slot />
</template>
