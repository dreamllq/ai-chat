import { db } from '../database/db'
import type { ChatMessage, Conversation, ModelConfig, AgentDefinition, SubAgentExecution } from '../types'
import { liveQuery } from 'dexie'

// === Conversation Service ===
export class ConversationService {
  async create(data: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Conversation> {
    const now = Date.now()
    const id = crypto.randomUUID()
    const conversation: Conversation = { ...data, id, createdAt: now, updatedAt: now }
    await db.conversations.add(conversation)
    return conversation
  }

  async getAll(): Promise<Conversation[]> {
    return db.conversations.reverse().sortBy('createdAt')
  }

  async getById(id: string): Promise<Conversation | undefined> {
    return db.conversations.get(id)
  }

  async update(id: string, data: Partial<Conversation>): Promise<void> {
    await db.conversations.update(id, { ...data, updatedAt: Date.now() })
  }

  async delete(id: string): Promise<void> {
    // Cascade delete messages
    await db.messages.where('conversationId').equals(id).delete()
    await db.conversations.delete(id)
  }
}

// === Message Service ===
export class MessageService {
  async create(data: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const id = crypto.randomUUID()
    const message: ChatMessage = { ...data, id, timestamp: Date.now() }
    await db.messages.add(message)
    return message
  }

  async getByConversationId(conversationId: string): Promise<ChatMessage[]> {
    return db.messages.where('conversationId').equals(conversationId).sortBy('timestamp')
  }

  async update(id: string, data: Partial<ChatMessage>): Promise<void> {
    await db.messages.update(id, data)
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    await db.messages.where('conversationId').equals(conversationId).delete()
  }

  async getLatest(conversationId: string, limit: number): Promise<ChatMessage[]> {
    const msgs = await db.messages
      .where('conversationId')
      .equals(conversationId)
      .reverse()
      .sortBy('timestamp')
    return msgs.slice(0, limit)
  }
}

// === Model Service ===
export class ModelService {
  async create(data: Omit<ModelConfig, 'id' | 'createdAt'>): Promise<ModelConfig> {
    const id = crypto.randomUUID()
    const model: ModelConfig = { ...data, id, createdAt: Date.now() }
    await db.models.add(model)
    return model
  }

  async getAll(): Promise<ModelConfig[]> {
    return db.models.orderBy('createdAt').toArray()
  }

  async getById(id: string): Promise<ModelConfig | undefined> {
    return db.models.get(id)
  }

  async update(id: string, data: Partial<ModelConfig>): Promise<void> {
    await db.models.update(id, data)
  }

  async delete(id: string): Promise<void> {
    await db.models.delete(id)
  }
}

// === Agent Service ===
export class AgentService {
  async create(data: Omit<AgentDefinition, 'id'>): Promise<AgentDefinition> {
    const id = crypto.randomUUID()
    const agent: AgentDefinition = { ...data, id }
    await db.agents.add(agent)
    return agent
  }

  async getAll(): Promise<AgentDefinition[]> {
    return db.agents.toArray()
  }

  async getById(id: string): Promise<AgentDefinition | undefined> {
    return db.agents.get(id)
  }

  async update(id: string, data: Partial<AgentDefinition>): Promise<void> {
    await db.agents.update(id, data)
  }

  async delete(id: string): Promise<void> {
    await db.agents.delete(id)
  }
}

// === SubAgentExecution Service ===
export class SubAgentExecutionService {
  async create(data: Omit<SubAgentExecution, 'id'>, id?: string): Promise<SubAgentExecution> {
    const recordId = id ?? crypto.randomUUID()
    const execution: SubAgentExecution = { ...data, id: recordId }
    await db.subAgentExecutions.add(execution)
    return execution
  }

  async getById(id: string): Promise<SubAgentExecution | undefined> {
    return db.subAgentExecutions.get(id)
  }

  async getByParentMessageId(parentMessageId: string): Promise<SubAgentExecution[]> {
    return db.subAgentExecutions.where('parentMessageId').equals(parentMessageId).toArray()
  }

  async getByConversationId(conversationId: string): Promise<SubAgentExecution[]> {
    return db.subAgentExecutions.where('conversationId').equals(conversationId).toArray()
  }

  async update(id: string, data: Partial<SubAgentExecution>): Promise<void> {
    await db.subAgentExecutions.update(id, data)
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    await db.subAgentExecutions.where('conversationId').equals(conversationId).delete()
  }
}

// Re-export liveQuery for composables
export { liveQuery }
