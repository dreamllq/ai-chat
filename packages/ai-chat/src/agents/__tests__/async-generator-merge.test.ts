import { describe, it, expect } from 'vitest'
import { mergeAsyncGenerators } from '../async-generator-merge'

/** Helper: create an async generator that yields values with optional delays */
async function* createGenerator<T>(
  values: T[],
  delayMs: number = 0,
): AsyncGenerator<T> {
  for (const value of values) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    yield value
  }
}

/** Helper: create a generator that throws after yielding some values */
async function* createThrowingGenerator<T>(
  values: T[],
  delayMs: number = 0,
  errorMessage: string = 'Generator error',
): AsyncGenerator<T> {
  for (const value of values) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    yield value
  }
  throw new Error(errorMessage)
}

/** Helper: collect all values from an async generator */
async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = []
  for await (const value of gen) {
    results.push(value)
  }
  return results
}

describe('mergeAsyncGenerators', () => {
  it('should interleave values from two generators and collect all values', async () => {
    const gen1 = createGenerator([1, 2, 3], 5)
    const gen2 = createGenerator([4, 5, 6], 5)

    const results = await collect(mergeAsyncGenerators([gen1, gen2]))

    // Order may vary due to race, but all values must be present
    expect(results.sort()).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('should handle one generator finishing first while the other continues', async () => {
    // genA finishes quickly with 2 values, genB yields 4 values slowly
    const genA = createGenerator([1, 2], 1)
    const genB = createGenerator([3, 4, 5, 6], 10)

    const results = await collect(mergeAsyncGenerators([genA, genB]))

    expect(results.sort()).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('should yield nothing for empty array (zero generators)', async () => {
    const results = await collect(mergeAsyncGenerators<number>([]))

    expect(results).toEqual([])
  })

  it('should pass through all values from a single generator unchanged', async () => {
    const gen = createGenerator(['a', 'b', 'c', 'd'], 0)

    const results = await collect(mergeAsyncGenerators([gen]))

    expect(results).toEqual(['a', 'b', 'c', 'd'])
  })

  it('should continue other generators when one throws after yielding some values', async () => {
    // gen1: yields 1, 2 normally
    const gen1 = createGenerator([1, 2], 5)
    // gen2: yields 10, 20 then throws
    const gen2 = createThrowingGenerator([10, 20], 5, 'boom')
    // gen3: yields 100, 200, 300 normally
    const gen3 = createGenerator([100, 200, 300], 5)

    const results = await collect(mergeAsyncGenerators([gen1, gen2, gen3]))

    // gen2's values (10, 20) should be collected, plus all from gen1 and gen3
    expect(results.sort((a, b) => a - b)).toEqual([1, 2, 10, 20, 100, 200, 300])
  })

  it('should handle generators that all throw', async () => {
    const gen1 = createThrowingGenerator([1], 0, 'error-1')
    const gen2 = createThrowingGenerator([2], 0, 'error-2')

    const results = await collect(mergeAsyncGenerators([gen1, gen2]))

    // Values before errors should still be collected
    expect(results.sort()).toEqual([1, 2])
  })

  it('should handle generators with no values (immediately done)', async () => {
    const gen1 = createGenerator<number>([], 0)
    const gen2 = createGenerator([1, 2, 3], 0)

    const results = await collect(mergeAsyncGenerators([gen1, gen2]))

    expect(results).toEqual([1, 2, 3])
  })
})
