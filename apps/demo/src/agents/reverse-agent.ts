/**
 * Reverse Agent — 反转文本智能体
 *
 * 将用户输入的文本反转后返回，附带字数统计。
 * 演示了：
 *   1. 对消息内容做实际处理（而非简单回显）
 *   2. 使用 AbortSignal 支持取消
 *   3. 逐词流式输出（与 Echo Agent 的逐字符不同）
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
export const reverseAgentDef: AgentDefinition = {
  id: 'demo-reverse',
  name: 'Reverse Agent',
  description: '将你输入的文本反转并返回，附带字数统计信息',
  systemPrompt: '你是一个反转文本的助手。',
}

// ── 智能体运行器 ──────────────────────────────────────────────
export const reverseAgentRunner: AgentRunner = {
  async *chat(
    messages: ChatMessage[],
    _model: ModelConfig,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    const lastMessage = messages[messages.length - 1]
    const text = lastMessage?.content ?? ''

    // 核心逻辑：反转文本
    const reversed = [...text].reverse().join('')

    // 拼装回复
    const lines = [
      `**Original:** ${text}`,
      '',
      `**Reversed:** ${reversed}`,
      '',
      '---',
      '',
      `字符数: \`${text.length}\` | Unicode 码点数: \`${[...text].length}\``,
    ]

    // 逐行流式输出
    for (let i = 0; i < lines.length; i++) {
      if (options?.signal?.aborted) return

      yield { type: 'token', content: lines[i] }

      // 行间加入换行（最后一行除外）
      if (i < lines.length - 1) {
        yield { type: 'token', content: '\n' }
      }

      await new Promise<void>((r) => setTimeout(r, 40))
    }

    yield { type: 'done' }
  },
}
