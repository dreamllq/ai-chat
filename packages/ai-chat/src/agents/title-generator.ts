import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { ModelConfig, ChatMessage } from '../types'

const TITLE_SYSTEM_PROMPT =
  '你是一个标题生成器。根据用户的对话内容，生成一个简短的标题（不超过10个字）。只返回标题文本，不要加引号、序号或其他格式。不要使用markdown。'

const MAX_CONTENT_LENGTH = 200
const MAX_TITLE_LENGTH = 20

/**
 * AI 标题生成器。
 * 根据对话内容调用大模型生成简短标题。
 * 如果调用失败则返回 null，调用方应忽略错误并保留原标题。
 */
export class TitleGenerator {
  /**
   * 根据对话消息生成简短标题。
   * @param messages 对话消息列表
   * @param model 模型配置
   * @returns 生成的标题，失败时返回 null
   */
  static async generate(
    messages: ChatMessage[],
    model: ModelConfig,
  ): Promise<string | null> {
    try {
      const userMessages = messages.filter((m) => m.role === 'user')
      if (userMessages.length === 0) return null

      const firstUserContent = userMessages[0].content.slice(
        0,
        MAX_CONTENT_LENGTH,
      )

      const llm = new ChatOpenAI({
        configuration: { baseURL: model.endpoint, apiKey: model.apiKey },
        modelName: model.modelName,
        temperature: 0,
        maxTokens: 50,
        streaming: false,
      })

      const response = await llm.invoke([
        new SystemMessage(TITLE_SYSTEM_PROMPT),
        new HumanMessage(
          `请为以下对话生成一个简短标题：\n\n${firstUserContent}`,
        ),
      ])

      const title = (response.content as string)
        .trim()
        .slice(0, MAX_TITLE_LENGTH)
      return title || null
    } catch {
      return null
    }
  }
}
