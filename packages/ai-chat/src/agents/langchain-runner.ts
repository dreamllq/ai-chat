import type { AgentRunner, ChatMessage, ModelConfig, ChatOptions, ChatChunk, TokenUsage, ToolDefinition, SkillDefinition } from '../types'
import { convertMessages } from './message-converter'
import { createLLM } from './llm-init'
import { convertTools } from './tool-converter'
import { convertSkillsToTools } from './skill-converter'
import { ToolMessage, type BaseMessage } from '@langchain/core/messages'

const MAX_TOOL_ITERATIONS = 5

export class LangChainRunner implements AgentRunner {
  private tools: ToolDefinition[]
  private skills: SkillDefinition[]
  private systemPrompt?: string

  constructor(agentDef: { tools?: ToolDefinition[]; skills?: SkillDefinition[]; systemPrompt?: string }) {
    this.tools = agentDef.tools ?? []
    this.skills = agentDef.skills ?? []
    this.systemPrompt = agentDef.systemPrompt
  }

  async *chat(
    messages: ChatMessage[],
    model: ModelConfig,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    if (options?.signal?.aborted) return

    const skillTools = convertSkillsToTools(this.skills)
    const allTools = [...this.tools, ...skillTools]
    const lcTools = allTools.length > 0 ? convertTools(allTools) : undefined

    const systemPrompt = options?.systemPrompt ?? this.systemPrompt
    const llm = createLLM(model, options, lcTools)
    const lcMessages = convertMessages(messages, systemPrompt)

    let currentMessages: BaseMessage[] = [...lcMessages]
    let iteration = 0

    try {
      while (iteration < MAX_TOOL_ITERATIONS) {
        if (options?.signal?.aborted) return

        const stream = await llm.stream(currentMessages)

        let accToolCalls: Array<{ name: string; args: Record<string, unknown>; id: string }> = []
        let accUsageMetadata: Record<string, unknown> | undefined
        let rawAccumulated: unknown

        for await (const chunk of stream) {
          const ch = chunk as unknown as Record<string, unknown>

          if (ch.tool_calls && (ch.tool_calls as Array<unknown>).length > 0) {
            accToolCalls = ch.tool_calls as typeof accToolCalls
          }
          if (ch.usage_metadata) {
            accUsageMetadata = ch.usage_metadata as Record<string, unknown>
          }
          rawAccumulated = chunk

          const content = ch.content as string
          const reasoningContent = (ch.additional_kwargs as Record<string, unknown> | undefined)?.reasoning_content as string | undefined
          if (content || reasoningContent !== undefined) {
            yield {
              type: 'token' as const,
              content,
              ...(reasoningContent !== undefined && { reasoningContent }),
            }
          }
        }

        if (accToolCalls.length === 0) {
          const tokenUsage = extractTokenUsage(accUsageMetadata)
          yield { type: 'done' as const, ...(tokenUsage && { tokenUsage }) }
          return
        }

        iteration++
        if (iteration >= MAX_TOOL_ITERATIONS) {
          yield { type: 'token' as const, content: '\n\n⚠️ Reached maximum tool calling iterations.' }
          yield { type: 'done' as const }
          return
        }

        currentMessages.push(rawAccumulated as BaseMessage)

        for (const tc of accToolCalls) {
          const tool = allTools.find(t => t.name === tc.name)
          let result: string
          if (!tool) {
            result = `Error: Unknown tool "${tc.name}"`
          } else {
            try {
              if ('schema' in tool) {
                result = await tool.execute(tc.args)
              } else {
                const input = typeof tc.args === 'string'
                  ? tc.args
                  : (tc.args as Record<string, unknown>).input ?? JSON.stringify(tc.args)
                result = await tool.execute(input as string)
              }
            } catch (err) {
              result = `Error: ${err instanceof Error ? err.message : String(err)}`
            }
          }
          currentMessages.push(new ToolMessage({ content: result, tool_call_id: tc.id! }))
        }
      }
    } catch (err) {
      yield {
        type: 'error' as const,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}

function extractTokenUsage(metadata?: Record<string, unknown>): TokenUsage | undefined {
  if (!metadata) return undefined
  const promptTokens = (metadata.input_tokens as number) ?? 0
  const completionTokens = (metadata.output_tokens as number) ?? 0
  const totalTokens = (metadata.total_tokens as number) ?? 0
  if (!promptTokens && !completionTokens && !totalTokens) return undefined
  return { promptTokens, completionTokens, totalTokens }
}
