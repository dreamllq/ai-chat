import { describe, it, expect } from 'vitest'
import { agentRegistry } from '../services/agent'
import { DeepAgentRunner } from '../agents/deep-agent-runner'

// Simulate the registration that index.ts performs
agentRegistry.register({
  id: 'deep-agent-chat',
  name: 'Deep Chat',
  nameKey: 'agent.builtinDeepChatName',
  description: 'Built-in deep chat agent with sub-agent calling capability',
  descriptionKey: 'agent.builtinDeepChatDesc',
  isBuiltin: true,
}, new DeepAgentRunner({
  id: 'deep-agent-chat',
  name: 'Deep Chat',
  isBuiltin: true,
}))

describe('DeepAgentRunner builtin registration', () => {
  it('exports DeepAgentRunner as a class', () => {
    expect(DeepAgentRunner).toBeDefined()
    expect(typeof DeepAgentRunner).toBe('function')
  })

  it('registers deep-agent-chat as a builtin agent', () => {
    const def = agentRegistry.getDefinition('deep-agent-chat')
    expect(def).toBeDefined()
    expect(def!.id).toBe('deep-agent-chat')
    expect(def!.name).toBe('Deep Chat')
    expect(def!.isBuiltin).toBe(true)
  })

  it('registers a DeepAgentRunner instance for deep-agent-chat', () => {
    const runner = agentRegistry.getRunner('deep-agent-chat')
    expect(runner).toBeDefined()
    expect(runner).toBeInstanceOf(DeepAgentRunner)
  })
})
