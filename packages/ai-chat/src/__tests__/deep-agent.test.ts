import { describe, it, expect } from 'vitest'
import { agentRegistry } from '../services/agent'
import { DeepAgentRunner } from '../agents/deep-agent-runner'

agentRegistry.register({
  id: 'deep-agent-chat',
  name: 'Deep Chat',
  description: 'Deep chat agent with sub-agent calling capability',
}, new DeepAgentRunner({
  id: 'deep-agent-chat',
  name: 'Deep Chat',
}))

describe('DeepAgentRunner registration', () => {
  it('exports DeepAgentRunner as a class', () => {
    expect(DeepAgentRunner).toBeDefined()
    expect(typeof DeepAgentRunner).toBe('function')
  })

  it('registers deep-agent-chat as an agent', () => {
    const def = agentRegistry.getDefinition('deep-agent-chat')
    expect(def).toBeDefined()
    expect(def!.id).toBe('deep-agent-chat')
    expect(def!.name).toBe('Deep Chat')
  })

  it('registers a DeepAgentRunner instance for deep-agent-chat', () => {
    const runner = agentRegistry.getRunner('deep-agent-chat')
    expect(runner).toBeDefined()
    expect(runner).toBeInstanceOf(DeepAgentRunner)
  })
})
