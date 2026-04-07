import Dexie, { type EntityTable } from 'dexie'
import type { ChatMessage, Conversation, ModelConfig, AgentDefinition, SubAgentExecution } from '../types'

const db = new Dexie('AiChatDB') as Dexie & {
  conversations: EntityTable<Conversation, 'id'>
  messages: EntityTable<ChatMessage, 'id'>
  models: EntityTable<ModelConfig, 'id'>
  agents: EntityTable<AgentDefinition, 'id'>
  subAgentExecutions: EntityTable<SubAgentExecution, 'id'>
}

db.version(1).stores({
  conversations: 'id, agentId, modelId, createdAt, updatedAt',
  messages: 'id, conversationId, role, timestamp, [conversationId+timestamp]',
  models: 'id, provider, createdAt',
  agents: 'id',
})

db.version(2).stores({
  subAgentExecutions: 'id, parentExecutionId, conversationId, parentMessageId, agentId, status, startTime',
})

export { db }
export type Database = typeof db
