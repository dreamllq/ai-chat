import type { SkillDefinition, ToolDefinition } from '../types'

export function skillToMarkdown(skill: SkillDefinition): string {
  return `---
name: ${skill.name}
description: ${skill.description}
---

${skill.instructions}
`
}

/** Convert skills to simple ToolDefinition[] — each skill becomes a callable tool. */
export function convertSkillsToTools(skills: SkillDefinition[]): ToolDefinition[] {
  return skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    execute: async () => skill.instructions,
  }))
}
