import { agentRegistry } from '../services/agent'
import { LangChainChatAgent } from './langchain-chat-agent'
import type { AgentDefinition } from '../types'

const builtinChatAgent: AgentDefinition = {
  id: 'langchain-chat',
  name: 'LangChain Chat',
  description: 'Built-in chat agent powered by LangChain.js',
  isBuiltin: true,
}

const langchainRunner = new LangChainChatAgent()
agentRegistry.register(builtinChatAgent, langchainRunner)

export { LangChainChatAgent }
