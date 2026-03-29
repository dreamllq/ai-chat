import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { AgentRunner, ChatMessage, ModelConfig, ChatOptions, ChatChunk } from '../types'

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
        result.push(new HumanMessage(msg.content))
      } else if (msg.role === 'assistant') {
        result.push(new AIMessage(msg.content))
      }
    }
    return result
  }
}
