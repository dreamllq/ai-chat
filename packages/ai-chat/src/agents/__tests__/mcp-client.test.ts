import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MCPServerConfig } from '../../types'

// ─── Module-level mocks ───────────────────────────────────────────────
// Each MCPClient instance creates its own Client + Transport per server.
// We track per-instance state via call-site inspection.

const mockClientConnect = vi.fn()
const mockClientListTools = vi.fn()
const mockClientCallTool = vi.fn()
const mockClientClose = vi.fn()

const MockClient = vi.fn().mockImplementation(() => ({
  connect: mockClientConnect,
  listTools: mockClientListTools,
  callTool: mockClientCallTool,
  close: mockClientClose,
}))

const MockTransport = vi.fn().mockImplementation(() => ({}))

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: MockClient,
}))

const MockSseTransport = vi.fn().mockImplementation(() => ({}))

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: MockTransport,
}))

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: MockSseTransport,
}))

// Import after mocks are set up
import { MCPClient } from '../mcp-client'

// ─── Helpers ──────────────────────────────────────────────────────────

function makeStdioConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    name: 'test-server',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-math'],
    ...overrides,
  }
}

function makeHttpConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    name: 'http-server',
    transport: 'http',
    url: 'https://example.com/mcp',
    ...overrides,
  }
}

function makeSseConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    name: 'sse-server',
    transport: 'sse',
    url: 'https://sse.example.com/mcp',
    ...overrides,
  }
}

// MCP tool shape returned by client.listTools()
interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

function makeMcpTool(overrides: Partial<McpTool> = {}): McpTool {
  return {
    name: 'test-tool',
    description: 'A test tool',
    ...overrides,
  }
}

describe('MCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClientConnect.mockResolvedValue(undefined)
    mockClientListTools.mockResolvedValue({ tools: [] })
    mockClientCallTool.mockResolvedValue({ content: [] })
    mockClientClose.mockResolvedValue(undefined)
    MockTransport.mockImplementation(() => ({}))
    MockSseTransport.mockImplementation(() => ({}))
  })

  // ═══════════════════════════════════════════════════════════════════
  // 1. Empty configs → empty array
  // ═══════════════════════════════════════════════════════════════════

  it('should return empty tools array when no configs provided', async () => {
    const client = new MCPClient([])
    const tools = await client.getTools()

    expect(tools).toEqual([])
    expect(MockClient).not.toHaveBeenCalled()
  })

  // ═══════════════════════════════════════════════════════════════════
  // 2. Single server connection and tool discovery
  // ═══════════════════════════════════════════════════════════════════

  it('should connect to a single server and discover tools', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [
        makeMcpTool({ name: 'add', description: 'Add numbers' }),
        makeMcpTool({ name: 'subtract', description: 'Subtract numbers' }),
      ],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('add')
    expect(tools[0].description).toBe('Add numbers')
    expect(tools[1].name).toBe('subtract')
    expect(tools[1].description).toBe('Subtract numbers')
    expect(MockClient).toHaveBeenCalledTimes(1)
    expect(mockClientConnect).toHaveBeenCalledTimes(1)
  })

  // ═══════════════════════════════════════════════════════════════════
  // 3. Multiple servers with aggregated tools
  // ═══════════════════════════════════════════════════════════════════

  it('should aggregate tools from multiple servers', async () => {
    // First server returns 2 tools, second returns 1 tool
    mockClientListTools
      .mockResolvedValueOnce({
        tools: [
          makeMcpTool({ name: 'tool-a', description: 'Tool A' }),
          makeMcpTool({ name: 'tool-b', description: 'Tool B' }),
        ],
      })
      .mockResolvedValueOnce({
        tools: [makeMcpTool({ name: 'tool-c', description: 'Tool C' })],
      })

    const configs = [
      makeHttpConfig({ name: 'server-a' }),
      makeHttpConfig({ name: 'server-b', url: 'https://other.example.com/mcp' }),
    ]
    const client = new MCPClient(configs)
    const tools = await client.getTools()

    expect(tools).toHaveLength(3)
    expect(tools.map(t => t.name)).toEqual(['tool-a', 'tool-b', 'tool-c'])
    // One Client per server
    expect(MockClient).toHaveBeenCalledTimes(2)
  })

  // ═══════════════════════════════════════════════════════════════════
  // 4. Connection failure → graceful degradation (empty for failed server)
  // ═══════════════════════════════════════════════════════════════════

  it('should return empty array when all servers fail to connect', async () => {
    mockClientConnect.mockRejectedValue(new Error('Connection refused'))

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    expect(tools).toEqual([])
  })

  // ═══════════════════════════════════════════════════════════════════
  // 5. Partial server failure (server A succeeds, server B fails)
  // ═══════════════════════════════════════════════════════════════════

  it('should return tools from successful server when another fails', async () => {
    // First connect succeeds, second fails
    mockClientConnect
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Server B down'))

    mockClientListTools.mockResolvedValueOnce({
      tools: [makeMcpTool({ name: 'tool-a', description: 'Tool A' })],
    })

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const client = new MCPClient([
      makeHttpConfig({ name: 'server-a' }),
      makeHttpConfig({ name: 'server-b', url: 'https://down.example.com/mcp' }),
    ])
    const tools = await client.getTools()

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('tool-a')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MCPClient]'),
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })

  // ═══════════════════════════════════════════════════════════════════
  // 6. Tool conversion: structured tool (with inputSchema via json-schema-to-zod)
  // ═══════════════════════════════════════════════════════════════════

  it('should create StructuredToolDefinition when tool has inputSchema with properties', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [
        makeMcpTool({
          name: 'search',
          description: 'Search the web',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
        }),
      ],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    expect(tools).toHaveLength(1)
    const tool = tools[0]
    expect('schema' in tool).toBe(true)
    // Verify the execute function works
    mockClientCallTool.mockResolvedValue({
      content: [{ type: 'text', text: 'search results' }],
    })
    const result = await tool.execute({ query: 'test' } as never)
    expect(result).toBe('search results')
  })

  // ═══════════════════════════════════════════════════════════════════
  // 7. Tool conversion: simple tool (no inputSchema)
  // ═══════════════════════════════════════════════════════════════════

  it('should create SimpleToolDefinition when tool has no inputSchema', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [
        makeMcpTool({
          name: 'ping',
          description: 'Ping the server',
          // no inputSchema
        }),
      ],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    expect(tools).toHaveLength(1)
    const tool = tools[0]
    expect('schema' in tool).toBe(false)
    expect(tool.name).toBe('ping')
    expect(tool.description).toBe('Ping the server')
  })

  // ═══════════════════════════════════════════════════════════════════
  // 8. Tool execute calls client.callTool() and returns text content
  // ═══════════════════════════════════════════════════════════════════

  it('should call client.callTool() on execute and return text content', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [makeMcpTool({ name: 'echo', description: 'Echo input' })],
    })
    mockClientCallTool.mockResolvedValue({
      content: [{ type: 'text', text: 'hello world' }],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    const result = await tools[0].execute('test-input' as never)
    expect(result).toBe('hello world')
    expect(mockClientCallTool).toHaveBeenCalledWith({
      name: 'echo',
      arguments: { input: 'test-input' },
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // 9. Tool execute handles isError: true (returns error string, NOT throw)
  // ═══════════════════════════════════════════════════════════════════

  it('should return error string when callTool returns isError: true', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [makeMcpTool({ name: 'fail-tool', description: 'Fails' })],
    })
    mockClientCallTool.mockResolvedValue({
      content: [{ type: 'text', text: 'Something went wrong' }],
      isError: true,
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    const result = await tools[0].execute('input' as never)
    expect(result).toBe('Error: Something went wrong')
    // Must NOT throw
    expect(result).toBeTypeOf('string')
  })

  // ═══════════════════════════════════════════════════════════════════
  // 10. Tool execute handles non-text content (image/resource blocks)
  // ═══════════════════════════════════════════════════════════════════

  it('should handle non-text content blocks gracefully', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [makeMcpTool({ name: 'multi-content', description: 'Returns mixed' })],
    })
    mockClientCallTool.mockResolvedValue({
      content: [
        { type: 'text', text: 'description' },
        { type: 'image', data: 'base64...', mimeType: 'image/png' },
        { type: 'resource', resource: { uri: 'file:///test.txt', mimeType: 'text/plain', text: 'file content' } },
      ],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    const result = await tools[0].execute('input' as never)
    // Should extract text content, skip non-text
    expect(result).toContain('description')
  })

  // ═══════════════════════════════════════════════════════════════════
  // 11. Tool execute handles empty content array
  // ═══════════════════════════════════════════════════════════════════

  it('should return empty string when callTool returns empty content', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [makeMcpTool({ name: 'empty-tool', description: 'Returns nothing' })],
    })
    mockClientCallTool.mockResolvedValue({
      content: [],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    const result = await tools[0].execute('input' as never)
    expect(result).toBe('')
  })

  // ═══════════════════════════════════════════════════════════════════
  // 12. Tool name collisions (two servers with same tool name — both included)
  // ═══════════════════════════════════════════════════════════════════

  it('should include both tools when two servers have same tool name', async () => {
    mockClientListTools
      .mockResolvedValueOnce({
        tools: [makeMcpTool({ name: 'search', description: 'Server A search' })],
      })
      .mockResolvedValueOnce({
        tools: [makeMcpTool({ name: 'search', description: 'Server B search' })],
      })

    const client = new MCPClient([
      makeHttpConfig({ name: 'server-a' }),
      makeHttpConfig({ name: 'server-b', url: 'https://other.example.com/mcp' }),
    ])
    const tools = await client.getTools()

    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe('search')
    expect(tools[1].name).toBe('search')
    // Different descriptions prove they come from different servers
    expect(tools[0].description).toBe('Server A search')
    expect(tools[1].description).toBe('Server B search')
  })

  // ═══════════════════════════════════════════════════════════════════
  // 13. close() resets state so getTools() re-initializes
  // ═══════════════════════════════════════════════════════════════════

  it('should reset state on close() so getTools() re-initializes', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [makeMcpTool({ name: 'tool1', description: 'First run' })],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools1 = await client.getTools()
    expect(tools1).toHaveLength(1)

    await client.close()
    expect(mockClientClose).toHaveBeenCalled()

    // Re-initialize with new tools
    mockClientListTools.mockResolvedValue({
      tools: [makeMcpTool({ name: 'tool2', description: 'Second run' })],
    })

    const tools2 = await client.getTools()
    expect(tools2).toHaveLength(1)
    expect(tools2[0].name).toBe('tool2')
    // Client should have been created twice (first init + re-init after close)
    expect(MockClient).toHaveBeenCalledTimes(2)
  })

  // ═══════════════════════════════════════════════════════════════════
  // 14. close() when not initialized
  // ═══════════════════════════════════════════════════════════════════

  it('should handle close() when not initialized without error', async () => {
    const client = new MCPClient([])
    await expect(client.close()).resolves.toBeUndefined()
    expect(mockClientClose).not.toHaveBeenCalled()
  })

  // ═══════════════════════════════════════════════════════════════════
  // 15. stdio config skipped with console.warn
  // ═══════════════════════════════════════════════════════════════════

  it('should skip stdio config with console.warn', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const client = new MCPClient([makeStdioConfig()])
    const tools = await client.getTools()

    expect(tools).toEqual([])
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MCPClient]'),
    )

    consoleWarnSpy.mockRestore()
  })

  // ═══════════════════════════════════════════════════════════════════
  // 16. http config mapped to StreamableHTTPClientTransport with URL and headers
  // ═══════════════════════════════════════════════════════════════════

  it('should map http config to StreamableHTTPClientTransport with URL and headers', async () => {
    mockClientListTools.mockResolvedValue({ tools: [] })

    const config = makeHttpConfig({
      name: 'weather',
      url: 'https://weather.example.com/mcp',
      headers: { Authorization: 'Bearer token123' },
    })

    const client = new MCPClient([config])
    await client.getTools()

    expect(MockTransport).toHaveBeenCalledTimes(1)
    expect(MockTransport).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        requestInit: expect.objectContaining({
          headers: { Authorization: 'Bearer token123' },
        }),
      }),
    )
    // Verify URL was passed correctly
    const transportCall = MockTransport.mock.calls[0]
    expect(transportCall[0]).toBeInstanceOf(URL)
    expect(transportCall[0].toString()).toBe('https://weather.example.com/mcp')
    // SSE transport should NOT be used for http config
    expect(MockSseTransport).not.toHaveBeenCalled()
  })

  // ═══════════════════════════════════════════════════════════════════
  // 17. sse config mapped to SSEClientTransport
  // ═══════════════════════════════════════════════════════════════════

  it('should map sse config to SSEClientTransport', async () => {
    mockClientListTools.mockResolvedValue({ tools: [] })

    const config = makeSseConfig({
      name: 'legacy-sse',
      url: 'https://sse.example.com/mcp',
      headers: { 'X-Custom': 'value' },
    })

    const client = new MCPClient([config])
    await client.getTools()

    expect(MockSseTransport).toHaveBeenCalledTimes(1)
    expect(MockSseTransport).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        requestInit: expect.objectContaining({
          headers: { 'X-Custom': 'value' },
        }),
      }),
    )
    // Verify URL was passed correctly
    const sseCall = MockSseTransport.mock.calls[0]
    expect(sseCall[0]).toBeInstanceOf(URL)
    expect(sseCall[0].toString()).toBe('https://sse.example.com/mcp')
    // StreamableHTTP transport should NOT be used for sse config
    expect(MockTransport).not.toHaveBeenCalled()
  })

  // ═══════════════════════════════════════════════════════════════════
  // 18. listTools pagination (nextCursor loop)
  // ═══════════════════════════════════════════════════════════════════

  it('should handle listTools pagination via nextCursor', async () => {
    mockClientListTools
      .mockResolvedValueOnce({
        tools: [makeMcpTool({ name: 'page1-tool' })],
        nextCursor: 'cursor-abc',
      })
      .mockResolvedValueOnce({
        tools: [makeMcpTool({ name: 'page2-tool' })],
        nextCursor: 'cursor-def',
      })
      .mockResolvedValueOnce({
        tools: [makeMcpTool({ name: 'page3-tool' })],
        // no nextCursor → end pagination
      })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    expect(tools).toHaveLength(3)
    expect(tools.map(t => t.name)).toEqual(['page1-tool', 'page2-tool', 'page3-tool'])
    expect(mockClientListTools).toHaveBeenCalledTimes(3)
    // Verify cursor was passed in subsequent calls
    expect(mockClientListTools).toHaveBeenNthCalledWith(2, { cursor: 'cursor-abc' })
    expect(mockClientListTools).toHaveBeenNthCalledWith(3, { cursor: 'cursor-def' })
  })

  // ═══════════════════════════════════════════════════════════════════
  // Additional: Tool execute with structured tool passes object arguments
  // ═══════════════════════════════════════════════════════════════════

  it('should pass object arguments for structured tool execute', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [
        makeMcpTool({
          name: 'search',
          description: 'Search',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        }),
      ],
    })
    mockClientCallTool.mockResolvedValue({
      content: [{ type: 'text', text: 'results' }],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    const tool = tools[0]
    expect('schema' in tool).toBe(true)
    await tool.execute({ query: 'hello' } as never)

    expect(mockClientCallTool).toHaveBeenCalledWith({
      name: 'search',
      arguments: { query: 'hello' },
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // Additional: http config without headers still works
  // ═══════════════════════════════════════════════════════════════════

  it('should handle http config without headers', async () => {
    mockClientListTools.mockResolvedValue({ tools: [] })

    const config: MCPServerConfig = {
      name: 'no-headers',
      transport: 'http',
      url: 'https://api.example.com/mcp',
    }

    const client = new MCPClient([config])
    await client.getTools()

    expect(MockTransport).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        requestInit: expect.objectContaining({
          headers: {},
        }),
      }),
    )
  })

  // ═══════════════════════════════════════════════════════════════════
  // Additional: Mix of stdio and http configs (stdio skipped, http works)
  // ═══════════════════════════════════════════════════════════════════

  it('should skip stdio configs and process http configs in mixed setup', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [makeMcpTool({ name: 'http-tool', description: 'HTTP tool' })],
    })

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const client = new MCPClient([
      makeStdioConfig({ name: 'local-server' }),
      makeHttpConfig({ name: 'remote-server' }),
    ])
    const tools = await client.getTools()

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('http-tool')
    expect(consoleWarnSpy).toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  // ═══════════════════════════════════════════════════════════════════
  // Additional: Empty inputSchema (empty object) treated as simple tool
  // ═══════════════════════════════════════════════════════════════════

  it('should treat tool with empty inputSchema as simple tool', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [
        makeMcpTool({
          name: 'no-args-tool',
          description: 'No args',
          inputSchema: {},
        }),
      ],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    expect(tools).toHaveLength(1)
    expect('schema' in tools[0]).toBe(false)
  })

  // ═══════════════════════════════════════════════════════════════════
  // Additional: Tool with undefined description defaults to empty string
  // ═══════════════════════════════════════════════════════════════════

  it('should default to empty string for undefined description', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [
        { name: 'no-desc' },
      ],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    expect(tools[0].description).toBe('')
  })

  // ═══════════════════════════════════════════════════════════════════
  // Additional: Multiple text content blocks joined with newline
  // ═══════════════════════════════════════════════════════════════════

  it('should join multiple text content blocks with newline', async () => {
    mockClientListTools.mockResolvedValue({
      tools: [makeMcpTool({ name: 'multi-text', description: 'Multi' })],
    })
    mockClientCallTool.mockResolvedValue({
      content: [
        { type: 'text', text: 'line1' },
        { type: 'text', text: 'line2' },
        { type: 'text', text: 'line3' },
      ],
    })

    const client = new MCPClient([makeHttpConfig()])
    const tools = await client.getTools()

    const result = await tools[0].execute('input' as never)
    expect(result).toBe('line1\nline2\nline3')
  })
})
