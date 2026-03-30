import type { MCPServerConfig, ToolDefinition } from '../types'

/**
 * MCP client wrapper that connects to MCP servers via @langchain/mcp-adapters
 * and converts tools to framework-agnostic ToolDefinition format.
 *
 * Uses lazy dynamic import to avoid hard dependency at module load time.
 * Gracefully degrades — returns empty tools on connection failure.
 */
export class MCPClient {
  private configs: MCPServerConfig[]
  private client: InstanceType<typeof import('@langchain/mcp-adapters').MultiServerMCPClient> | null = null
  private initialized = false

  constructor(configs: MCPServerConfig[]) {
    this.configs = configs
  }

  /**
   * Get tools from all configured MCP servers.
   * Returns empty array if no configs or on connection failure.
   */
  async getTools(): Promise<ToolDefinition[]> {
    if (this.configs.length === 0) return []

    if (!this.initialized) {
      await this.initialize()
    }

    if (!this.client) return []

    try {
      const mcpTools = await this.client.getTools()
      return mcpTools.map(tool => {
        // Check if MCP tool exposes a schema (StructuredTool)
        const schema = (tool as unknown as { schema?: unknown }).schema
        if (schema && typeof schema === 'object') {
          return {
            name: tool.name,
            description: tool.description ?? '',
            schema,
            execute: async (input: unknown) => {
              const result = await tool.invoke(input as string)
              return String(result)
            },
          }
        }
        // Simple tool — string input only
        return {
          name: tool.name,
          description: tool.description ?? '',
          execute: async (input: string) => {
            const result = await tool.invoke(input)
            return String(result)
          },
        }
      })
    } catch (error) {
      console.error('[MCPClient] Failed to get tools:', error)
      return []
    }
  }

  /**
   * Close all MCP server connections and reset state.
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.initialized = false
    }
  }

  /**
   * Lazily initialize the MultiServerMCPClient.
   * Uses dynamic import to avoid top-level dependency.
   */
  private async initialize(): Promise<void> {
    const { MultiServerMCPClient } = await import('@langchain/mcp-adapters')

    const mcpServers: Record<string, Record<string, unknown>> = {}
    for (const config of this.configs) {
      mcpServers[config.name] = this.buildConnectionConfig(config)
    }

    try {
      this.client = new MultiServerMCPClient({
        mcpServers,
        onConnectionError: 'ignore',
      })
      this.initialized = true
    } catch (error) {
      console.error('[MCPClient] Failed to initialize:', error)
      this.client = null
    }
  }

  /**
   * Convert MCPServerConfig to @langchain/mcp-adapters connection config format.
   */
  private buildConnectionConfig(config: MCPServerConfig): Record<string, unknown> {
    const result: Record<string, unknown> = { transport: config.transport }

    if (config.transport === 'stdio') {
      if (config.command !== undefined) result.command = config.command
      if (config.args !== undefined) result.args = config.args
      if (config.env !== undefined) result.env = config.env
    } else {
      // http or sse
      if (config.url !== undefined) result.url = config.url
      if (config.headers !== undefined) result.headers = config.headers
    }

    return result
  }
}
