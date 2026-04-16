export type MergedGeneratorResult<T> = AsyncGenerator<T>

interface RaceEntry<T> {
  promise: Promise<IteratorResult<T>>
  gen: AsyncGenerator<T>
  result: IteratorResult<T> | null
  error: unknown
}

export async function* mergeAsyncGenerators<T>(
  generators: AsyncGenerator<T>[],
): MergedGeneratorResult<T> {
  if (generators.length === 0) return

  const readers = new Map<Promise<IteratorResult<T>>, AsyncGenerator<T>>()

  for (const gen of generators) {
    readers.set(gen.next(), gen)
  }

  while (readers.size > 0) {
    const tagged: Promise<RaceEntry<T>>[] = []

    for (const [promise, gen] of readers) {
      tagged.push(
        promise
          .then((result): RaceEntry<T> => ({ promise, gen, result, error: null }))
          .catch((error: unknown): RaceEntry<T> => ({ promise, gen, result: null, error })),
      )
    }

    const winner = await Promise.race(tagged)
    readers.delete(winner.promise)

    if (winner.error !== null) {
      continue
    }

    if (winner.result!.done) {
      continue
    }

    yield winner.result!.value
    readers.set(winner.gen.next(), winner.gen)
  }
}
