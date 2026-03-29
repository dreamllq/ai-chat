import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { ChatMessage } from '../types'
import { isMessageAttachment, getAttachmentType } from '../types'

/**
 * Convert ChatMessage[] to LangChain BaseMessage[] for LLM consumption.
 *
 * - Optional system prompt is prepended as a SystemMessage
 * - User messages with attachments produce multimodal HumanMessage content
 * - Image attachments use `image_url` content blocks
 * - Non-image attachments are rendered as `[Attached file: name, sizeKB]` text
 * - Assistant messages become AIMessage
 */
export function convertMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
): (SystemMessage | HumanMessage | AIMessage)[] {
  const result: (SystemMessage | HumanMessage | AIMessage)[] = []

  if (systemPrompt) {
    result.push(new SystemMessage(systemPrompt))
  }

  for (const msg of messages) {
    if (msg.role === 'user') {
      const files = msg.metadata?.files
      if (Array.isArray(files) && files.length > 0) {
        const validAttachments = files.filter(isMessageAttachment)
        if (validAttachments.length > 0) {
          const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
            { type: 'text', text: msg.content },
          ]
          for (const file of validAttachments) {
            if (getAttachmentType(file.mimeType) === 'image' && (file.url || file.data)) {
              contentParts.push({
                type: 'image_url',
                image_url: { url: file.url || file.data! },
              })
            } else {
              contentParts.push({
                type: 'text',
                text: `[Attached file: ${file.name}, ${(file.size / 1024).toFixed(1)}KB]`,
              })
            }
          }
          result.push(new HumanMessage({ content: contentParts }))
        } else {
          result.push(new HumanMessage(msg.content))
        }
      } else {
        result.push(new HumanMessage(msg.content))
      }
    } else if (msg.role === 'assistant') {
      result.push(new AIMessage(msg.content))
    }
  }

  return result
}
