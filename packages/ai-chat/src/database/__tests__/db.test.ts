import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { db } from '../db'

describe('Database Schema', () => {
  it('opens successfully', async () => {
    await db.open()
    expect(db.isOpen()).toBe(true)
    db.close()
  })

  it('has all 4 tables', () => {
    expect(db.tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['conversations', 'messages', 'models', 'agents'])
    )
    expect(db.tables.length).toBe(4)
  })

  it('has correct schema version', () => {
    expect(db.verno).toBe(1)
  })
})
