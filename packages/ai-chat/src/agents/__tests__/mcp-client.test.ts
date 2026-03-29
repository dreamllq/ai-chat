import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MCPServerConfig, ToolDefinition } from '../../types'

// Module-level mocks — accessible in both vi.mock and tests
const mockGetTools = vi.fn()
const mockClose = vi.fn()
const mockInitializeConnections = vi.fn()

const MockMultiServerMCPClient = vi.fn().mockImplementation(() => ({
  getTools: mockGetTools,
  close: mockClose,
  initializeConnections: mockInitializeConnections,
}))

vi.mock('@langchain/mcp-adapters', () => ({
  MultiServerMCPClient: MockMultiServerMCPClient,
}))

import { MCPClient } from '../mcp-client'

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

describe('MCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTools.mockResolvedValue([])
    mockClose.mockResolvedValue(undefined)
    mockInitializeConnections.mockResolvedValue({})
  })

  // === Empty config ===

  it('should return empty tools array when no configs provided', async () => {
    const client = new MCPClient([])
    const tools = await client.getTools()

    expect(tools).toEqual([])
    expect(MockMultiServerMCPClient).not.toHaveBeenCalled()
  })

  // === Single server connection ===

  it('should initialize and return tools from a single server', async () => {
    const mockTool = {
      name: 'add',
      description: 'Add two numbers',
      invoke: vi.fn().mockResolvedValue('3'),
    }
    mockGetTools.mockResolvedValue([mockTool])

    const client = new MCPClient([makeStdioConfig()])
    const tools = await client.getTools()

    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('add')
    expect(tools[0].description).toBe('Add two numbers')
  })

  // === Multiple servers ===

  it('should handle multiple server configs', async () => {
    const mockTool1 = { name: 'tool-a', description: 'Tool A', invoke: vi.fn() }
    const mockTool2 = { name: 'tool-b', description: 'Tool B', invoke: vi.fn() }
    mockGetTools.mockResolvedValue([mockTool1, mockTool2])

    const configs = [
      makeStdioConfig({ name: 'server-a' }),
      makeHttpConfig({ name: 'server-b' }),
    ]
    const client = new MCPClient(configs)
    const tools = await client.getTools()

    expect(tools).toHaveLength(2)
    expect(tools.map(t => t.name)).toEqual(['tool-a', 'tool-b'])
  })

  // === Connection failure (graceful degradation) ===

  it('should return empty array on connection failure', async () => {
    mockGetTools.mockRejectedValue(new Error('Connection refused'))

    const client = new MCPClient([makeStdioConfig()])
    const tools = await client.getTools()

    expect(tools).toEqual([])
  })

  // === Tool conversion ===

  it('should convert MCP tools to ToolDefinition with executable execute function', async () => {
    const mockTool = {
      name: 'search',
      description: 'Search the web',
      invoke: vi.fn().mockResolvedValue('result data'),
    }
    mockGetTools.mockResolvedValue([mockTool])

    const client = new MCPClient([makeHttpConfig()])
    const tools: ToolDefinition[] = await client.getTools()

    expect(tools).toHaveLength(1)
    const tool = tools[0]
    expect(tool.name).toBe('search')
    expect(tool.description).toBe('Search the web')

    // Execute should call the underlying MCP tool and return string
    const result = await tool.execute('{"query": "test"}')
    expect(result).toBe('result data')
    expect(mockTool.invoke).toHaveBeenCalledWith('{"query": "test"}')
  })

  // === close() cleanup ===

  it('should close client and reset state', async () => {
    mockGetTools.mockResolvedValue([
      { name: 'tool', description: 'desc', invoke: vi.fn() },
    ])

    const client = new MCPClient([makeStdioConfig()])
    await client.getTools() // triggers initialization
    await client.close()

    expect(mockClose).toHaveBeenCalledOnce()

    // After close, getTools should re-initialize
    mockGetTools.mockResolvedValue([
      { name: 'tool2', description: 'desc2', invoke: vi.fn() },
    ])
    const tools = await client.getTools()
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('tool2')
    // Should have created a new client instance
    expect(MockMultiServerMCPClient).toHaveBeenCalledTimes(2)
  })

  // === close() when not initialized ===

  it('should handle close() when not initialized without error', async () => {
    const client = new MCPClient([])

    // Should not throw
    await expect(client.close()).resolves.toBeUndefined()
    expect(mockClose).not.toHaveBeenCalled()
  })

  // === Config translation: stdio ===

  it('should build stdio connection config correctly', async () => {
    mockGetTools.mockResolvedValue([])

    const config = makeStdioConfig({
      name: 'math',
      command: 'node',
      args: ['server.js'],
      env: { KEY: 'val' },
    })

    const client = new MCPClient([config])
    await client.getTools()

    expect(MockMultiServerMCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        mcpServers: expect.objectContaining({
          math: expect.objectContaining({
            transport: 'stdio',
            command: 'node',
            args: ['server.js'],
            env: { KEY: 'val' },
          }),
        }),
      }),
    )
  })

  // === Config translation: http ===

  it('should build http connection config correctly', async () => {
    mockGetTools.mockResolvedValue([])

    const config = makeHttpConfig({
      name: 'weather',
      url: 'https://weather.example.com/mcp',
      headers: { Authorization: 'Bearer token123' },
    })

    const client = new MCPClient([config])
    await client.getTools()

    expect(MockMultiServerMCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        mcpServers: expect.objectContaining({
          weather: expect.objectContaining({
            transport: 'http',
            url: 'https://weather.example.com/mcp',
            headers: { Authorization: 'Bearer token123' },
          }),
        }),
      }),
    )
  })

  // === Config translation: sse ===

  it('should build sse connection config correctly', async () => {
    mockGetTools.mockResolvedValue([])

    const config: MCPServerConfig = {
      name: 'legacy-sse',
      transport: 'sse',
      url: 'https://sse.example.com/mcp',
    }

    const client = new MCPClient([config])
    await client.getTools()

    expect(MockMultiServerMCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        mcpServers: expect.objectContaining({
          'legacy-sse': expect.objectContaining({
            transport: 'sse',
            url: 'https://sse.example.com/mcp',
          }),
        }),
      }),
    )
  })
})
