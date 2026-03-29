import { db } from '../database/db'
import type { ChatMessage, Conversation, ModelConfig, AgentDefinition } from '../types'
import { liveQuery } from 'dexie'
import { BUILTIN_MODELS } from './builtin-models'

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
    const all = await db.models.toArray()
    // Built-in models first (preserve insertion order), custom models sorted by createdAt ascending
    const builtins = all.filter((m) => m.isBuiltin)
    const customs = all
      .filter((m) => !m.isBuiltin)
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    return [...builtins, ...customs]
  }

  async getById(id: string): Promise<ModelConfig | undefined> {
    return db.models.get(id)
  }

  async update(id: string, data: Partial<ModelConfig>): Promise<void> {
    await db.models.update(id, data)
  }

  async delete(id: string): Promise<void> {
    // Do not allow deleting builtin models
    const model = await db.models.get(id)
    if (model?.isBuiltin) throw new Error('Cannot delete builtin model')
    await db.models.delete(id)
  }

  /**
   * 初始化内置模型。
   * 仅在数据库中不存在对应 id 时才会写入，已存在的记录不会被覆盖。
   */
  async seedBuiltins(): Promise<void> {
    for (const template of BUILTIN_MODELS) {
      const existing = await db.models.get(template.id)
      if (!existing) {
        const model: ModelConfig = {
          id: template.id,
          name: template.name,
          provider: template.provider,
          endpoint: template.endpoint,
          apiKey: '',
          modelName: template.modelName,
          temperature: template.temperature,
          maxTokens: template.maxTokens,
          isBuiltin: true,
          createdAt: Date.now(),
        }
        await db.models.add(model)
      }
    }
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
    // Do not allow deleting builtin agents
    const agent = await db.agents.get(id)
    if (agent?.isBuiltin) throw new Error('Cannot delete builtin agent')
    await db.agents.delete(id)
  }
}

// Re-export liveQuery for composables
export { liveQuery }
