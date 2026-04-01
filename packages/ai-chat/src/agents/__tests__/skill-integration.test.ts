import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AgentDefinition, AgentRunner, ChatMessage, ModelConfig, ChatChunk, SkillDefinition, ToolDefinition } from '../../types'

const { MockLangChainRunner } = vi.hoisted(() => ({
  MockLangChainRunner: vi.fn().mockImplementation((def: AgentDefinition) => ({
    _brand: 'LangChainRunner' as const,
    _defId: def.id,
    async *chat(): AsyncGenerator<ChatChunk, void, unknown> {
      yield { type: 'done' }
    },
  })),
}))

vi.mock('../../agents/langchain-runner', () => ({
  LangChainRunner: MockLangChainRunner,
}))

import { agentRegistry, registerAgent } from '../../services/agent'

interface MockRunner {
  _brand: 'LangChainRunner'
  _defId: string
  chat: () => AsyncGenerator<ChatChunk, void, unknown>
}

function getMockRunner(id: string): MockRunner {
  return agentRegistry.getRunner(id) as unknown as MockRunner
}

function makeSkill(name = 'test-skill'): SkillDefinition {
  return {
    name,
    description: `Description for ${name}`,
    instructions: `Instructions for ${name}`,
  }
}

function makeTool(name = 'test-tool'): ToolDefinition {
  return {
    name,
    description: `Description for ${name}`,
    execute: vi.fn().mockResolvedValue('result'),
  }
}

function clearRegistry(): void {
  const defs = agentRegistry.getAllDefinitions()
  for (const d of defs) {
    agentRegistry.unregister(d.id)
  }
}

describe('Skill system integration', () => {
  beforeEach(() => {
    clearRegistry()
    MockLangChainRunner.mockClear()
  })

  it('should create LangChainRunner when agent has skills', () => {
    const def: AgentDefinition = {
      id: 'skill-agent',
      name: 'Skill Agent',
      skills: [makeSkill()],
    }
    registerAgent(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(def)
    expect(getMockRunner(def.id)._brand).toBe('LangChainRunner')
  })

  it('should create LangChainRunner when agent has tools but no skills', () => {
    const def: AgentDefinition = {
      id: 'tool-agent',
      name: 'Tool Agent',
      tools: [makeTool()],
    }
    registerAgent(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(def)
    expect(getMockRunner(def.id)._brand).toBe('LangChainRunner')
  })

  it('should create LangChainRunner when agent has both skills and tools', () => {
    const def: AgentDefinition = {
      id: 'both-agent',
      name: 'Both Agent',
      skills: [makeSkill()],
      tools: [makeTool()],
    }
    registerAgent(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(def)
    expect(getMockRunner(def.id)._brand).toBe('LangChainRunner')
  })

  it('should still use LangChainRunner for agents without skills or tools', () => {
    const def: AgentDefinition = {
      id: 'builtin-sim',
      name: 'Builtin Sim',
      isBuiltin: true,
    }
    registerAgent(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(def)
  })

  it('should still use LangChainRunner when re-registering with skills', () => {
    const id = 'overwrite-agent'
    const defV1: AgentDefinition = { id, name: 'V1 Agent', tools: [makeTool()] }
    registerAgent(defV1)
    expect(MockLangChainRunner).toHaveBeenCalledWith(defV1)
    MockLangChainRunner.mockClear()

    const defV2: AgentDefinition = {
      id,
      name: 'V2 Agent',
      skills: [makeSkill()],
    }
    registerAgent(defV2)
    expect(MockLangChainRunner).toHaveBeenCalledWith(defV2)
    expect(getMockRunner(id)._brand).toBe('LangChainRunner')
    expect(agentRegistry.getDefinition(id)?.name).toBe('V2 Agent')
  })

  it('should export SkillDefinition type from public API', () => {
    const skill: SkillDefinition = {
      name: 'code-review',
      description: 'Reviews code for quality',
      instructions: '## Code Review\n1. Read code\n2. Report issues',
    }
    expect(skill.name).toBe('code-review')
    expect(skill.description).toBeDefined()
    expect(skill.instructions).toBeDefined()
  })

  it('should use explicit runner even when skills are present', () => {
    const explicitRunner: AgentRunner = {
      async *chat(_messages: ChatMessage[], _model: ModelConfig): AsyncGenerator<ChatChunk, void, unknown> {
        yield { type: 'done' }
      },
    }

    const def: AgentDefinition = {
      id: 'explicit-agent',
      name: 'Explicit Agent',
      skills: [makeSkill()],
    }
    registerAgent(def, explicitRunner)

    expect(MockLangChainRunner).not.toHaveBeenCalled()
    expect(agentRegistry.getRunner(def.id)).toBe(explicitRunner)
  })

  it('should create LangChainRunner when skills is an empty array', () => {
    const def: AgentDefinition = {
      id: 'empty-skills',
      name: 'Empty Skills Agent',
      skills: [],
    }
    registerAgent(def)

    expect(MockLangChainRunner).toHaveBeenCalledWith(def)
  })

  it('should allow multiple agents all using LangChainRunner', () => {
    const langchainDef: AgentDefinition = {
      id: 'lc-agent',
      name: 'LC Agent',
      tools: [makeTool()],
    }
    const skillDef: AgentDefinition = {
      id: 'skill-agent',
      name: 'Skill Agent',
      skills: [makeSkill()],
    }
    registerAgent(langchainDef)
    registerAgent(skillDef)

    const all = agentRegistry.getAllDefinitions()
    expect(all).toHaveLength(2)
    expect(all.map(d => d.id).sort()).toEqual(['lc-agent', 'skill-agent'])

    expect(getMockRunner('lc-agent')._brand).toBe('LangChainRunner')
    expect(getMockRunner('skill-agent')._brand).toBe('LangChainRunner')
  })

  it('should fully remove agent on unregister', () => {
    const def: AgentDefinition = {
      id: 'removable',
      name: 'Removable Agent',
      skills: [makeSkill()],
    }
    registerAgent(def)
    expect(agentRegistry.getRunner('removable')).toBeDefined()

    agentRegistry.unregister('removable')
    expect(agentRegistry.getRunner('removable')).toBeUndefined()
    expect(agentRegistry.getDefinition('removable')).toBeUndefined()
  })
})
