import type { AgentRunner, ChatMessage, ModelConfig, ChatOptions, ChatChunk, TokenUsage, ToolDefinition } from '../types'
import { convertMessages } from './message-converter'
import { createLLM } from './llm-init'
import { DynamicTool, DynamicStructuredTool } from '@langchain/core/tools'
import { ToolMessage, AIMessageChunk, type BaseMessage } from '@langchain/core/messages'

/** Extract TokenUsage from LangChain response's usage_metadata. */
function extractTokenUsage(response: { usage_metadata?: Record<string, unknown> }): TokenUsage | undefined {
  const meta = response.usage_metadata
  if (!meta) return undefined
  const promptTokens = typeof meta.input_tokens === 'number' ? meta.input_tokens : 0
  const completionTokens = typeof meta.output_tokens === 'number' ? meta.output_tokens : 0
  const totalTokens = typeof meta.total_tokens === 'number' ? meta.total_tokens : promptTokens + completionTokens
  if (promptTokens === 0 && completionTokens === 0) return undefined
  // LangChain maps completion_tokens_details.reasoning_tokens → output_token_details.reasoning
  const outputDetails = meta.output_token_details as Record<string, unknown> | undefined
  const reasoningTokens = typeof outputDetails?.reasoning === 'number' ? outputDetails.reasoning : undefined
  return { promptTokens, completionTokens, totalTokens, reasoningTokens }
}

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

  private convertTools(tools: ToolDefinition[]): (DynamicTool | DynamicStructuredTool)[] {
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
        let lastChunk: { usage_metadata?: Record<string, unknown> } | null = null
        for await (const chunk of stream) {
          if (signal?.aborted) return
          lastChunk = chunk as { usage_metadata?: Record<string, unknown> }
          const reasoning = (chunk.additional_kwargs?.reasoning_content as string) || undefined
          yield { type: 'token', content: chunk.content as string, reasoningContent: reasoning }
        }
        yield { type: 'done', tokenUsage: lastChunk ? extractTokenUsage(lastChunk) : undefined }
        return
      }

      // Tools configured — tool calling loop with streaming
      const langchainTools = this.convertTools(this.tools)
      const llm = createLLM(model, options, langchainTools)
      const lcMessages: BaseMessage[] = convertMessages(messages, systemPrompt)

      const toolMap = new Map<string, ToolDefinition>()
      for (const tool of this.tools) {
        toolMap.set(tool.name, tool)
      }

      const MAX_ITERATIONS = 5
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (signal?.aborted) return

        const stream = await llm.stream(lcMessages, { signal })
        let accumulated: AIMessageChunk | null = null

        for await (const chunk of stream) {
          if (signal?.aborted) return

          const content = typeof chunk.content === 'string' ? chunk.content : ''
          const reasoning = (chunk.additional_kwargs?.reasoning_content as string) || undefined

          if (content || reasoning) {
            yield { type: 'token', content, reasoningContent: reasoning }
          }

          // Accumulate chunks to build complete tool_calls after stream ends
          accumulated = accumulated ? accumulated.concat(chunk) : chunk
        }

        if (!accumulated) continue

        const toolCalls = accumulated.tool_calls

        if (toolCalls && toolCalls.length > 0) {
          lcMessages.push(accumulated)

          for (const tc of toolCalls) {
            if (signal?.aborted) return

            const tool = toolMap.get(tc.name)

            let result: string
            try {
              if (tool) {
                if ('schema' in tool) {
                  // Structured tool — pass raw args object directly
                  result = await tool.execute(tc.args as never)
                } else {
                  // Simple tool — extract string input
                  result = await tool.execute(extractToolInput(tc.args))
                }
              } else {
                result = `Unknown tool: ${tc.name}`
              }
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
          // No tool calls — tokens already streamed, just yield done
          const tokenUsage = extractTokenUsage(
            accumulated as unknown as { usage_metadata?: Record<string, unknown> },
          )
          yield { type: 'done', tokenUsage }
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
