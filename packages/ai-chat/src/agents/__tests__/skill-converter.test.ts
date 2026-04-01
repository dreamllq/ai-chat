import { describe, it, expect } from 'vitest'
import { skillToMarkdown, convertSkillsToTools } from '../skill-converter'
import type { SkillDefinition } from '../../types'

function makeSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    name: 'test-skill',
    description: 'A test skill',
    instructions: 'Do the thing.',
    ...overrides,
  }
}

describe('skillToMarkdown', () => {
  it('should produce SKILL.md with frontmatter and instructions', () => {
    const skill = makeSkill()

    const md = skillToMarkdown(skill)

    expect(md).toContain('---')
    expect(md).toContain('name: test-skill')
    expect(md).toContain('description: A test skill')
    expect(md).toContain('Do the thing.')
  })

  it('should have correct structure: frontmatter block then blank line then instructions', () => {
    const skill = makeSkill()

    const md = skillToMarkdown(skill)

    const parts = md.split('---')
    expect(parts).toHaveLength(3)
    const frontmatter = parts[1]
    expect(frontmatter).toContain('name: test-skill')
    expect(frontmatter).toContain('description: A test skill')
    expect(parts[2]).toMatch(/^\n\nDo the thing\.\n?$/)
  })

  it('should handle multi-line instructions', () => {
    const skill = makeSkill({
      instructions: 'Step 1: Analyze.\nStep 2: Execute.\nStep 3: Report.',
    })

    const md = skillToMarkdown(skill)

    expect(md).toContain('Step 1: Analyze.')
    expect(md).toContain('Step 2: Execute.')
    expect(md).toContain('Step 3: Report.')
  })

  it('should handle special characters in name and description', () => {
    const skill = makeSkill({
      name: 'skill-with-special chars & <>"\'',
      description: 'Description with "quotes" and <brackets>',
    })

    const md = skillToMarkdown(skill)

    expect(md).toContain('name: skill-with-special chars & <>"\'')
    expect(md).toContain('description: Description with "quotes" and <brackets>')
  })

  it('should work with empty instructions', () => {
    const skill = makeSkill({ instructions: '' })

    const md = skillToMarkdown(skill)

    expect(md).toContain('name: test-skill')
    expect(md).toContain('description: A test skill')
  })
})

describe('convertSkillsToTools', () => {
  it('should return empty array when no skills provided', () => {
    const tools = convertSkillsToTools([])
    expect(tools).toEqual([])
  })

  it('should convert each skill to a tool with matching name and description', () => {
    const skills = [
      makeSkill({ name: 'code-review', description: 'Reviews code quality' }),
      makeSkill({ name: 'translator', description: 'Translates text' }),
    ]

    const tools = convertSkillsToTools(skills)

    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('code-review')
    expect(tools[0].description).toBe('Reviews code quality')
    expect(tools[1].name).toBe('translator')
    expect(tools[1].description).toBe('Translates text')
  })

  it('should return skill instructions when execute is called', async () => {
    const skill = makeSkill({ instructions: '## Review Steps\n1. Read code\n2. Report issues' })
    const tools = convertSkillsToTools([skill])

    const result = await tools[0].execute('')

    expect(result).toBe('## Review Steps\n1. Read code\n2. Report issues')
  })

  it('should ignore the input argument — skill tools always return instructions', async () => {
    const skill = makeSkill({ instructions: 'Skill content here' })
    const tools = convertSkillsToTools([skill])

    const result = await tools[0].execute('ignored input')

    expect(result).toBe('Skill content here')
  })

  it('should produce simple ToolDefinition without schema', () => {
    const skills = [makeSkill()]
    const tools = convertSkillsToTools(skills)

    expect(tools[0]).not.toHaveProperty('schema')
    expect(typeof tools[0].execute).toBe('function')
  })
})
