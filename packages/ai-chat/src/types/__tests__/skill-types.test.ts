import { describe, expect, it } from 'vitest'
import type { AgentDefinition, SkillDefinition } from '../index'

// === SkillDefinition ===

describe('SkillDefinition', () => {
  it('should accept SkillDefinition with required fields only', () => {
    const skill: SkillDefinition = {
      name: 'code-review',
      description: 'Reviews code for quality and bugs',
      instructions: '## How to review\n1. Read the code\n2. Check for bugs',
    }
    expect(skill.name).toBe('code-review')
    expect(skill.description).toBe('Reviews code for quality and bugs')
    expect(skill.instructions).toContain('How to review')
    expect(skill.metadata).toBeUndefined()
  })

  it('should accept SkillDefinition with optional metadata', () => {
    const skill: SkillDefinition = {
      name: 'refactor',
      description: 'Refactors code to improve structure',
      instructions: 'Refactor the following code:',
      metadata: {
        version: '1.0',
        author: 'ai',
      },
    }
    expect(skill.metadata).toEqual({ version: '1.0', author: 'ai' })
  })
})

// === AgentDefinition with skills ===

describe('AgentDefinition skills field', () => {
  it('should be backward compatible — AgentDefinition without skills is valid', () => {
    const agent: AgentDefinition = {
      id: 'basic-agent',
      name: 'Basic Agent',
    }
    expect(agent.skills).toBeUndefined()
  })

  it('should accept AgentDefinition with empty skills array', () => {
    const agent: AgentDefinition = {
      id: 'empty-skills-agent',
      name: 'Empty Skills Agent',
      skills: [],
    }
    expect(agent.skills).toEqual([])
  })

  it('should accept AgentDefinition with skills containing required fields', () => {
    const agent: AgentDefinition = {
      id: 'skilled-agent',
      name: 'Skilled Agent',
      skills: [
        {
          name: 'code-review',
          description: 'Reviews code',
          instructions: 'Review this code carefully.',
        },
      ],
    }
    expect(agent.skills).toHaveLength(1)
    expect(agent.skills![0].name).toBe('code-review')
  })

  it('should accept AgentDefinition with skills and tools together', () => {
    const agent: AgentDefinition = {
      id: 'full-agent',
      name: 'Full Agent',
      tools: [
        {
          name: 'calculator',
          description: 'A calculator',
          execute: async (input: string) => input,
        },
      ],
      skills: [
        {
          name: 'math-expert',
          description: 'Expert at math problems',
          instructions: 'Solve math step by step.',
        },
      ],
    }
    expect(agent.tools).toHaveLength(1)
    expect(agent.skills).toHaveLength(1)
  })
})
