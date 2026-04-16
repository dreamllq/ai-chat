import type { AgentRunner, AgentDefinition, ChatMessage, ModelConfig, ChatOptions, ChatChunk, TokenUsage, ToolDefinition, SubAgentCallInfo, SubAgentLogEntry, StructuredToolDefinition, SkillDefinition } from '../types'
import { convertMessages } from './message-converter'
import { createLLM } from './llm-init'
import { convertTools } from './tool-converter'
import { agentRegistry } from '../services/agent'
import { getLocaleInstruction } from '../locales'
import { ToolMessage, type BaseMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { mergeAsyncGenerators } from './async-generator-merge'

const DEFAULT_MAX_DEPTH = 99
const DEFAULT_MAX_TOOL_ITERATIONS = 99
const MAX_OUTPUT_LENGTH = 10000
const MAX_PARALLEL_CALLS = 5

export class DeepAgentRunner implements AgentRunner {
  private agentDef: AgentDefinition
  private maxDepth: number
  private maxToolIterations: number
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

    const allAgentDefs = agentRegistry.getAllDefinitions()
    const allowedDefs = this.agentDef.allowedAgents
      ? allAgentDefs.filter(a => this.agentDef.allowedAgents!.includes(a.id))
      : allAgentDefs
    const callAgentTool = this.buildCallAgentTool(allowedDefs)

    const parallelCallTool = this.buildParallelCallTool(allowedDefs)
    const allTools: ToolDefinition[] = [...(this.agentDef.tools ?? []), callAgentTool, parallelCallTool]
    if (this.agentDef.skills && this.agentDef.skills.length > 0) {
      allTools.push(this.buildUseSkillTool(this.agentDef.skills))
    }
    const lcTools = convertTools(allTools)

    const basePrompt = options?.systemPrompt ?? this.agentDef.systemPrompt
    const localePrompt = options?.locale
      ? appendLocaleInstruction(basePrompt, options.locale)
      : basePrompt
    const enhancedPrompt = this.buildSkillsSystemPrompt(localePrompt)
    const llm = createLLM(model, options, lcTools)
    const lcMessages = convertMessages(messages, enhancedPrompt)

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

        const stream = await llm.stream(currentMessages, { signal: options?.signal })

        let accUsageMetadata: Record<string, unknown> | undefined
        let accumulated: BaseMessage | undefined

        for await (const chunk of stream) {
          if (options?.signal?.aborted) return

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

        // Separate parallel_call from other tool calls
        const parallelTc = accToolCalls.find(tc => tc.name === 'parallel_call')
        const sequentialTcs = accToolCalls.filter(tc => tc.name !== 'parallel_call')

        // 1. Process sequential calls (call_agent, use_skill, regular tools)
        for (const tc of sequentialTcs) {
          let result: string
          if (tc.name === 'call_agent') {
            const agentId = tc.args.agentId as string
            const task = tc.args.task as string

            const validationError = this.validateCallAgent(agentId, callStack, currentDepth)
            if (validationError) {
              result = validationError
            } else {
              result = yield* this.runSubAgent(agentId, task, callStack, currentDepth, options, model)
            }
          } else if (tc.name === 'use_skill') {
            const skillName = tc.args.skill_name as string
            result = this.resolveSkill(skillName)
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

        // 2. Process parallel_call (if present)
        if (parallelTc) {
          const calls = (parallelTc.args.calls as Array<{ agentId: string; task: string }>) ?? []
          const result = yield* this.executeParallelCalls(calls, callStack, currentDepth, options, model)
          currentMessages.push(new ToolMessage({ content: result, tool_call_id: parallelTc.id! }))
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      yield {
        type: 'error' as const,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  private validateCallAgent(agentId: string, callStack: string[], currentDepth: number): string | null {
    if (this.agentDef.allowedAgents && !this.agentDef.allowedAgents.includes(agentId)) {
      return `Error: Agent "${agentId}" is not in the allowed agents list.`
    }

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
        locale: parentOptions?.locale,
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
        } else if (chunk.type === 'iteration_start') {
          yield {
            type: 'sub_agent_log' as const,
            logEntry: { timestamp: Date.now(), type: 'iteration_start', content: `Iteration ${(chunk.iteration ?? 0) + 1}` },
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

    yield { type: 'sub_agent_end' as const, subAgent: { ...subAgentInfo }, tokenUsage: subTokenUsage }

    if (output.length > MAX_OUTPUT_LENGTH) {
      output = output.slice(0, MAX_OUTPUT_LENGTH) + '\n...[output truncated]'
    }

    return output
  }

  private async *executeParallelCalls(
    calls: Array<{ agentId: string; task: string }>,
    callStack: string[],
    currentDepth: number,
    parentOptions: ChatOptions | undefined,
    model: ModelConfig,
  ): AsyncGenerator<ChatChunk, string, unknown> {
    if (calls.length < 2) {
      return 'Error: parallel_call requires at least 2 sub-agent calls.'
    }

    const validCalls = calls.slice(0, MAX_PARALLEL_CALLS)
    const excessCalls = calls.slice(MAX_PARALLEL_CALLS)

    const collectors: Array<{
      agentId: string
      agentName: string
      task: string
      output: string
      tokenUsage?: TokenUsage
      status: 'completed' | 'failed'
    }> = []

    const generators: AsyncGenerator<ChatChunk>[] = []

    for (const call of validCalls) {
      const validationError = this.validateCallAgent(call.agentId, callStack, currentDepth)
      const agentDef = agentRegistry.getDefinition(call.agentId)
      const agentName = agentDef?.name ?? call.agentId

      if (validationError) {
        collectors.push({
          agentId: call.agentId,
          agentName,
          task: call.task,
          output: validationError,
          status: 'failed',
        })
        continue
      }

      const runner = agentRegistry.getRunner(call.agentId)
      if (!runner) {
        collectors.push({
          agentId: call.agentId,
          agentName,
          task: call.task,
          output: `Error: Agent "${call.agentId}" not found.`,
          status: 'failed',
        })
        continue
      }

      const collector = {
        agentId: call.agentId,
        agentName,
        task: call.task,
        output: '',
        tokenUsage: undefined as TokenUsage | undefined,
        status: 'completed' as 'completed' | 'failed',
      }
      collectors.push(collector)

      const subGen = this.runSubAgent(call.agentId, call.task, callStack, currentDepth, parentOptions, model)
      const wrappedGen = (async function* (): AsyncGenerator<ChatChunk> {
        try {
          for await (const chunk of subGen) {
            if (chunk.type === 'sub_agent_log' && chunk.logEntry?.type === 'done') {
              collector.output = chunk.logEntry.content ?? ''
            }
            if (chunk.type === 'sub_agent_end') {
              collector.status = chunk.subAgent?.status === 'failed' ? 'failed' : 'completed'
              collector.tokenUsage = chunk.tokenUsage
            }
            yield chunk
          }
        } catch (err) {
          collector.status = 'failed'
          collector.output = `Error: ${err instanceof Error ? err.message : String(err)}`
        }
      })()
      generators.push(wrappedGen)
    }

    for (const excess of excessCalls) {
      const agentDef = agentRegistry.getDefinition(excess.agentId)
      collectors.push({
        agentId: excess.agentId,
        agentName: agentDef?.name ?? excess.agentId,
        task: excess.task,
        output: `Error: Exceeds maximum concurrent calls limit (${MAX_PARALLEL_CALLS}).`,
        status: 'failed',
      })
    }

    if (generators.length > 0) {
      const merged = mergeAsyncGenerators(generators)
      for await (const chunk of merged) {
        yield chunk
      }
    }

    const sections = collectors.map(c => {
      const statusIcon = c.status === 'completed' ? '✅' : '❌'
      return `### Agent: ${c.agentName} (ID: ${c.agentId}) — ${statusIcon} ${c.status}\n${c.output}`
    })

    return `## Parallel Execution Results\n\n${sections.join('\n\n')}`
  }

  private buildSkillsSystemPrompt(basePrompt?: string): string | undefined {
    const skills = this.agentDef.skills
    if (!skills || skills.length === 0) return basePrompt

    const skillLines = skills
      .map(s => `- **${s.name}**: ${s.description}`)
      .join('\n')

    const skillsSection = `\n\n## Available Skills\n\nYou have access to the following skills:\n\n${skillLines}\n\nTo use a skill, call the \`use_skill\` tool with the skill name. The tool will return detailed instructions that you should follow.`

    return basePrompt ? basePrompt + skillsSection : skillsSection.trim()
  }

  private buildUseSkillTool(skills: SkillDefinition[]): StructuredToolDefinition {
    const skillNames = skills.map(s => s.name)
    const description = `Load the full instructions for a skill by name. Use this when the user's task matches a skill's description.\n\nAvailable skills: ${skillNames.join(', ')}`

    return {
      name: 'use_skill',
      description,
      schema: z.object({
        skill_name: z.string().describe('The name of the skill to load'),
      }),
      execute: async () => '',
    }
  }

  private resolveSkill(skillName: string): string {
    const skill = this.agentDef.skills?.find(s => s.name === skillName)
    if (!skill) {
      const available = this.agentDef.skills?.map(s => s.name).join(', ') ?? ''
      return `Error: Skill "${skillName}" not found. Available skills: ${available}`
    }
    return skill.instructions
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

  private buildParallelCallTool(allAgentDefs: AgentDefinition[]): StructuredToolDefinition {
    const selfId = this.agentDef.id
    const otherAgents = allAgentDefs.filter(a => a.id !== selfId)

    const agentList = otherAgents.length > 0
      ? otherAgents.map(a => `- ${a.id}: ${a.name}${a.description ? ` — ${a.description}` : ''}`).join('\n')
      : 'No other agents registered.'

    const description = `Execute multiple sub-agent calls in parallel. Provide at least 2 agent-task pairs. All calls execute concurrently, and results are aggregated into a single response.\n\nAvailable agents:\n${agentList}\n\nMaximum concurrent calls: ${MAX_PARALLEL_CALLS}`

    return {
      name: 'parallel_call',
      description,
      schema: z.object({
        calls: z.array(
          z.object({
            agentId: z.string().describe('The ID of the agent to call'),
            task: z.string().describe('A clear description of the task for the sub-agent'),
          })
        ).min(2).describe('At least 2 sub-agent calls to execute in parallel'),
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

function appendLocaleInstruction(basePrompt: string | undefined, locale: string): string {
  const instruction = getLocaleInstruction(locale)
  return basePrompt ? `${basePrompt}\n\n${instruction}` : instruction
}
