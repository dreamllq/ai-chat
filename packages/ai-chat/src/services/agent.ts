import { ref } from 'vue'
import type { AgentDefinition, AgentRunner } from '../types'
import { LangChainRunner } from '../agents/langchain-runner'

/** Default chat agent ID — auto-registered when no agents exist */
export const DEFAULT_AGENT_ID = '__default_chat__'

class AgentRegistry {
  private definitions: Map<string, AgentDefinition> = new Map()
  private runners: Map<string, AgentRunner> = new Map()

  readonly version = ref(0)

  register(agentDef: AgentDefinition, runner?: AgentRunner): void {
    this.definitions.set(agentDef.id, agentDef)

    if (runner) {
      this.runners.set(agentDef.id, runner)
    } else {
      this.runners.set(agentDef.id, new LangChainRunner(agentDef))
    }

    this.version.value++
  }

  unregister(agentId: string): void {
    this.definitions.delete(agentId)
    this.runners.delete(agentId)
    this.version.value++
  }

  getRunner(agentId: string): AgentRunner | undefined {
    return this.runners.get(agentId)
  }

  getDefinition(agentId: string): AgentDefinition | undefined {
    return this.definitions.get(agentId)
  }

  getAllDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values())
  }
}

export const agentRegistry = new AgentRegistry()

/** Convenience function for registering agents (runner is optional) */
export function registerAgent(agentDef: AgentDefinition, runner?: AgentRunner): void {
  agentRegistry.register(agentDef, runner)
}

/**
 * Ensure at least one agent exists. If no agents have been registered,
 * auto-register a default chat agent so the user always has something usable.
 */
export function ensureDefaultAgent(): void {
  if (agentRegistry.getAllDefinitions().length === 0) {
    agentRegistry.register({
      id: DEFAULT_AGENT_ID,
      name: 'Chat',
      nameKey: 'agent.defaultChatName',
      description: 'Default chat agent',
      descriptionKey: 'agent.defaultChatDesc',
    })
  }
}
