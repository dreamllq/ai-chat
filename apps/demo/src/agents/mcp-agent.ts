/**
 * MCP Agent — 通过 MCP 协议连接外部工具服务的智能体（配置模式）
 *
 * 仅提供 AgentDefinition + mcpServers 配置，由框架内部的 runner 处理 MCP 连接与工具调用。
 */
import type { AgentDefinition } from '@ai-chat/vue/types'

// ── Agent Definition（配置模式，无需提供 runner） ──────────────

export const mcpAgentDef: AgentDefinition = {
  id: 'demo-mcp-agent',
  name: 'MCP Agent',
  description: '文件操作',
  systemPrompt:
    '进行文件操作',
  mcpServers: [
    {
      name: 'fs-mcp',
      transport: 'http' as const,
      url: 'http://127.0.0.1:3000/mcp',
    },
  ],
}
