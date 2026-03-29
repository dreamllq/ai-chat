import { describe, it, expect, beforeEach } from 'vitest'
import type { AgentDefinition, AgentRunner, ChatMessage, ModelConfig, ChatChunk } from '../../types'

// Create a fresh AgentRegistry for each test (avoid singleton side-effects)
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

const stubRunner: AgentRunner = {
  async *chat(_messages: ChatMessage[], _model: ModelConfig): AsyncGenerator<ChatChunk, void, unknown> {
    yield { type: 'done' }
  },
}

const anotherStubRunner: AgentRunner = {
  async *chat(_messages: ChatMessage[], _model: ModelConfig): AsyncGenerator<ChatChunk, void, unknown> {
    yield { type: 'done' }
  },
}

function makeDefinition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent',
    ...overrides,
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry

  beforeEach(() => {
    registry = new AgentRegistry()
  })

  it('should register an agent and retrieve its runner', () => {
    const def = makeDefinition()
    registry.register(def, stubRunner)

    expect(registry.getRunner(def.id)).toBe(stubRunner)
    expect(registry.getDefinition(def.id)).toBe(def)
  })

  it('should return undefined for non-existent agent runner', () => {
    expect(registry.getRunner('non-existent')).toBeUndefined()
  })

  it('should return undefined for non-existent agent definition', () => {
    expect(registry.getDefinition('non-existent')).toBeUndefined()
  })

  it('should unregister an agent', () => {
    const def = makeDefinition()
    registry.register(def, stubRunner)
    registry.unregister(def.id)

    expect(registry.getRunner(def.id)).toBeUndefined()
    expect(registry.getDefinition(def.id)).toBeUndefined()
  })

  it('should overwrite when registering duplicate ID', () => {
    const def1 = makeDefinition({ id: 'dup', name: 'First' })
    const def2 = makeDefinition({ id: 'dup', name: 'Second' })

    registry.register(def1, stubRunner)
    registry.register(def2, anotherStubRunner)

    expect(registry.getDefinition('dup')?.name).toBe('Second')
    expect(registry.getRunner('dup')).toBe(anotherStubRunner)
  })

  it('should return all registered definitions', () => {
    const def1 = makeDefinition({ id: 'a', name: 'Agent A' })
    const def2 = makeDefinition({ id: 'b', name: 'Agent B' })

    registry.register(def1, stubRunner)
    registry.register(def2, anotherStubRunner)

    const all = registry.getAllDefinitions()
    expect(all).toHaveLength(2)
    expect(all.map((d) => d.id).sort()).toEqual(['a', 'b'])
  })

  it('should return empty array when no agents registered', () => {
    expect(registry.getAllDefinitions()).toEqual([])
  })

  it('should not affect other agents when unregistering one', () => {
    const def1 = makeDefinition({ id: 'a', name: 'Agent A' })
    const def2 = makeDefinition({ id: 'b', name: 'Agent B' })

    registry.register(def1, stubRunner)
    registry.register(def2, anotherStubRunner)
    registry.unregister('a')

    expect(registry.getRunner('a')).toBeUndefined()
    expect(registry.getRunner('b')).toBe(anotherStubRunner)
  })
})
