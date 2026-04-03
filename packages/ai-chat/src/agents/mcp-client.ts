import type { MCPServerConfig, ToolDefinition } from '../types'
import { jsonSchemaToZod } from './json-schema-to-zod'

type SdkClient = InstanceType<typeof import('@modelcontextprotocol/sdk/client/index.js').Client>

interface McpToolShape {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

function extractContentText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter(block => block.type === 'text' && block.text != null)
    .map(block => block.text!)
    .join('\n')
}

export class MCPClient {
  private configs: MCPServerConfig[]
  private clients: SdkClient[] = []
  private initialized = false

  constructor(configs: MCPServerConfig[]) {
    this.configs = configs
  }

  async getTools(): Promise<ToolDefinition[]> {
    if (this.configs.length === 0) return []

    if (!this.initialized) {
      await this.initialize()
    }

    const allTools: ToolDefinition[] = []
    for (const client of this.clients) {
      try {
        const tools = await this.discoverTools(client)
        allTools.push(...tools)
      } catch (error) {
        console.error('[MCPClient] Failed to get tools from server:', error)
      }
    }

    return allTools
  }

  async close(): Promise<void> {
    for (const client of this.clients) {
      await client.close()
    }
    this.clients = []
    this.initialized = false
  }

  private async initialize(): Promise<void> {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js')

    for (const config of this.configs) {
      if (config.transport === 'stdio') {
        console.warn(
          `[MCPClient] stdio transport is not supported in browser environment for server "${config.name}". Skipping.`,
        )
        continue
      }

      try {
        const client = new Client({
          name: 'ai-chat',
          version: '1.0.0',
        })

        const transport = new StreamableHTTPClientTransport(
          new URL(config.url!),
          {
            requestInit: {
              headers: config.headers ?? {},
            },
          },
        )

        await client.connect(transport)
        this.clients.push(client)
      } catch (error) {
        console.error(`[MCPClient] Failed to connect to server "${config.name}":`, error)
      }
    }

    this.initialized = true
  }

  private async discoverTools(client: SdkClient): Promise<ToolDefinition[]> {
    const mcpTools: McpToolShape[] = []
    let cursor: string | undefined

    do {
      const raw = await client.listTools(cursor ? { cursor } : undefined)
      const result = raw as unknown as { tools: McpToolShape[]; nextCursor?: string }
      mcpTools.push(...result.tools)
      cursor = result.nextCursor
    } while (cursor)

    return mcpTools.map(tool => {
      const hasSchema = tool.inputSchema != null
        && typeof tool.inputSchema === 'object'
        && Object.keys(tool.inputSchema).length > 0

      const capturedName = tool.name

      if (hasSchema) {
        const schema = jsonSchemaToZod(tool.inputSchema)
        return {
          name: capturedName,
          description: tool.description ?? '',
          schema,
          execute: async (input: unknown) => {
            const rawResult = await client.callTool({ name: capturedName, arguments: input as Record<string, unknown> })
            return this.extractToolResult(rawResult)
          },
        } satisfies ToolDefinition
      }

      return {
        name: capturedName,
        description: tool.description ?? '',
        execute: async (input: string) => {
          const rawResult = await client.callTool({ name: capturedName, arguments: { input } })
          return this.extractToolResult(rawResult)
        },
      } satisfies ToolDefinition
    })
  }

  private extractToolResult(rawResult: unknown): string {
    const result = rawResult as Record<string, unknown>
    const content = (result.content ?? []) as Array<{ type: string; text?: string }>
    const isError = result.isError === true
    const text = extractContentText(content)

    if (isError) {
      return `Error: ${text}`
    }

    return text
  }
}
