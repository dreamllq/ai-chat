import type { InjectionKey, Ref } from 'vue'
import type { AiChatSize } from '../types'
import { inject, ref } from 'vue'

export type { AiChatSize }

export const sizeInjectionKey: InjectionKey<Ref<AiChatSize>> = Symbol('aiChatSize')

export function useSize() {
  return inject(sizeInjectionKey, ref<AiChatSize>('default'))
}
