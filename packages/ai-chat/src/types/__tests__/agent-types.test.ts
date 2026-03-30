import { describe, expect, it } from 'vitest'
import type {
  AgentDefinition,
  AgentRunner,
  ChatChunk,
  ChatMessage,
  MCPServerConfig,
  MCPTransportType,
  ModelConfig,
  ToolDefinition,
} from '../index'

// === ToolDefinition ===

describe('ToolDefinition', () => {
  it('should accept ToolDefinition with required fields only', () => {
    const tool: ToolDefinition = {
      name: 'calculator',
      description: 'A calculator tool',
      execute: async (input: string) => `Result: ${input}`,
    }
    expect(tool.name).toBe('calculator')
    expect(tool.description).toBe('A calculator tool')
    expect(typeof tool.execute).toBe('function')
  })

  it('should accept ToolDefinition with optional parameters field', () => {
    const tool: ToolDefinition = {
      name: 'calculator',
      description: 'A calculator tool',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression' },
        },
        required: ['expression'],
      },
      execute: async (input: string) => `Result: ${input}`,
    }
    expect(tool.parameters).toBeDefined()
    expect(tool.parameters!.type).toBe('object')
    expect(tool.name).toBe('calculator')
  })

  it('should allow execute to return resolved values', async () => {
    const tool: ToolDefinition = {
      name: 'echo',
      description: 'Echoes input',
      execute: async (input: string) => input,
    }
    const result = await tool.execute('hello')
    expect(result).toBe('hello')
  })
})

// === MCPTransportType ===

describe('MCPTransportType', () => {
  it('should accept all valid transport types', () => {
    const stdio: MCPTransportType = 'stdio'
    const http: MCPTransportType = 'http'
    const sse: MCPTransportType = 'sse'
    expect(stdio).toBe('stdio')
    expect(http).toBe('http')
    expect(sse).toBe('sse')
  })
})

// === MCPServerConfig ===

describe('MCPServerConfig', () => {
  it('should accept stdio transport with command', () => {
    const config: MCPServerConfig = {
      name: 'my-server',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@my/mcp-server'],
      env: { API_KEY: 'secret' },
    }
    expect(config.transport).toBe('stdio')
    expect(config.command).toBe('npx')
    expect(config.args).toEqual(['-y', '@my/mcp-server'])
    expect(config.env).toEqual({ API_KEY: 'secret' })
  })

  it('should accept http transport with url', () => {
    const config: MCPServerConfig = {
      name: 'my-http-server',
      transport: 'http',
      url: 'http://localhost:3000/mcp',
    }
    expect(config.transport).toBe('http')
    expect(config.url).toBe('http://localhost:3000/mcp')
  })

  it('should accept sse transport with url and headers', () => {
    const config: MCPServerConfig = {
      name: 'my-sse-server',
      transport: 'sse',
      url: 'http://localhost:3000/sse',
      headers: { Authorization: 'Bearer token' },
    }
    expect(config.transport).toBe('sse')
    expect(config.url).toBe('http://localhost:3000/sse')
    expect(config.headers).toEqual({ Authorization: 'Bearer token' })
  })

  it('should accept minimal MCPServerConfig with name and transport only', () => {
    const config: MCPServerConfig = {
      name: 'minimal',
      transport: 'http',
    }
    expect(config.name).toBe('minimal')
    expect(config.command).toBeUndefined()
    expect(config.args).toBeUndefined()
    expect(config.url).toBeUndefined()
    expect(config.headers).toBeUndefined()
    expect(config.env).toBeUndefined()
  })
})

// === AgentDefinition updates ===

describe('AgentDefinition', () => {
  it('should accept tools array with ToolDefinition items', () => {
    const agent: AgentDefinition = {
      id: 'tool-agent',
      name: 'Tool Agent',
      tools: [
        {
          name: 'calculator',
          description: 'A calculator',
          execute: async (input: string) => input,
        },
      ],
    }
    expect(agent.tools).toHaveLength(1)
    expect(agent.tools![0].name).toBe('calculator')
  })

  it('should accept mcpServers array with MCPServerConfig items', () => {
    const agent: AgentDefinition = {
      id: 'mcp-agent',
      name: 'MCP Agent',
      mcpServers: [
        {
          name: 'my-server',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@my/mcp-server'],
        },
      ],
    }
    expect(agent.mcpServers).toHaveLength(1)
    expect(agent.mcpServers![0].transport).toBe('stdio')
  })

  it('should be backward compatible — old definition without tools/mcpServers still valid', () => {
    const agent: AgentDefinition = {
      id: 'basic-agent',
      name: 'Basic Agent',
      description: 'A basic agent',
      avatar: '🤖',
      systemPrompt: 'You are a helpful assistant.',
      isBuiltin: true,
    }
    expect(agent.id).toBe('basic-agent')
    expect(agent.tools).toBeUndefined()
    expect(agent.mcpServers).toBeUndefined()
  })

  it('should accept full AgentDefinition with all fields', () => {
    const agent: AgentDefinition = {
      id: 'full-agent',
      name: 'Full Agent',
      description: 'An agent with everything',
      avatar: '🧠',
      systemPrompt: 'You are an advanced assistant.',
      isBuiltin: false,
      tools: [
        {
          name: 'search',
          description: 'Search the web',
          execute: async (q: string) => `results for: ${q}`,
        },
      ],
      mcpServers: [
        {
          name: 'web-server',
          transport: 'sse',
          url: 'http://localhost:4000/sse',
        },
      ],
    }
    expect(agent.tools).toHaveLength(1)
    expect(agent.mcpServers).toHaveLength(1)
    expect(agent.isBuiltin).toBe(false)
  })
})

// === reasoningContent ===

describe('reasoningContent', () => {
  it('should accept ChatMessage with optional reasoningContent', () => {
    const msg: ChatMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'The answer is 42',
      timestamp: Date.now(),
      reasoningContent: 'Let me think step by step...',
    }
    expect(msg.reasoningContent).toBe('Let me think step by step...')
  })

  it('should accept ChatMessage without reasoningContent', () => {
    const msg: ChatMessage = {
      id: 'msg-2',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Hello',
      timestamp: Date.now(),
    }
    expect(msg.reasoningContent).toBeUndefined()
  })

  it('should accept ChatChunk with optional reasoningContent', () => {
    const chunk: ChatChunk = {
      type: 'token',
      content: 'answer',
      reasoningContent: 'thinking...',
    }
    expect(chunk.reasoningContent).toBe('thinking...')
  })

  it('should accept ChatChunk without reasoningContent', () => {
    const chunk: ChatChunk = {
      type: 'token',
      content: 'answer',
    }
    expect(chunk.reasoningContent).toBeUndefined()
  })
})

// === AgentRunner backward compatibility ===

describe('AgentRunner', () => {
  it('should still exist as a callable interface', async () => {
    const mockRunner: AgentRunner = {
      chat: async function* (
        _messages: ChatMessage[],
        _model: ModelConfig,
      ): AsyncGenerator<ChatChunk, void, unknown> {
        yield { type: 'token', content: 'hello' }
        yield { type: 'done' }
      },
    }
    const generator = mockRunner.chat([], {
      id: 'test',
      name: 'Test',
      provider: 'test',
      endpoint: 'http://localhost',
      apiKey: 'key',
      modelName: 'gpt-4',
      createdAt: Date.now(),
    })
    const chunks: ChatChunk[] = []
    for await (const chunk of generator) {
      chunks.push(chunk)
    }
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual({ type: 'token', content: 'hello' })
    expect(chunks[1]).toEqual({ type: 'done' })
  })
})
