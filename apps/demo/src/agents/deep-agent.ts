import type { AgentDefinition } from '@ai-chat/vue/types'

export const deepAgentDef: AgentDefinition = {
  id: 'demo-deep-agent',
  name: 'deep Agent',
  description: '这是一个深度agent',
  systemPrompt: '这是一个深度agent',
  allowedAgents:['demo-code-agent','demo-fs-agent', 'demo-shell-agent']
}
