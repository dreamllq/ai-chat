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
  description: '通过 MCP 协议连接外部工具服务（天气查询、数据库查询、文件读取）的智能体',
  systemPrompt:
    '你是一个可以调用外部工具的助手。你可以查询天气、执行数据库查询、读取文件。请根据用户需求使用相应工具，用中文回复。',
  mcpServers: [
    {
      name: 'simple-mcp-test',
      transport: 'http' as const,
      url: 'http://127.0.0.1:3001/mcp',
    },
  ],
}
