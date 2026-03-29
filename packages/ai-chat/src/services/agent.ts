import { ref } from 'vue'
import type { AgentDefinition, AgentRunner } from '../types'

class AgentRegistry {
  private definitions: Map<string, AgentDefinition> = new Map()
  private runners: Map<string, AgentRunner> = new Map()

  /**
   * Reactive version counter — bumped on every register/unregister.
   * Consumers can depend on this ref inside computed() to stay reactive.
   */
  readonly version = ref(0)

  register(agentDef: AgentDefinition, runner: AgentRunner): void {
    this.definitions.set(agentDef.id, agentDef)
    this.runners.set(agentDef.id, runner)
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

/** Convenience function for registering custom agents */
export function registerAgent(agentDef: AgentDefinition, runner: AgentRunner): void {
  agentRegistry.register(agentDef, runner)
}
