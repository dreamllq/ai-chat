import type { InjectionKey, Ref } from 'vue'
import type { AiChatLocale } from './en'
import { zhCn } from './zh-cn'
import { en } from './en'
import { ja } from './ja'

export type { AiChatLocale }

export type LocaleName = 'zh-cn' | 'en' | 'ja'

export const localeInjectionKey: InjectionKey<Ref<AiChatLocale>> = Symbol('aiChatLocale')

export const locales: Record<LocaleName, AiChatLocale> = { 'zh-cn': zhCn, en, ja }

const localeInstructions: Record<string, string> = {
  'zh-cn': 'Please respond in Simplified Chinese (zh-CN).',
  'en': 'Please respond in English.',
  'ja': 'Please respond in Japanese.',
}

export function getLocaleInstruction(locale: string): string {
  return localeInstructions[locale] ?? localeInstructions['en']
}

// Re-export individual locales
export { zhCn } from './zh-cn'
export { en } from './en'
export { ja } from './ja'
