import type { AgentDefinition, AgentRunner } from '../types'

class AgentRegistry {
  private definitions: Map<string, AgentDefinition> = new Map()
  private runners: Map<string, AgentRunner> = new Map()

  register(agentDef: AgentDefinition, runner: AgentRunner): void {
    this.definitions.set(agentDef.id, agentDef)
    this.runners.set(agentDef.id, runner)
  }

  unregister(agentId: string): void {
    this.definitions.delete(agentId)
    this.runners.delete(agentId)
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

/** Convenience function for registering custom agents */
export function registerAgent(agentDef: AgentDefinition, runner: AgentRunner): void {
  agentRegistry.register(agentDef, runner)
}
