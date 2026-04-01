import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import type { ToolDefinition, StructuredToolDefinition } from '../../types'
import type { Mock } from 'vitest'

vi.mock('@langchain/core/tools', () => ({
  DynamicTool: vi.fn().mockImplementation(({ name, description, func }: { name: string; description: string; func: (input: string) => Promise<string> }) => ({
    name,
    description,
    func,
    _getType: () => 'tool',
  })),
  DynamicStructuredTool: vi.fn().mockImplementation(({ name, description, schema, func }: { name: string; description: string; schema: unknown; func: (input: unknown) => Promise<string> }) => ({
    name,
    description,
    schema,
    func,
    _getType: () => 'structured_tool',
  })),
}))

import { convertTools } from '../tool-converter'
import { DynamicTool, DynamicStructuredTool } from '@langchain/core/tools'

const mockedDynamicTool = DynamicTool as unknown as Mock
const mockedDynamicStructuredTool = DynamicStructuredTool as unknown as Mock

describe('convertTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should convert simple tool to DynamicTool', () => {
    const tool: ToolDefinition = {
      name: 'calculator',
      description: 'Performs calculations',
      execute: async (input: string) => `Result: ${input}`,
    }

    const result = convertTools([tool])

    expect(result).toHaveLength(1)
    expect(DynamicTool).toHaveBeenCalledWith({
      name: 'calculator',
      description: 'Performs calculations',
      func: tool.execute,
    })
    expect(DynamicStructuredTool).not.toHaveBeenCalled()
  })

  it('should convert structured tool to DynamicStructuredTool', () => {
    const schema = z.object({ query: z.string(), limit: z.number().optional() })
    const tool: StructuredToolDefinition = {
      name: 'search',
      description: 'Search with structured params',
      schema,
      execute: async () => 'Found',
    }

    const result = convertTools([tool])

    expect(result).toHaveLength(1)
    expect(DynamicStructuredTool).toHaveBeenCalledWith({
      name: 'search',
      description: 'Search with structured params',
      schema,
      func: expect.any(Function),
    })
    expect(DynamicTool).not.toHaveBeenCalled()
  })

  it('should convert mixed list of simple and structured tools', () => {
    const simpleTool: ToolDefinition = {
      name: 'echo',
      description: 'Echoes input',
      execute: async (input: string) => input,
    }
    const structuredTool: ToolDefinition = {
      name: 'search',
      description: 'Search',
      schema: z.object({ q: z.string() }),
      execute: async () => 'searched',
    } as StructuredToolDefinition

    const result = convertTools([simpleTool, structuredTool])

    expect(result).toHaveLength(2)
    expect(DynamicTool).toHaveBeenCalledTimes(1)
    expect(DynamicStructuredTool).toHaveBeenCalledTimes(1)
  })

  it('should wrap structured tool execute with async wrapper', async () => {
    const execute = vi.fn().mockResolvedValue('executed')
    const tool: StructuredToolDefinition = {
      name: 'tool',
      description: 'A tool',
      schema: z.object({ x: z.number() }),
      execute,
    }

    convertTools([tool])

    const call = mockedDynamicStructuredTool.mock.calls[0][0]
    const result = await call.func({ x: 42 })

    expect(execute).toHaveBeenCalledWith({ x: 42 })
    expect(result).toBe('executed')
  })

  it('should pass simple tool execute function directly', async () => {
    const execute = vi.fn().mockResolvedValue('hello back')
    const tool: ToolDefinition = {
      name: 'greeter',
      description: 'Greets',
      execute,
    }

    convertTools([tool])

    const call = mockedDynamicTool.mock.calls[0][0]
    const result = await call.func('hello')

    expect(execute).toHaveBeenCalledWith('hello')
    expect(result).toBe('hello back')
  })

  it('should return empty array for empty input', () => {
    const result = convertTools([])

    expect(result).toEqual([])
    expect(DynamicTool).not.toHaveBeenCalled()
    expect(DynamicStructuredTool).not.toHaveBeenCalled()
  })
})
