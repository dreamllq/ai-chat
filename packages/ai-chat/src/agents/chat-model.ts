import { ChatOpenAICompletions } from '@langchain/openai'

/**
 * Type helpers to extract parameter/return types from base class protected methods
 * without requiring a direct dependency on the `openai` package.
 */
type DeltaChunkParams = Parameters<ChatOpenAICompletions['_convertCompletionsDeltaToBaseMessageChunk']>
type DeltaChunkReturn = ReturnType<ChatOpenAICompletions['_convertCompletionsDeltaToBaseMessageChunk']>
type MessageConvertParams = Parameters<ChatOpenAICompletions['_convertCompletionsMessageToBaseMessage']>
type MessageConvertReturn = ReturnType<ChatOpenAICompletions['_convertCompletionsMessageToBaseMessage']>

/**
 * Extended ChatOpenAICompletions that extracts `reasoning_content` from
 * OpenAI-compatible API streaming deltas and non-streaming messages.
 *
 * The base ChatOpenAICompletions only extracts `function_call`, `tool_calls`, and `audio`
 * from the SSE delta — it silently drops `reasoning_content` used by reasoning models
 * (e.g., Doubao seed, DeepSeek R1).
 *
 * This subclass overrides the two protected conversion methods to also extract
 * `reasoning_content` and include it in the resulting message's `additional_kwargs`.
 */
export class EnhancedChatModel extends ChatOpenAICompletions {
  protected override _convertCompletionsDeltaToBaseMessageChunk(
    delta: DeltaChunkParams[0],
    rawResponse: DeltaChunkParams[1],
    defaultRole?: DeltaChunkParams[2],
  ): DeltaChunkReturn {
    const messageChunk = super._convertCompletionsDeltaToBaseMessageChunk(
      delta,
      rawResponse,
      defaultRole,
    )

    if (delta.reasoning_content != null) {
      messageChunk.additional_kwargs.reasoning_content = delta.reasoning_content
    }

    return messageChunk
  }

  protected override _convertCompletionsMessageToBaseMessage(
    message: MessageConvertParams[0],
    rawResponse: MessageConvertParams[1],
  ): MessageConvertReturn {
    const langChainMessage = super._convertCompletionsMessageToBaseMessage(
      message,
      rawResponse,
    )

    const rc = (message as { reasoning_content?: unknown }).reasoning_content
    if (rc != null) {
      langChainMessage.additional_kwargs.reasoning_content = rc
    }

    return langChainMessage
  }
}
