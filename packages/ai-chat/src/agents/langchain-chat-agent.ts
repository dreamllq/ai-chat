import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { AgentRunner, ChatMessage, ModelConfig, ChatOptions, ChatChunk } from '../types'
import { isMessageAttachment, getAttachmentType } from '../types'

export class LangChainChatAgent implements AgentRunner {
  async *chat(
    messages: ChatMessage[],
    model: ModelConfig,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    const llm = new ChatOpenAI({
      configuration: { baseURL: model.endpoint, apiKey: model.apiKey },
      modelName: model.modelName,
      temperature: options?.temperature ?? model.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? model.maxTokens,
      streaming: true,
    })

    const lcMessages = this.convertMessages(messages, options?.systemPrompt)

    try {
      const stream = await llm.stream(lcMessages, { signal: options?.signal })
      for await (const chunk of stream) {
        yield { type: 'token', content: chunk.content as string }
      }
      yield { type: 'done' }
    } catch (error) {
      yield { type: 'error', error: String(error) }
    }
  }

  private convertMessages(messages: ChatMessage[], systemPrompt?: string) {
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
}
