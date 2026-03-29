import { ref } from 'vue'
import type { AgentDefinition, AgentRunner } from '../types'
import { LangChainRunner } from '../agents/langchain-runner'

class AgentRegistry {
  private definitions: Map<string, AgentDefinition> = new Map()
  private runners: Map<string, AgentRunner> = new Map()

  /**
   * Reactive version counter — bumped on every register/unregister.
   * Consumers can depend on this ref inside computed() to stay reactive.
   */
  readonly version = ref(0)

  /**
   * Register an agent. Accepts either:
   * 1. Config-based: register(agentDef) — creates LangChainRunner internally
   * 2. Legacy: register(agentDef, runner) — explicit runner (backward compat)
   */
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
