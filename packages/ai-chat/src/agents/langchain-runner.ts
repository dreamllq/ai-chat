import type { AgentRunner, ChatMessage, ModelConfig, ChatOptions, ChatChunk, TokenUsage, ToolDefinition, SkillDefinition, MCPServerConfig } from '../types'
import { convertMessages } from './message-converter'
import { createLLM } from './llm-init'
import { convertTools } from './tool-converter'
import { convertSkillsToTools } from './skill-converter'
import { MCPClient } from './mcp-client'
import { ToolMessage, type BaseMessage } from '@langchain/core/messages'

const MAX_TOOL_ITERATIONS = 99

export class LangChainRunner implements AgentRunner {
  private tools: ToolDefinition[]
  private skills: SkillDefinition[]
  private systemPrompt?: string
  private mcpClient: MCPClient | null

  constructor(agentDef: { tools?: ToolDefinition[]; skills?: SkillDefinition[]; systemPrompt?: string; mcpServers?: MCPServerConfig[] }) {
    this.tools = agentDef.tools ?? []
    this.skills = agentDef.skills ?? []
    this.systemPrompt = agentDef.systemPrompt
    this.mcpClient = agentDef.mcpServers && agentDef.mcpServers.length > 0
      ? new MCPClient(agentDef.mcpServers)
      : null
  }

  async *chat(
    messages: ChatMessage[],
    model: ModelConfig,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    if (options?.signal?.aborted) return

    const skillTools = convertSkillsToTools(this.skills)
    const mcpTools = this.mcpClient ? await this.mcpClient.getTools() : []
    const allTools = [...this.tools, ...skillTools, ...mcpTools]
    const lcTools = allTools.length > 0 ? convertTools(allTools) : undefined

    const systemPrompt = options?.systemPrompt ?? this.systemPrompt
    const llm = createLLM(model, options, lcTools)
    const lcMessages = convertMessages(messages, systemPrompt)

    let currentMessages: BaseMessage[] = [...lcMessages]
    let iteration = 0
    let previousIterationTokenUsage: TokenUsage | undefined

    try {
      while (iteration < MAX_TOOL_ITERATIONS) {
        if (options?.signal?.aborted) return

        yield { type: 'iteration_start' as const, iteration, ...(previousIterationTokenUsage && { tokenUsage: previousIterationTokenUsage }) }
        previousIterationTokenUsage = undefined

        const stream = await llm.stream(currentMessages)

        let accUsageMetadata: Record<string, unknown> | undefined
        let accumulated: BaseMessage | undefined

        for await (const chunk of stream) {
          const ch = chunk as unknown as Record<string, unknown>

          if (ch.usage_metadata) {
            accUsageMetadata = ch.usage_metadata as Record<string, unknown>
          }
          accumulated = accumulated
            ? (accumulated as unknown as { concat(other: unknown): BaseMessage }).concat(chunk)
            : (chunk as BaseMessage)

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

        // Extract tool_calls from the fully accumulated message — individual streaming chunks
        // may have partial/incomplete args. Only after concat() are tool_calls fully resolved.
        const accToolCalls = (accumulated as unknown as { tool_calls?: Array<{ name: string; args: Record<string, unknown>; id: string }> }).tool_calls ?? []

        if (accToolCalls.length === 0) {
          const tokenUsage = extractTokenUsage(accUsageMetadata)
          yield { type: 'done' as const, ...(tokenUsage && { tokenUsage }) }
          return
        }

        previousIterationTokenUsage = extractTokenUsage(accUsageMetadata)
        iteration++
        if (iteration >= MAX_TOOL_ITERATIONS) {
          yield { type: 'token' as const, content: '\n\n⚠️ Reached maximum tool calling iterations.' }
          yield { type: 'done' as const }
          return
        }

        currentMessages.push(accumulated!)

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
  const details = metadata.completion_tokens_details as Record<string, unknown> | undefined
  const reasoningTokens = (details?.reasoning_tokens as number) || undefined
  return { promptTokens, completionTokens, totalTokens, reasoningTokens }
}
