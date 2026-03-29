import { ref, onUnmounted, type Ref } from 'vue'
import { liveQuery } from 'dexie'

/**
 * Wraps a Dexie liveQuery into a Vue reactive ref.
 * Subscribes to the observable and auto-unsubscribes on component unmount.
 */
export function useObservable<T>(querier: () => T | Promise<T>): Ref<T | undefined> {
  const data = ref<T | undefined>(undefined) as Ref<T | undefined>

  const observable = liveQuery(querier)
  const subscription = observable.subscribe({
    next: (value) => {
      data.value = value
    },
  })

  onUnmounted(() => {
    subscription.unsubscribe()
  })

  return data
}
