import { inject, type InjectionKey } from 'vue'

export const chatIdKey: InjectionKey<string> = Symbol('chatId')

export function useChatId(): string {
  return inject(chatIdKey, 'default')
}
