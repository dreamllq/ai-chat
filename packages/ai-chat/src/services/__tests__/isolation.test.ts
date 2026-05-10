import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../database/db'
import { ConversationService, MessageService, AgentService, SubAgentExecutionService } from '../database'

const conversationService = new ConversationService()
const messageService = new MessageService()
const agentService = new AgentService()
const subAgentExecutionService = new SubAgentExecutionService()

beforeEach(async () => {
  await db.conversations.clear()
  await db.messages.clear()
  await db.agents.clear()
  await db.subAgentExecutions.clear()
})

describe('Multi-instance data isolation', () => {
  it('ConversationService.getAll returns only conversations for given chatId', async () => {
    await conversationService.create({ chatId: 'instance-A', title: 'A-Conv1', agentId: 'a1', modelId: 'm1' })
    await conversationService.create({ chatId: 'instance-A', title: 'A-Conv2', agentId: 'a2', modelId: 'm2' })
    await conversationService.create({ chatId: 'instance-B', title: 'B-Conv1', agentId: 'b1', modelId: 'm1' })

    const aConvs = await conversationService.getAll('instance-A')
    const bConvs = await conversationService.getAll('instance-B')
    const defaultConvs = await conversationService.getAll('default')

    expect(aConvs).toHaveLength(2)
    expect(aConvs.map(c => c.title)).toEqual(expect.arrayContaining(['A-Conv1', 'A-Conv2']))
    expect(bConvs).toHaveLength(1)
    expect(bConvs[0].title).toBe('B-Conv1')
    expect(defaultConvs).toHaveLength(0)
  })

  it('ConversationService.deleteAll only deletes conversations for given chatId', async () => {
    await conversationService.create({ chatId: 'instance-A', title: 'A-Conv', agentId: 'a1', modelId: 'm1' })
    await conversationService.create({ chatId: 'instance-B', title: 'B-Conv', agentId: 'b1', modelId: 'm1' })

    await conversationService.deleteAll('instance-A')

    const aConvs = await conversationService.getAll('instance-A')
    const bConvs = await conversationService.getAll('instance-B')

    expect(aConvs).toHaveLength(0)
    expect(bConvs).toHaveLength(1)
    expect(bConvs[0].title).toBe('B-Conv')
  })

  it('deleteAll cascades messages for deleted conversations', async () => {
    const convA = await conversationService.create({ chatId: 'instance-A', title: 'A', agentId: 'a1', modelId: 'm1' })
    const convB = await conversationService.create({ chatId: 'instance-B', title: 'B', agentId: 'b1', modelId: 'm1' })

    await messageService.create({ chatId: 'instance-A', conversationId: convA.id, role: 'user', content: 'A-msg' })
    await messageService.create({ chatId: 'instance-B', conversationId: convB.id, role: 'user', content: 'B-msg' })

    await conversationService.deleteAll('instance-A')

    const aMsgs = await messageService.getByConversationId(convA.id)
    const bMsgs = await messageService.getByConversationId(convB.id)

    expect(aMsgs).toHaveLength(0)
    expect(bMsgs).toHaveLength(1)
    expect(bMsgs[0].content).toBe('B-msg')
  })

  it('AgentService.getAll returns only agents for given chatId', async () => {
    await agentService.create({ chatId: 'instance-A', name: 'Agent A1' })
    await agentService.create({ chatId: 'instance-A', name: 'Agent A2' })
    await agentService.create({ chatId: 'instance-B', name: 'Agent B1' })

    const aAgents = await agentService.getAll('instance-A')
    const bAgents = await agentService.getAll('instance-B')
    const defaultAgents = await agentService.getAll('default')

    expect(aAgents).toHaveLength(2)
    expect(aAgents.map(a => a.name)).toEqual(expect.arrayContaining(['Agent A1', 'Agent A2']))
    expect(bAgents).toHaveLength(1)
    expect(bAgents[0].name).toBe('Agent B1')
    expect(defaultAgents).toHaveLength(0)
  })

  it('messages with different chatIds in same conversation are distinguished', async () => {
    const conv = await conversationService.create({ chatId: 'instance-A', title: 'Shared Conv', agentId: 'a1', modelId: 'm1' })

    await messageService.create({ chatId: 'instance-A', conversationId: conv.id, role: 'user', content: 'A-message' })
    await messageService.create({ chatId: 'instance-B', conversationId: conv.id, role: 'user', content: 'B-message' })

    const msgs = await messageService.getByConversationId(conv.id)
    expect(msgs).toHaveLength(2)

    const aMsg = msgs.find(m => m.chatId === 'instance-A')
    const bMsg = msgs.find(m => m.chatId === 'instance-B')
    expect(aMsg).toBeDefined()
    expect(aMsg!.content).toBe('A-message')
    expect(bMsg).toBeDefined()
    expect(bMsg!.content).toBe('B-message')
  })

  it('default chatId works without explicit parameter in getAll', async () => {
    await conversationService.create({ chatId: 'default', title: 'Default Conv', agentId: 'a1', modelId: 'm1' })
    await conversationService.create({ chatId: 'other', title: 'Other Conv', agentId: 'a1', modelId: 'm1' })

    const defaults = await conversationService.getAll('default')
    expect(defaults).toHaveLength(1)
    expect(defaults[0].title).toBe('Default Conv')
  })

  it('SubAgentExecution records are isolated by chatId', async () => {
    await subAgentExecutionService.create({
      chatId: 'instance-A',
      parentExecutionId: null,
      conversationId: 'conv-1',
      parentMessageId: 'msg-1',
      agentId: 'agent-1',
      agentName: 'Agent A',
      task: 'Task A',
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      output: null,
      reasoningContent: null,
      error: null,
      depth: 0,
      logs: [],
    })

    await subAgentExecutionService.create({
      chatId: 'instance-B',
      parentExecutionId: null,
      conversationId: 'conv-2',
      parentMessageId: 'msg-2',
      agentId: 'agent-2',
      agentName: 'Agent B',
      task: 'Task B',
      status: 'completed',
      startTime: Date.now() - 1000,
      endTime: Date.now(),
      output: 'Result B',
      reasoningContent: null,
      error: null,
      depth: 0,
      logs: [],
    })

    const aExecs = await subAgentExecutionService.getByConversationId('conv-1')
    const bExecs = await subAgentExecutionService.getByConversationId('conv-2')

    expect(aExecs).toHaveLength(1)
    expect(aExecs[0].chatId).toBe('instance-A')
    expect(aExecs[0].task).toBe('Task A')

    expect(bExecs).toHaveLength(1)
    expect(bExecs[0].chatId).toBe('instance-B')
    expect(bExecs[0].task).toBe('Task B')
  })
})
