import { ref, onUnmounted } from 'vue'
import { useSession } from './useSession'
import { useModel } from './useModel'
import { agentRegistry } from '../services/agent'
import { MessageService, ConversationService, SubAgentExecutionService } from '../services/database'
import { TitleGenerator } from '../agents/title-generator'
import type { MessageAttachment, SubAgentCallInfo, SubAgentLogEntry, TokenUsage, MessageStep, ThinkingStep } from '../types'
import type { AiChatLocale, LocaleName } from '../locales'

// Module-level singleton state — shared across all useChat() callers
const isStreaming = ref(false)
let abortController: AbortController | null = null

const INITIAL_TITLE_MAX_LENGTH = 30

function resolveLocaleName(locale: AiChatLocale | LocaleName): string {
  return typeof locale === 'string' ? locale : 'en'
}

export function useChat() {
  const { currentConversation, currentConversationId, currentMessages } =
    useSession()
  const { models } = useModel()
  const messageService = new MessageService()
  const conversationService = new ConversationService()
  const subAgentExecutionService = new SubAgentExecutionService()

  async function sendMessage(
    content: string,
    attachments?: MessageAttachment[],
    options?: { locale?: AiChatLocale | LocaleName },
  ): Promise<void> {
    console.log('[useChat] sendMessage called', { content })

    const conversation = currentConversation.value
    const conversationId = currentConversationId.value

    // Resolve model from conversation's modelId (per-conversation binding)
    const model = conversation
      ? models.value?.find(m => m.id === conversation.modelId)
      : undefined

    console.log('[useChat] state:', {
      hasModel: !!model,
      modelName: model?.name,
      hasConversation: !!conversation,
      conversationId,
      agentId: conversation?.agentId,
    })

    // Guard: no model configured
    if (!model) {
      console.warn('[useChat] BLOCKED: no model selected. Create one in Model Manager first.')
      return
    }

    // Guard: no active conversation
    if (!conversation || !conversationId) {
      console.warn('[useChat] BLOCKED: no active conversation. Create one first.')
      return
    }

    const isFirstMessage = currentMessages.value.length === 0

    const runner = agentRegistry.getRunner(conversation.agentId)
    console.log('[useChat] runner for agent:', conversation.agentId, runner ? 'FOUND' : 'NOT FOUND')

    // File attachments are now pre-built by the useFileUpload composable
    const fileAttachments = attachments && attachments.length > 0 ? attachments : undefined

    // Save user message to IndexDB
    await messageService.create({
      conversationId,
      role: 'user',
      content,
      metadata: fileAttachments
        ? { files: fileAttachments }
        : undefined,
    })
    console.log('[useChat] user message saved')

    // Set initial title from first message content
    if (isFirstMessage) {
      const initialTitle =
        content.length > INITIAL_TITLE_MAX_LENGTH
          ? content.slice(0, INITIAL_TITLE_MAX_LENGTH) + '...'
          : content
      await conversationService.update(conversationId, { title: initialTitle })
    }

    // Agent not found — create assistant error message
    if (!runner) {
      await messageService.create({
        conversationId,
        role: 'assistant',
        content: 'Error: Agent not found',
      })
      console.warn('[useChat] no runner found for agent:', conversation.agentId)
      return
    }

    // Create placeholder assistant message (streaming)
    const assistantMsg = await messageService.create({
      conversationId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    })
    console.log('[useChat] assistant placeholder created')

    isStreaming.value = true
    abortController = new AbortController()

    let tokenUsage: TokenUsage | undefined
    let streamingFinalized = false

    try {
      const history = await messageService.getByConversationId(conversationId)
      const messagesForAgent = history.filter((m) => m.id !== assistantMsg.id)
      console.log('[useChat] calling runner.chat() with', messagesForAgent.length, 'messages')

      const generator = runner.chat(messagesForAgent, model, {
        signal: abortController.signal,
        locale: options?.locale ? resolveLocaleName(options.locale) : undefined,
      })

      let fullContent = ''
      let fullReasoning = ''
      let hadReasoning = false
      let reasoningDoneFired = false
      const subAgentLogBuffer: Record<string, SubAgentLogEntry[]> = {}
      const outputAccumulators: Record<string, string> = {}
      const reasoningAccumulators: Record<string, string> = {}
      const pendingThrottledUpdates: Record<string, ReturnType<typeof setTimeout>> = {}
      const finalizedExecutions = new Set<string>()
      const THROTTLE_MS = 200

      // Steps tracking
      let iterationAware = false
      let currentThinkingStep: ThinkingStep | null = null
      const steps: MessageStep[] = []

      function finalizeCurrentThinkingStep(tokenUsageOverride?: TokenUsage): void {
        if (currentThinkingStep) {
          if (tokenUsageOverride) {
            currentThinkingStep.tokenUsage = tokenUsageOverride
          }
          currentThinkingStep = null
        }
      }

      function updateStepsToDB(): Promise<unknown> {
        return messageService.update(assistantMsg.id, {
          steps: [...steps],
        })
      }

      function scheduleThrottledExecutionUpdate(executionId: string) {
        if (pendingThrottledUpdates[executionId]) return
        if (finalizedExecutions.has(executionId)) return
        pendingThrottledUpdates[executionId] = setTimeout(async () => {
          delete pendingThrottledUpdates[executionId]
          if (finalizedExecutions.has(executionId)) return
          const output = outputAccumulators[executionId] ?? null
          const reasoningContent = reasoningAccumulators[executionId] ?? null
          const logs = subAgentLogBuffer[executionId] ?? []
          try {
            await subAgentExecutionService.update(executionId, {
              output,
              reasoningContent,
              logs,
            })
          } catch (e) {
            console.warn('[useChat] throttled execution update failed:', e)
          }
        }, THROTTLE_MS)
      }
      for await (const chunk of generator) {
        if (chunk.type === 'iteration_start') {
          iterationAware = true
          // Retroactive tokenUsage fix: assign iteration_start tokenUsage to last thinking step without tokenUsage
          if (chunk.tokenUsage && !currentThinkingStep) {
            for (let i = steps.length - 1; i >= 0; i--) {
              if (steps[i].type === 'thinking' && !steps[i].tokenUsage) {
                steps[i].tokenUsage = chunk.tokenUsage
                break
              }
            }
          }
          // Finalize previous thinking step
          finalizeCurrentThinkingStep(chunk.tokenUsage)
          // Create new thinking step
          currentThinkingStep = { type: 'thinking', content: '' }
          steps.push(currentThinkingStep)
          await updateStepsToDB()
        } else if (chunk.type === 'token') {
          if (chunk.content) {
            fullContent += chunk.content
          }
          if (chunk.reasoningContent) {
            fullReasoning += chunk.reasoningContent
            hadReasoning = true
            if (iterationAware && currentThinkingStep) {
              currentThinkingStep.content += chunk.reasoningContent
            }
          }
          if (iterationAware) {
            // Detect reasoning→content transition
            if (hadReasoning && !reasoningDoneFired && fullContent && !chunk.reasoningContent) {
              reasoningDoneFired = true
              await messageService.update(assistantMsg.id, {
                content: fullContent,
                reasoningContent: fullReasoning || undefined,
                steps: [...steps],
                metadata: { ...assistantMsg.metadata, reasoningDone: true },
              })
            } else {
              await messageService.update(assistantMsg.id, {
                content: fullContent,
                reasoningContent: fullReasoning || undefined,
                steps: [...steps],
              })
            }
          } else {
            // Legacy path (no iteration_start received)
            if (hadReasoning && !reasoningDoneFired && fullContent && !chunk.reasoningContent) {
              reasoningDoneFired = true
              await messageService.update(assistantMsg.id, {
                content: fullContent,
                reasoningContent: fullReasoning || undefined,
                metadata: { ...assistantMsg.metadata, reasoningDone: true },
              })
            } else {
              await messageService.update(assistantMsg.id, {
                content: fullContent,
                reasoningContent: fullReasoning || undefined,
              })
            }
          }
        } else if (chunk.type === 'error') {
          fullContent += `\n\n⚠️ Error: ${chunk.error}`
          await messageService.update(assistantMsg.id, {
            content: fullContent,
            reasoningContent: fullReasoning || undefined,
            isStreaming: false,
            steps: iterationAware ? [...steps] : undefined,
            ...(hadReasoning && !reasoningDoneFired ? { metadata: { ...assistantMsg.metadata, reasoningDone: true } } : {}),
          })
          streamingFinalized = true
          isStreaming.value = false
          break
        } else if (chunk.type === 'done') {
          // Finalize last thinking step with tokenUsage
          if (iterationAware) {
            finalizeCurrentThinkingStep(chunk.tokenUsage)
          }
          if (iterationAware && steps.length > 0) {
            // Accumulate token usage across ALL steps
            const accumulatedTokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
            for (const s of steps) {
              if ((s.type === 'thinking' || s.type === 'sub_agent') && s.tokenUsage) {
                accumulatedTokenUsage.promptTokens += s.tokenUsage.promptTokens
                accumulatedTokenUsage.completionTokens += s.tokenUsage.completionTokens
                accumulatedTokenUsage.totalTokens += s.tokenUsage.totalTokens
              }
            }
            if (chunk.tokenUsage) {
              accumulatedTokenUsage.promptTokens += chunk.tokenUsage.promptTokens
              accumulatedTokenUsage.completionTokens += chunk.tokenUsage.completionTokens
              accumulatedTokenUsage.totalTokens += chunk.tokenUsage.totalTokens
            }
            tokenUsage = accumulatedTokenUsage
          } else {
            tokenUsage = chunk.tokenUsage
          }
          await messageService.update(assistantMsg.id, {
            content: fullContent,
            reasoningContent: fullReasoning || undefined,
            isStreaming: false,
            tokenUsage,
            steps: iterationAware ? [...steps] : undefined,
            ...(hadReasoning && !reasoningDoneFired ? { metadata: { ...assistantMsg.metadata, reasoningDone: true } } : {}),
          })
          streamingFinalized = true
        } else if (chunk.type === 'sub_agent_start') {
          if (!assistantMsg.metadata) {
            assistantMsg.metadata = {}
          }
          if (!assistantMsg.metadata.subAgentCalls) {
            assistantMsg.metadata.subAgentCalls = []
          }
          ;(assistantMsg.metadata.subAgentCalls as SubAgentCallInfo[]).push(chunk.subAgent!)
          // Steps: finalize thinking step, push SubAgentStep
          if (iterationAware) {
            finalizeCurrentThinkingStep()
            steps.push({
              type: 'sub_agent',
              executionId: chunk.subAgent!.executionId,
              agentId: chunk.subAgent!.agentId,
              agentName: chunk.subAgent!.agentName,
              task: chunk.subAgent!.task,
              status: 'running',
              startTime: chunk.subAgent!.startTime,
              endTime: null,
              depth: chunk.subAgent!.depth,
            })
          }
          await messageService.update(assistantMsg.id, {
            metadata: { ...assistantMsg.metadata },
            steps: iterationAware ? [...steps] : undefined,
          })
          // Create SubAgentExecution record in DB so the log dialog can load it
          if (chunk.subAgent) {
            subAgentLogBuffer[chunk.subAgent.executionId] = []
            try {
              await subAgentExecutionService.create({
                parentExecutionId: null,
                conversationId,
                parentMessageId: assistantMsg.id,
                agentId: chunk.subAgent.agentId,
                agentName: chunk.subAgent.agentName,
                task: chunk.subAgent.task,
                status: 'running',
                startTime: chunk.subAgent.startTime,
                endTime: null,
                output: null,
                reasoningContent: null,
                error: null,
                depth: chunk.subAgent.depth,
                logs: [],
              }, chunk.subAgent.executionId)
            } catch (e) {
              console.warn('[useChat] failed to create SubAgentExecution record:', e)
            }
          }
        } else if (chunk.type === 'sub_agent_log') {
          // Buffer log entries in memory — flushed to DB on sub_agent_end
          if (chunk.subAgent && chunk.logEntry) {
            const execId = chunk.subAgent.executionId
            const buffer = subAgentLogBuffer[execId]
            if (buffer) {
              buffer.push(chunk.logEntry)
            }
            if (chunk.logEntry.type === 'token' && chunk.logEntry.content) {
              outputAccumulators[execId] = (outputAccumulators[execId] ?? '') + chunk.logEntry.content
            }
            if (chunk.logEntry.type === 'reasoning' && chunk.logEntry.content) {
              reasoningAccumulators[execId] = (reasoningAccumulators[execId] ?? '') + chunk.logEntry.content
            }
            scheduleThrottledExecutionUpdate(execId)
          }
        } else if (chunk.type === 'sub_agent_end') {
          const calls = assistantMsg.metadata?.subAgentCalls as SubAgentCallInfo[] | undefined
          if (calls && chunk.subAgent) {
            const idx = calls.findIndex(c => c.executionId === chunk.subAgent!.executionId)
            if (idx >= 0) {
              calls[idx] = { ...calls[idx], status: chunk.subAgent.status, endTime: chunk.subAgent.endTime }
            }
          }
          // Steps: update SubAgentStep in steps
          if (iterationAware && chunk.subAgent) {
            const stepIdx = steps.findIndex(
              s => s.type === 'sub_agent' && s.executionId === chunk.subAgent!.executionId,
            )
            if (stepIdx >= 0) {
              const step = steps[stepIdx]
              steps[stepIdx] = {
                ...step,
                status: chunk.subAgent.status,
                endTime: chunk.subAgent.endTime,
                ...(chunk.tokenUsage && { tokenUsage: chunk.tokenUsage }),
              } as typeof step
            }
          }
          await messageService.update(assistantMsg.id, {
            metadata: { ...assistantMsg.metadata },
            steps: iterationAware ? [...steps] : undefined,
          })
          if (chunk.subAgent) {
            const execId = chunk.subAgent.executionId
            const pending = pendingThrottledUpdates[execId]
            if (pending) {
              clearTimeout(pending)
              delete pendingThrottledUpdates[execId]
            }
            finalizedExecutions.add(execId)

            const bufferedLogs = subAgentLogBuffer[execId] ?? []
            const output = outputAccumulators[execId] ?? null
            const reasoningContent = reasoningAccumulators[execId] ?? null
            try {
              await subAgentExecutionService.update(execId, {
                status: chunk.subAgent.status,
                endTime: chunk.subAgent.endTime,
                logs: bufferedLogs,
                output,
                reasoningContent,
                ...(chunk.tokenUsage && { tokenUsage: chunk.tokenUsage }),
              })
            } catch (e) {
              console.warn('[useChat] failed to update SubAgentExecution record:', e)
            }
            delete outputAccumulators[execId]
            delete reasoningAccumulators[execId]
          }
        }
      }
      console.log('[useChat] streaming complete')
    } catch (err) {
      console.error('[useChat] error during streaming:', err)
      if ((err as Error)?.name === 'AbortError') {
        await messageService.update(assistantMsg.id, { isStreaming: false })
      } else {
        await messageService.update(assistantMsg.id, {
          content: `Error: ${(err as Error)?.message ?? 'Unknown error'}`,
          isStreaming: false,
        })
      }
    } finally {
      isStreaming.value = false
      abortController = null
      if (!streamingFinalized) {
        try {
          await messageService.update(assistantMsg.id, { isStreaming: false })
        } catch {
          // Message may already be finalized
        }
      }
    }

    // After streaming completes, update conversation's totalTokens
    if (tokenUsage && conversationId) {
      try {
        const conv = await conversationService.getById(conversationId)
        if (conv) {
          const prevTokens = conv.totalTokens ?? 0
          await conversationService.update(conversationId, {
            totalTokens: prevTokens + tokenUsage.totalTokens,
          })
        }
      } catch {
        // Silently ignore — token tracking is non-critical
      }
    }

    // After streaming completes, try AI title generation for first message (fire-and-forget)
    if (isFirstMessage && model) {
      ;(async () => {
        try {
          const msgs = await messageService.getByConversationId(conversationId)
          const title = await TitleGenerator.generate(msgs, model)
          if (title) {
            await conversationService.update(conversationId, { title })
          }
        } catch {
          // Silently ignore — initial title from first message is already set
        }
      })()
    }
  }

  function stopStreaming(): void {
    console.log('[useChat] stopStreaming called')
    abortController?.abort()
  }

  onUnmounted(() => {
    if (abortController) {
      abortController.abort()
    }
  })

  return {
    isStreaming,
    currentMessages,
    sendMessage,
    stopStreaming,
  }
}
