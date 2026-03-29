/**
 * Echo Agent — 最简单的自定义智能体示例
 *
 * 将用户发送的消息原样回显，附带一些装饰性 Markdown 格式。
 * 演示了：
 *   1. 实现 AgentRunner 接口
 *   2. 定义 AgentDefinition 元数据
 *   3. 逐字符流式输出（模拟 LLM token 效果）
 *   4. 正确处理 AbortSignal
 */
import type {
  AgentDefinition,
  AgentRunner,
  ChatMessage,
  ModelConfig,
  ChatOptions,
  ChatChunk,
} from '@ai-chat/vue'

// ── 智能体元数据 ──────────────────────────────────────────────
export const echoAgentDef: AgentDefinition = {
  id: 'demo-echo',
  name: 'Echo Agent',
  description: '将你的消息原样回显，用于验证自定义智能体注册流程',
  systemPrompt: '你是一个回显助手，将用户的消息原样返回。',
}

// ── 智能体运行器 ──────────────────────────────────────────────
export const echoAgentRunner: AgentRunner = {
  async *chat(
    messages: ChatMessage[],
    _model: ModelConfig,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    // 取最后一条用户消息
    const lastMessage = messages[messages.length - 1]
    const text = lastMessage?.content ?? ''

    // 拼装回复内容
    const response = [
      `**Echo:** _"${text}"_`,
      '',
      '> 这是一条来自 **Echo Agent** 的回复。',
      '>',
      `> Agent ID: \`${echoAgentDef.id}\``,
    ].join('\n')

    // 逐块流式输出（每 3 个字符一块）
    const chars = [...response]
    let buffer = ''
    for (let i = 0; i < chars.length; i++) {
      if (options?.signal?.aborted) return
      buffer += chars[i]
      if (buffer.length >= 3 || i === chars.length - 1) {
        yield { type: 'token', content: buffer }
        buffer = ''
        await new Promise<void>((r) => setTimeout(r, 18))
      }
    }

    yield { type: 'done' }
  },
}
