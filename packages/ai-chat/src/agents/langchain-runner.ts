import type { AgentRunner, ChatMessage, ModelConfig, ChatOptions, ChatChunk, ToolDefinition } from '../types'
import { convertMessages } from './message-converter'
import { createLLM } from './llm-init'
import { DynamicTool } from '@langchain/core/tools'
import { ToolMessage } from '@langchain/core/messages'

/** Extract a string input from tool call args (handles both string and object forms). */
function extractToolInput(args: Record<string, unknown> | string): string {
  if (typeof args === 'string') return args
  if (args.input !== undefined) return String(args.input)
  const strVal = Object.values(args).find((v) => typeof v === 'string')
  return strVal ? String(strVal) : JSON.stringify(args)
}

export class LangChainRunner implements AgentRunner {
  private tools?: ToolDefinition[]
  private systemPrompt?: string

  constructor(agentDef: { tools?: ToolDefinition[]; systemPrompt?: string }) {
    this.tools = agentDef.tools
    this.systemPrompt = agentDef.systemPrompt
  }

  private convertTools(tools: ToolDefinition[]): DynamicTool[] {
    return tools.map(
      (tool) =>
        new DynamicTool({
          name: tool.name,
          description: tool.description,
          func: tool.execute,
        }),
    )
  }

  async *chat(
    messages: ChatMessage[],
    model: ModelConfig,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    const signal = options?.signal
    const systemPrompt = options?.systemPrompt ?? this.systemPrompt

    try {
      if (signal?.aborted) return

      // No tools — simple token-by-token streaming
      if (!this.tools || this.tools.length === 0) {
        const llm = createLLM(model, options)
        const lcMessages = convertMessages(messages, systemPrompt)
        const stream = await llm.stream(lcMessages, { signal })
        for await (const chunk of stream) {
          if (signal?.aborted) return
          const reasoning = (chunk.additional_kwargs?.reasoning_content as string) || undefined
          yield { type: 'token', content: chunk.content as string, reasoningContent: reasoning }
        }
        yield { type: 'done' }
        return
      }

      // Tools configured — tool calling loop with invoke
      const langchainTools = this.convertTools(this.tools)
      const llm = createLLM(model, options, langchainTools)
      const lcMessages = convertMessages(messages, systemPrompt)

      const toolMap = new Map<string, ToolDefinition>()
      for (const tool of this.tools) {
        toolMap.set(tool.name, tool)
      }

      const MAX_ITERATIONS = 5
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (signal?.aborted) return

        const response = await llm.invoke(lcMessages, { signal })
        const toolCalls = response.tool_calls

        if (toolCalls && toolCalls.length > 0) {
          lcMessages.push(response)

          for (const tc of toolCalls) {
            if (signal?.aborted) return

            const tool = toolMap.get(tc.name)
            const input = extractToolInput(tc.args)

            let result: string
            try {
              result = tool ? await tool.execute(input) : `Unknown tool: ${tc.name}`
            } catch (e) {
              result = `Tool error: ${String(e)}`
            }

            lcMessages.push(
              new ToolMessage({
                content: result,
                tool_call_id: tc.id ?? '',
              }),
            )
          }
        } else {
          // No tool calls — yield the final response from invoke
          const text =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content)
          const reasoning = (response.additional_kwargs?.reasoning_content as string) || undefined
          yield { type: 'token', content: text, reasoningContent: reasoning }
          yield { type: 'done' }
          return
        }
      }

      // Max iterations reached
      yield { type: 'token', content: '\n\n⚠️ Reached maximum tool calling iterations.' }
      yield { type: 'done' }
    } catch (error) {
      yield { type: 'error', error: String(error) }
    }
  }
}
