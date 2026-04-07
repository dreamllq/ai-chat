import type { AgentRunner, AgentDefinition, ChatMessage, ModelConfig, ChatOptions, ChatChunk, TokenUsage, ToolDefinition, SkillDefinition, SubAgentCallInfo, SubAgentLogEntry, StructuredToolDefinition } from '../types'
import { convertMessages } from './message-converter'
import { createLLM } from './llm-init'
import { convertTools } from './tool-converter'
import { convertSkillsToTools } from './skill-converter'
import { agentRegistry } from '../services/agent'
import { ToolMessage, type BaseMessage } from '@langchain/core/messages'
import { z } from 'zod'

const DEFAULT_MAX_DEPTH = 99
const DEFAULT_MAX_TOOL_ITERATIONS = 99
const MAX_OUTPUT_LENGTH = 10000

export class DeepAgentRunner implements AgentRunner {
  private agentDef: AgentDefinition
  private maxDepth: number
  private maxToolIterations: number
  private _lastSubAgentTokenUsage: TokenUsage | undefined

  constructor(agentDef: AgentDefinition, options?: { maxDepth?: number; maxToolIterations?: number }) {
    this.agentDef = agentDef
    this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH
    this.maxToolIterations = options?.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS
  }

  async *chat(
    messages: ChatMessage[],
    model: ModelConfig,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    if (options?.signal?.aborted) return

    const callAgentTool = this.buildCallAgentTool(agentRegistry.getAllDefinitions())

    const skillTools = convertSkillsToTools(this.agentDef.skills ?? [])
    const allTools: ToolDefinition[] = [...(this.agentDef.tools ?? []), ...skillTools, callAgentTool]
    const lcTools = convertTools(allTools)

    const systemPrompt = options?.systemPrompt ?? this.agentDef.systemPrompt
    const llm = createLLM(model, options, lcTools)
    const lcMessages = convertMessages(messages, systemPrompt)

    const callStack = (options as ChatOptions & { _callStack?: string[] } | undefined)?._callStack ?? []
    const currentDepth = callStack.length

    let currentMessages: BaseMessage[] = [...lcMessages]
    let iteration = 0
    let previousIterationTokenUsage: TokenUsage | undefined

    try {
      while (iteration < this.maxToolIterations) {
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

        const accToolCalls = (accumulated as unknown as { tool_calls?: Array<{ name: string; args: Record<string, unknown>; id: string }> }).tool_calls ?? []
        const iterationTokenUsage = extractTokenUsage(accUsageMetadata)

        if (accToolCalls.length === 0) {
          yield { type: 'done' as const, ...(iterationTokenUsage && { tokenUsage: iterationTokenUsage }) }
          return
        }

        previousIterationTokenUsage = iterationTokenUsage

        iteration++
        if (iteration >= this.maxToolIterations) {
          yield { type: 'token' as const, content: '\n\n⚠️ Reached maximum tool calling iterations.' }
          yield { type: 'done' as const }
          return
        }

        currentMessages.push(accumulated!)

        for (const tc of accToolCalls) {
          let result: string
          let subAgentTokenUsage: TokenUsage | undefined

          if (tc.name === 'call_agent') {
            const agentId = tc.args.agentId as string
            const task = tc.args.task as string

            const validationError = this.validateCallAgent(agentId, callStack, currentDepth)
            if (validationError) {
              result = validationError
            } else {
              result = yield* this.runSubAgent(agentId, task, callStack, currentDepth, options, model)
              subAgentTokenUsage = this._lastSubAgentTokenUsage
            }
          } else {
            const tool = allTools.find(t => t.name === tc.name)
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

  private validateCallAgent(agentId: string, callStack: string[], currentDepth: number): string | null {
    if (agentId === this.agentDef.id) {
      return `Error: Agent "${agentId}" cannot call itself.`
    }

    const fullCallStack = [...callStack, this.agentDef.id]
    if (fullCallStack.includes(agentId)) {
      return `Error: Circular call detected. Agent "${agentId}" is already in the call stack.`
    }

    if (currentDepth + 1 >= this.maxDepth) {
      return `Error: Maximum call depth (${this.maxDepth}) reached. Cannot call agent "${agentId}".`
    }

    return null
  }

  private async *runSubAgent(
    agentId: string,
    task: string,
    callStack: string[],
    currentDepth: number,
    parentOptions: ChatOptions | undefined,
    model: ModelConfig,
  ): AsyncGenerator<ChatChunk, string, unknown> {
    const runner = agentRegistry.getRunner(agentId)
    if (!runner) {
      return `Error: Agent "${agentId}" not found.`
    }

    const agentDef = agentRegistry.getDefinition(agentId)
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const startTime = Date.now()

    const subAgentInfo: SubAgentCallInfo = {
      executionId,
      agentId,
      agentName: agentDef?.name ?? agentId,
      task,
      status: 'running',
      startTime,
      endTime: null,
      depth: currentDepth + 1,
    }

    yield { type: 'sub_agent_start' as const, subAgent: { ...subAgentInfo } }

    let output = ''
    let failed = false
    let subTokenUsage: TokenUsage | undefined

    try {
      const subMessages: ChatMessage[] = [{
        id: `sub-${executionId}`,
        conversationId: '',
        role: 'user',
        content: task,
        timestamp: Date.now(),
      }]

      const subOptions: ChatOptions & { _callStack?: string[] } = {
        signal: parentOptions?.signal,
        _callStack: [...callStack, this.agentDef.id],
      }

      for await (const chunk of runner.chat(subMessages, model, subOptions)) {
        if (chunk.type === 'token') {
          if (chunk.content) {
            output += chunk.content
          }
          if (chunk.reasoningContent) {
            yield {
              type: 'sub_agent_log' as const,
              logEntry: { timestamp: Date.now(), type: 'reasoning', content: chunk.reasoningContent },
              subAgent: { ...subAgentInfo },
            }
          }
          yield {
            type: 'sub_agent_log' as const,
            logEntry: { timestamp: Date.now(), type: 'token', content: chunk.content ?? '' },
            subAgent: { ...subAgentInfo },
          }
        } else if (chunk.type === 'done') {
          subTokenUsage = chunk.tokenUsage
          yield {
            type: 'sub_agent_log' as const,
            logEntry: { timestamp: Date.now(), type: 'done', content: output },
            subAgent: { ...subAgentInfo },
          }
        } else if (chunk.type === 'error') {
          failed = true
          output = `Error: ${chunk.error ?? 'Unknown error'}`
          yield {
            type: 'sub_agent_log' as const,
            logEntry: { timestamp: Date.now(), type: 'error', content: chunk.error ?? 'Unknown error' },
            subAgent: { ...subAgentInfo },
          }
        } else if (chunk.type === 'sub_agent_start' || chunk.type === 'sub_agent_log' || chunk.type === 'sub_agent_end') {
          yield chunk
        }
      }
    } catch (err) {
      failed = true
      output = `Error: ${err instanceof Error ? err.message : String(err)}`
      yield {
        type: 'sub_agent_log' as const,
        logEntry: { timestamp: Date.now(), type: 'error', content: err instanceof Error ? err.message : String(err) },
        subAgent: { ...subAgentInfo },
      }
    }

    const endTime = Date.now()
    subAgentInfo.endTime = endTime
    subAgentInfo.status = failed ? 'failed' : 'completed'

    this._lastSubAgentTokenUsage = subTokenUsage

    yield { type: 'sub_agent_end' as const, subAgent: { ...subAgentInfo }, tokenUsage: subTokenUsage }

    if (output.length > MAX_OUTPUT_LENGTH) {
      output = output.slice(0, MAX_OUTPUT_LENGTH) + '\n...[output truncated]'
    }

    return output
  }

  private buildCallAgentTool(allAgentDefs: AgentDefinition[]): StructuredToolDefinition {
    const selfId = this.agentDef.id
    const otherAgents = allAgentDefs.filter(a => a.id !== selfId)

    const agentList = otherAgents.length > 0
      ? otherAgents.map(a => `- ${a.id}: ${a.name}${a.description ? ` — ${a.description}` : ''}`).join('\n')
      : 'No other agents registered.'

    const description = `Delegate a task to a sub-agent. Provide the agent ID and a clear description of the task.\n\nAvailable agents:\n${agentList}`

    return {
      name: 'call_agent',
      description,
      schema: z.object({
        agentId: z.string().describe('The ID of the agent to call'),
        task: z.string().describe('A clear description of the task for the sub-agent'),
      }),
      execute: async () => '',
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
