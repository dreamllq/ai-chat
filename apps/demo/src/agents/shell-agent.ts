/**
 * MCP Agent — 通过 MCP 协议连接外部工具服务的智能体（配置模式）
 *
 * 仅提供 AgentDefinition + mcpServers 配置，由框架内部的 runner 处理 MCP 连接与工具调用。
 */
import type { AgentDefinition } from '@ai-chat/vue/types'

// ── Agent Definition（配置模式，无需提供 runner） ──────────────

export const shellAgentDef: AgentDefinition = {
  id: 'demo-shell-agent',
  name: 'shell Agent',
  description: 'shell操作',
  systemPrompt:
    'shell操作',
  mcpServers: [
    {
      name: 'shell-mcp',
      transport: 'http' as const,
      url: 'http://127.0.0.1:3001/mcp',
    },
  ],
}
