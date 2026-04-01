import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../database/db'
import { SubAgentExecutionService } from '../database'
import type { SubAgentExecution } from '../../types'

const service = new SubAgentExecutionService()

beforeEach(async () => {
  await db.table('subAgentExecutions').clear()
})

function makeExecution(
  overrides: Partial<Omit<SubAgentExecution, 'id'>> = {}
): Omit<SubAgentExecution, 'id'> {
  return {
    parentExecutionId: null,
    conversationId: 'conv-1',
    parentMessageId: 'msg-1',
    agentId: 'agent-1',
    agentName: 'Test Agent',
    task: 'Do something',
    status: 'running',
    startTime: Date.now(),
    endTime: null,
    output: null,
    error: null,
    depth: 0,
    logs: [],
    ...overrides,
  }
}

describe('SubAgentExecutionService', () => {
  // === create ===
  describe('create', () => {
    it('should create an execution record with auto-generated id', async () => {
      const data = makeExecution()
      const execution = await service.create(data)

      expect(execution.id).toBeDefined()
      expect(execution.id).toBeTypeOf('string')
      expect(execution.conversationId).toBe('conv-1')
      expect(execution.parentMessageId).toBe('msg-1')
      expect(execution.agentId).toBe('agent-1')
      expect(execution.agentName).toBe('Test Agent')
      expect(execution.task).toBe('Do something')
      expect(execution.status).toBe('running')
      expect(execution.startTime).toBeTypeOf('number')
      expect(execution.endTime).toBeNull()
      expect(execution.output).toBeNull()
      expect(execution.error).toBeNull()
      expect(execution.depth).toBe(0)
      expect(execution.logs).toEqual([])
    })

    it('should persist the execution in the database', async () => {
      const data = makeExecution()
      const created = await service.create(data)
      const found = await service.getById(created.id)

      expect(found).toBeDefined()
      expect(found!.id).toBe(created.id)
    })
  })

  // === getById ===
  describe('getById', () => {
    it('should return undefined for non-existent id', async () => {
      const found = await service.getById('non-existent-id')
      expect(found).toBeUndefined()
    })
  })

  // === getByParentMessageId ===
  describe('getByParentMessageId', () => {
    it('should retrieve executions by parentMessageId', async () => {
      await service.create(makeExecution({ parentMessageId: 'msg-1', task: 'Task A' }))
      await service.create(makeExecution({ parentMessageId: 'msg-1', task: 'Task B' }))
      await service.create(makeExecution({ parentMessageId: 'msg-2', task: 'Task C' }))

      const results = await service.getByParentMessageId('msg-1')

      expect(results).toHaveLength(2)
      expect(results.map((r) => r.task)).toEqual(expect.arrayContaining(['Task A', 'Task B']))
    })

    it('should return empty array for parentMessageId with no executions', async () => {
      const results = await service.getByParentMessageId('no-such-message')
      expect(results).toEqual([])
    })
  })

  // === getByConversationId ===
  describe('getByConversationId', () => {
    it('should retrieve executions by conversationId', async () => {
      await service.create(makeExecution({ conversationId: 'conv-1', task: 'Task A' }))
      await service.create(makeExecution({ conversationId: 'conv-2', task: 'Task B' }))

      const results = await service.getByConversationId('conv-1')

      expect(results).toHaveLength(1)
      expect(results[0].task).toBe('Task A')
    })

    it('should return empty array for conversation with no executions', async () => {
      const results = await service.getByConversationId('no-such-conv')
      expect(results).toEqual([])
    })
  })

  // === update ===
  describe('update', () => {
    it('should update status', async () => {
      const created = await service.create(makeExecution())
      await service.update(created.id, { status: 'completed' })

      const updated = await service.getById(created.id)
      expect(updated!.status).toBe('completed')
    })

    it('should update output and endTime', async () => {
      const created = await service.create(makeExecution())
      const endTime = Date.now()
      await service.update(created.id, { output: 'Result text', endTime })

      const updated = await service.getById(created.id)
      expect(updated!.output).toBe('Result text')
      expect(updated!.endTime).toBe(endTime)
    })

    it('should update error field', async () => {
      const created = await service.create(makeExecution())
      await service.update(created.id, { status: 'failed', error: 'Something went wrong' })

      const updated = await service.getById(created.id)
      expect(updated!.status).toBe('failed')
      expect(updated!.error).toBe('Something went wrong')
    })

    it('should update logs', async () => {
      const created = await service.create(makeExecution())
      const logs = [{ timestamp: Date.now(), type: 'start' as const, content: 'Started' }]
      await service.update(created.id, { logs })

      const updated = await service.getById(created.id)
      expect(updated!.logs).toEqual(logs)
    })
  })

  // === deleteByConversationId ===
  describe('deleteByConversationId', () => {
    it('should delete all executions for a conversation', async () => {
      await service.create(makeExecution({ conversationId: 'conv-1', task: 'A' }))
      await service.create(makeExecution({ conversationId: 'conv-1', task: 'B' }))
      await service.create(makeExecution({ conversationId: 'conv-2', task: 'C' }))

      await service.deleteByConversationId('conv-1')

      const conv1Results = await service.getByConversationId('conv-1')
      const conv2Results = await service.getByConversationId('conv-2')

      expect(conv1Results).toHaveLength(0)
      expect(conv2Results).toHaveLength(1)
      expect(conv2Results[0].task).toBe('C')
    })

    it('should handle deleting from a conversation with no executions', async () => {
      await service.deleteByConversationId('non-existent')
      // Should not throw
    })
  })
})
