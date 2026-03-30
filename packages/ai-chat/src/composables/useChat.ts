import { ref, onUnmounted } from 'vue'
import { useSession } from './useSession'
import { useModel } from './useModel'
import { agentRegistry } from '../services/agent'
import { MessageService, ConversationService } from '../services/database'
import { TitleGenerator } from '../agents/title-generator'
import type { MessageAttachment } from '../types'

// Module-level singleton state — shared across all useChat() callers
const isStreaming = ref(false)
let abortController: AbortController | null = null

const INITIAL_TITLE_MAX_LENGTH = 30

export function useChat() {
  const { currentConversation, currentConversationId, currentMessages } =
    useSession()
  const { models } = useModel()
  const messageService = new MessageService()
  const conversationService = new ConversationService()

  async function sendMessage(
    content: string,
    attachments?: MessageAttachment[],
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

    try {
      const history = await messageService.getByConversationId(conversationId)
      const messagesForAgent = history.filter((m) => m.id !== assistantMsg.id)
      console.log('[useChat] calling runner.chat() with', messagesForAgent.length, 'messages')

      const generator = runner.chat(messagesForAgent, model, {
        signal: abortController.signal,
      })

      let fullContent = ''
      let fullReasoning = ''
      for await (const chunk of generator) {
        if (chunk.type === 'token') {
          if (chunk.content) {
            fullContent += chunk.content
          }
          if (chunk.reasoningContent) {
            fullReasoning += chunk.reasoningContent
          }
          await messageService.update(assistantMsg.id, {
            content: fullContent,
            reasoningContent: fullReasoning || undefined,
          })
        } else if (chunk.type === 'error') {
          fullContent += `\n\n⚠️ Error: ${chunk.error}`
          await messageService.update(assistantMsg.id, {
            content: fullContent,
            reasoningContent: fullReasoning || undefined,
            isStreaming: false,
          })
          break
        } else if (chunk.type === 'done') {
          await messageService.update(assistantMsg.id, {
            content: fullContent,
            reasoningContent: fullReasoning || undefined,
            isStreaming: false,
          })
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
