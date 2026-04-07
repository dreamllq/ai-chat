import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../database/db'
import { ConversationService, MessageService, ModelService, AgentService } from '../database'

const conversationService = new ConversationService()
const messageService = new MessageService()
const modelService = new ModelService()
const agentService = new AgentService()

beforeEach(async () => {
  await db.conversations.clear()
  await db.messages.clear()
  await db.models.clear()
  await db.agents.clear()
})

// === ConversationService ===
describe('ConversationService', () => {
  it('should create a conversation with auto-generated id and timestamps', async () => {
    const conv = await conversationService.create({
      title: 'Test Chat',
      agentId: 'agent-1',
      modelId: 'model-1',
    })

    expect(conv.id).toBeDefined()
    expect(conv.title).toBe('Test Chat')
    expect(conv.agentId).toBe('agent-1')
    expect(conv.modelId).toBe('model-1')
    expect(conv.createdAt).toBeTypeOf('number')
    expect(conv.updatedAt).toBeTypeOf('number')
    expect(conv.createdAt).toBe(conv.updatedAt)
  })

  it('should get all conversations', async () => {
    await conversationService.create({ title: 'A', agentId: 'a1', modelId: 'm1' })
    await conversationService.create({ title: 'B', agentId: 'a2', modelId: 'm2' })

    const all = await conversationService.getAll()
    expect(all).toHaveLength(2)
    expect(all.map((c) => c.title)).toEqual(expect.arrayContaining(['A', 'B']))
  })

  it('should get conversation by id', async () => {
    const created = await conversationService.create({ title: 'Find Me', agentId: 'a1', modelId: 'm1' })
    const found = await conversationService.getById(created.id)

    expect(found).toBeDefined()
    expect(found!.title).toBe('Find Me')
  })

  it('should return undefined for non-existent id', async () => {
    const found = await conversationService.getById('non-existent-id')
    expect(found).toBeUndefined()
  })

  it('should update a conversation and bump updatedAt', async () => {
    const created = await conversationService.create({ title: 'Old', agentId: 'a1', modelId: 'm1' })

    // Small delay to ensure updatedAt differs
    await new Promise((r) => setTimeout(r, 5))

    await conversationService.update(created.id, { title: 'New' })
    const updated = await conversationService.getById(created.id)

    expect(updated!.title).toBe('New')
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)
  })

  it('should delete a conversation', async () => {
    const created = await conversationService.create({ title: 'ToDelete', agentId: 'a1', modelId: 'm1' })
    await conversationService.delete(created.id)

    const found = await conversationService.getById(created.id)
    expect(found).toBeUndefined()
  })

  it('should cascade delete messages when conversation is deleted', async () => {
    const conv = await conversationService.create({ title: 'With Messages', agentId: 'a1', modelId: 'm1' })

    await messageService.create({ conversationId: conv.id, role: 'user', content: 'Hello' })
    await messageService.create({ conversationId: conv.id, role: 'assistant', content: 'Hi there' })

    await conversationService.delete(conv.id)

    const remainingMessages = await messageService.getByConversationId(conv.id)
    expect(remainingMessages).toHaveLength(0)
  })

  it('should return empty array when no conversations exist', async () => {
    const all = await conversationService.getAll()
    expect(all).toEqual([])
  })
})

// === MessageService ===
describe('MessageService', () => {
  it('should create a message with auto-generated id and timestamp', async () => {
    const msg = await messageService.create({
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello',
    })

    expect(msg.id).toBeDefined()
    expect(msg.conversationId).toBe('conv-1')
    expect(msg.role).toBe('user')
    expect(msg.content).toBe('Hello')
    expect(msg.timestamp).toBeTypeOf('number')
  })

  it('should get messages by conversationId sorted by timestamp', async () => {
    // Create messages with slight delay to ensure ordering
    const msg1 = await messageService.create({ conversationId: 'conv-1', role: 'user', content: 'First' })
    await new Promise((r) => setTimeout(r, 2))
    const msg2 = await messageService.create({ conversationId: 'conv-1', role: 'assistant', content: 'Second' })

    const messages = await messageService.getByConversationId('conv-1')

    expect(messages).toHaveLength(2)
    expect(messages[0].id).toBe(msg1.id)
    expect(messages[1].id).toBe(msg2.id)
  })

  it('should isolate messages between conversations', async () => {
    await messageService.create({ conversationId: 'conv-1', role: 'user', content: 'For Conv 1' })
    await messageService.create({ conversationId: 'conv-2', role: 'user', content: 'For Conv 2' })
    await messageService.create({ conversationId: 'conv-1', role: 'assistant', content: 'Reply Conv 1' })

    const conv1Messages = await messageService.getByConversationId('conv-1')
    const conv2Messages = await messageService.getByConversationId('conv-2')

    expect(conv1Messages).toHaveLength(2)
    expect(conv2Messages).toHaveLength(1)
    expect(conv2Messages[0].content).toBe('For Conv 2')
  })

  it('should update a message', async () => {
    const msg = await messageService.create({ conversationId: 'conv-1', role: 'assistant', content: 'Draft' })
    await messageService.update(msg.id, { content: 'Final', isStreaming: false })

    const messages = await messageService.getByConversationId('conv-1')
    expect(messages[0].content).toBe('Final')
    expect(messages[0].isStreaming).toBe(false)
  })

  it('should delete messages by conversationId', async () => {
    await messageService.create({ conversationId: 'conv-1', role: 'user', content: 'A' })
    await messageService.create({ conversationId: 'conv-1', role: 'assistant', content: 'B' })
    await messageService.create({ conversationId: 'conv-2', role: 'user', content: 'C' })

    await messageService.deleteByConversationId('conv-1')

    const conv1Messages = await messageService.getByConversationId('conv-1')
    const conv2Messages = await messageService.getByConversationId('conv-2')

    expect(conv1Messages).toHaveLength(0)
    expect(conv2Messages).toHaveLength(1)
  })

  it('should get latest messages with limit', async () => {
    await messageService.create({ conversationId: 'conv-1', role: 'user', content: 'M1' })
    await new Promise((r) => setTimeout(r, 2))
    await messageService.create({ conversationId: 'conv-1', role: 'assistant', content: 'M2' })
    await new Promise((r) => setTimeout(r, 2))
    const msg3 = await messageService.create({ conversationId: 'conv-1', role: 'user', content: 'M3' })

    const latest = await messageService.getLatest('conv-1', 2)

    expect(latest).toHaveLength(2)
    // Reverse sorted by timestamp, so newest first
    expect(latest[0].id).toBe(msg3.id)
  })

  it('should return empty array for conversation with no messages', async () => {
    const messages = await messageService.getByConversationId('non-existent')
    expect(messages).toEqual([])
  })
})

// === ModelService ===
describe('ModelService', () => {
  it('should create a model with auto-generated id and createdAt', async () => {
    const model = await modelService.create({
      name: 'GPT-4',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      modelName: 'gpt-4',
    })

    expect(model.id).toBeDefined()
    expect(model.name).toBe('GPT-4')
    expect(model.provider).toBe('openai')
    expect(model.createdAt).toBeTypeOf('number')
  })

  it('should get all models', async () => {
    await modelService.create({ name: 'GPT-4', provider: 'openai', endpoint: '', apiKey: '', modelName: 'gpt-4' })
    await modelService.create({ name: 'Claude', provider: 'anthropic', endpoint: '', apiKey: '', modelName: 'claude-3' })

    const all = await modelService.getAll()
    expect(all).toHaveLength(2)
  })

  it('should get model by id', async () => {
    const created = await modelService.create({
      name: 'TestModel',
      provider: 'test',
      endpoint: '',
      apiKey: '',
      modelName: 'test-v1',
    })
    const found = await modelService.getById(created.id)

    expect(found).toBeDefined()
    expect(found!.name).toBe('TestModel')
  })

  it('should return undefined for non-existent model id', async () => {
    const found = await modelService.getById('does-not-exist')
    expect(found).toBeUndefined()
  })

  it('should update a model', async () => {
    const created = await modelService.create({
      name: 'Old Name',
      provider: 'openai',
      endpoint: '',
      apiKey: '',
      modelName: 'old',
    })

    await modelService.update(created.id, { name: 'New Name', temperature: 0.7 })
    const updated = await modelService.getById(created.id)

    expect(updated!.name).toBe('New Name')
    expect(updated!.temperature).toBe(0.7)
  })

  it('should delete a model', async () => {
    const created = await modelService.create({
      name: 'ToDelete',
      provider: 'openai',
      endpoint: '',
      apiKey: '',
      modelName: 'del',
    })

    await modelService.delete(created.id)
    const found = await modelService.getById(created.id)
    expect(found).toBeUndefined()
  })

  it('should return empty array when no models exist', async () => {
    const all = await modelService.getAll()
    expect(all).toEqual([])
  })
})

// === AgentService ===
describe('AgentService', () => {
  it('should create an agent with auto-generated id', async () => {
    const agent = await agentService.create({
      name: 'ChatBot',
      description: 'A helpful assistant',
      systemPrompt: 'You are helpful.',
    })

    expect(agent.id).toBeDefined()
    expect(agent.name).toBe('ChatBot')
    expect(agent.description).toBe('A helpful assistant')
    expect(agent.systemPrompt).toBe('You are helpful.')
  })

  it('should get all agents', async () => {
    await agentService.create({ name: 'Agent A' })
    await agentService.create({ name: 'Agent B' })

    const all = await agentService.getAll()
    expect(all).toHaveLength(2)
  })

  it('should get agent by id', async () => {
    const created = await agentService.create({ name: 'FindMe' })
    const found = await agentService.getById(created.id)

    expect(found).toBeDefined()
    expect(found!.name).toBe('FindMe')
  })

  it('should return undefined for non-existent agent id', async () => {
    const found = await agentService.getById('no-such-agent')
    expect(found).toBeUndefined()
  })

  it('should update an agent', async () => {
    const created = await agentService.create({ name: 'Original' })
    await agentService.update(created.id, { name: 'Updated', description: 'New desc' })

    const updated = await agentService.getById(created.id)
    expect(updated!.name).toBe('Updated')
    expect(updated!.description).toBe('New desc')
  })

  it('should delete a non-builtin agent', async () => {
    const created = await agentService.create({ name: 'Deletable' })
    await agentService.delete(created.id)

    const found = await agentService.getById(created.id)
    expect(found).toBeUndefined()
  })

  it('should return empty array when no agents exist', async () => {
    const all = await agentService.getAll()
    expect(all).toEqual([])
  })
})
