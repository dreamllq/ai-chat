import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AgentDefinition, AgentRunner, ChatMessage, ModelConfig, ChatChunk } from '../../types'

// Create a fresh AgentRegistry for each test (avoid singleton side-effects).
// This mirrors the real AgentRegistry but without the LangChainRunner import.
class AgentRegistry {
  private definitions: Map<string, AgentDefinition> = new Map()
  private runners: Map<string, AgentRunner> = new Map()

  register(agentDef: AgentDefinition, runner?: AgentRunner): void {
    this.definitions.set(agentDef.id, agentDef)
    if (runner) {
      this.runners.set(agentDef.id, runner)
    } else {
      this.runners.set(agentDef.id, {
        async *chat(): AsyncGenerator<ChatChunk, void, unknown> {
          yield { type: 'done' }
        },
      })
    }
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

  it('should register an agent with explicit runner and retrieve it', () => {
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

  it('should register an agent without explicit runner (config-based)', () => {
    const def = makeDefinition()
    registry.register(def)

    expect(registry.getDefinition(def.id)).toBe(def)
    expect(registry.getRunner(def.id)).toBeDefined()
  })

  it('should create a runner when registering config-based agent', () => {
    const def = makeDefinition()
    registry.register(def)

    const runner = registry.getRunner(def.id)
    expect(runner).toBeDefined()
    expect(runner).not.toBe(stubRunner)
  })

  it('should allow config-based then legacy overwrite', () => {
    const def = makeDefinition({ id: 'overwrite-test' })
    registry.register(def)

    registry.register(def, stubRunner)

    expect(registry.getRunner(def.id)).toBe(stubRunner)
  })

  it('should allow legacy then config-based overwrite', () => {
    const def = makeDefinition({ id: 'overwrite-test' })
    registry.register(def, stubRunner)

    registry.register(def)

    expect(registry.getRunner(def.id)).not.toBe(stubRunner)
    expect(registry.getRunner(def.id)).toBeDefined()
  })
})

const { MockLangChainRunner } = vi.hoisted(() => ({
  MockLangChainRunner: vi.fn().mockImplementation((def: AgentDefinition) => ({
    _isMockLangChainRunner: true,
    _defId: def.id,
    async *chat(): AsyncGenerator<ChatChunk, void, unknown> {
      yield { type: 'done' }
    },
  })),
}))

vi.mock('../../agents/langchain-runner', () => ({
  LangChainRunner: MockLangChainRunner,
}))

import { agentRegistry, registerAgent } from '../agent'

describe('AgentRegistry singleton — config-based registration', () => {
  beforeEach(() => {
    const defs = agentRegistry.getAllDefinitions()
    for (const d of defs) {
      agentRegistry.unregister(d.id)
    }
    MockLangChainRunner.mockClear()
  })

  it('should create LangChainRunner when no runner provided', () => {
    const def = makeDefinition({ id: 'singleton-test' })
    agentRegistry.register(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(def)
    expect(agentRegistry.getRunner(def.id)).toBeDefined()
    expect(agentRegistry.getDefinition(def.id)).toBe(def)
  })

  it('should NOT create LangChainRunner when explicit runner provided', () => {
    const def = makeDefinition({ id: 'legacy-test' })
    agentRegistry.register(def, stubRunner)

    expect(MockLangChainRunner).not.toHaveBeenCalled()
    expect(agentRegistry.getRunner(def.id)).toBe(stubRunner)
  })

  it('registerAgent() convenience function — config-based', () => {
    const def = makeDefinition({ id: 'convenience-test' })
    registerAgent(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(def)
    expect(agentRegistry.getRunner(def.id)).toBeDefined()
  })

  it('registerAgent() convenience function — with explicit runner', () => {
    const def = makeDefinition({ id: 'convenience-legacy-test' })
    registerAgent(def, stubRunner)

    expect(MockLangChainRunner).not.toHaveBeenCalled()
    expect(agentRegistry.getRunner(def.id)).toBe(stubRunner)
  })

  it('should pass tools from definition to LangChainRunner', () => {
    const tool = {
      name: 'test-tool',
      description: 'A test tool',
      execute: async () => 'result',
    }
    const def = makeDefinition({ id: 'tools-test', tools: [tool] })
    agentRegistry.register(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tools-test', tools: [tool] }),
    )
  })

  it('should create LangChainRunner when tools present but no other fields', () => {
    const tool = {
      name: 'test-tool',
      description: 'A test tool',
      execute: async () => 'result',
    }
    const def = makeDefinition({ id: 'tools-only-agent', tools: [tool] })
    agentRegistry.register(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(def)
  })

  it('should create LangChainRunner when no tools present', () => {
    const def = makeDefinition({ id: 'no-tools' })
    agentRegistry.register(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(def)
  })
})
