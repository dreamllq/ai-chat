import { describe, it, expect } from 'vitest'
import type {
  ChatChunk,
  SubAgentExecution,
  SubAgentLogEntry,
  SubAgentCallInfo,
} from '../../index'

describe('SubAgent Types', () => {
  it('ChatChunk should accept sub_agent_start type', () => {
    const chunk: ChatChunk = {
      type: 'sub_agent_start',
      subAgent: {
        executionId: 'exec-1',
        agentId: 'agent-1',
        agentName: 'Test Agent',
        task: 'Do something',
        status: 'running',
        startTime: Date.now(),
        endTime: null,
        depth: 1,
      },
    }
    expect(chunk.type).toBe('sub_agent_start')
    expect(chunk.subAgent).toBeDefined()
  })

  it('ChatChunk should accept sub_agent_log type', () => {
    const chunk: ChatChunk = {
      type: 'sub_agent_log',
      subAgent: {
        executionId: 'exec-1',
        agentId: 'agent-1',
        agentName: 'Test Agent',
        task: 'Do something',
        status: 'running',
        startTime: Date.now(),
        endTime: null,
        depth: 1,
      },
      logEntry: {
        timestamp: Date.now(),
        type: 'token',
        content: 'Hello',
      },
    }
    expect(chunk.type).toBe('sub_agent_log')
    expect(chunk.logEntry).toBeDefined()
  })

  it('ChatChunk should accept sub_agent_end type', () => {
    const chunk: ChatChunk = {
      type: 'sub_agent_end',
      subAgent: {
        executionId: 'exec-1',
        agentId: 'agent-1',
        agentName: 'Test Agent',
        task: 'Do something',
        status: 'completed',
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        depth: 1,
      },
    }
    expect(chunk.type).toBe('sub_agent_end')
  })

  it('SubAgentExecution has all required fields', () => {
    const execution: SubAgentExecution = {
      id: 'exec-1',
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
      depth: 1,
      logs: [],
    }
    expect(execution.id).toBe('exec-1')
    expect(execution.status).toBe('running')
  })

  it('SubAgentLogEntry has correct structure', () => {
    const entry: SubAgentLogEntry = {
      timestamp: Date.now(),
      type: 'tool_call',
      content: 'Called calculator',
    }
    expect(entry.type).toBe('tool_call')
  })

  it('SubAgentCallInfo has correct structure', () => {
    const info: SubAgentCallInfo = {
      executionId: 'exec-1',
      agentId: 'agent-1',
      agentName: 'Test Agent',
      task: 'Do something',
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      depth: 1,
    }
    expect(info.depth).toBe(1)
  })

  it('existing ChatChunk token type still works', () => {
    const chunk: ChatChunk = { type: 'token', content: 'hello' }
    expect(chunk.type).toBe('token')
  })

  it('existing ChatChunk done type still works', () => {
    const chunk: ChatChunk = { type: 'done' }
    expect(chunk.type).toBe('done')
  })

  it('existing ChatChunk error type still works', () => {
    const chunk: ChatChunk = { type: 'error', error: 'Something failed' }
    expect(chunk.type).toBe('error')
  })
})
