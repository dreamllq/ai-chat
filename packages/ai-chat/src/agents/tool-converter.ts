import type { ToolDefinition } from '../types'
import { DynamicTool, DynamicStructuredTool } from '@langchain/core/tools'

/**
 * Convert framework-agnostic ToolDefinition[] to LangChain-compatible tool instances.
 * - Structured tools (with `schema`) become DynamicStructuredTool
 * - Simple tools (no schema) become DynamicTool
 */
export function convertTools(tools: ToolDefinition[]): (DynamicTool | DynamicStructuredTool)[] {
  return tools.map((tool) => {
    if ('schema' in tool) {
      // Structured tool — pass schema to LangChain, DynamicStructuredTool
      return new DynamicStructuredTool({
        name: tool.name,
        description: tool.description,
        schema: tool.schema,
        func: async (input: unknown) => tool.execute(input as never),
      })
    }
    // Simple tool — no schema, use DynamicTool
    return new DynamicTool({
      name: tool.name,
      description: tool.description,
      func: tool.execute,
    })
  })
}
