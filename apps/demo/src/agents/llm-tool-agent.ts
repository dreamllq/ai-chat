/**
 * LLM Tool Agent — 支持工具调用的自定义大模型智能体
 *
 * 功能：
 *   1. 调用 OpenAI 兼容的大模型 API 进行对话
 *   2. 自动进行工具调用（计算器、时间查询、文本统计）
 *   3. 将工具结果反馈给大模型，生成最终回复
 *   4. 流式输出工具调用过程和最终回复
 *   5. 支持 AbortSignal 取消
 *
 * 演示了：
 *   - 如何在自定义 Agent 中集成 LangChain ChatOpenAI + DynamicTool
 *   - 手动实现工具调用循环（invoke → 检测 tool_calls → 执行 → 回传）
 *   - 将工具调用过程以流式 chunk 形式呈现给用户
 *
 * 注意：LangChain 相关 import 全部延迟到 chat() 内部执行，
 * 避免模块顶层加载时因依赖初始化失败导致整个文件静默崩溃。
 */
import type {
  AgentDefinition,
  AgentRunner,
  ChatMessage,
  ModelConfig,
  ChatOptions,
  ChatChunk,
} from '@ai-chat/vue/types'

// ── 工具逻辑（纯函数，不依赖 LangChain） ──────────────────────

async function calculatorFunc(input: string): Promise<string> {
  const expr = input.trim()
  if (!/^[\d\s+\-*/().%^]+$/.test(expr)) {
    return '错误：表达式包含不允许的字符，仅支持数字和基本数学运算符'
  }
  try {
    const result = new Function(`"use strict"; return (${expr})`)()
    if (typeof result !== 'number' || !isFinite(result)) {
      return `计算结果无效: ${result}`
    }
    return `计算结果: ${result}`
  } catch {
    return `无法计算表达式: ${expr}`
  }
}

async function timeFunc(input: string): Promise<string> {
  try {
    const timeZone = input.trim() || undefined
    const now = new Date()
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
      ...(timeZone ? { timeZone } : {}),
    }
    return now.toLocaleString('zh-CN', options)
  } catch {
    return `未知时区: ${input}，请使用标准 IANA 时区名称（如 Asia/Shanghai）`
  }
}

async function textStatsFunc(input: string): Promise<string> {
  const text = input
  return JSON.stringify(
    {
      字符数: text.length,
      不含空格字符数: text.replace(/\s/g, '').length,
      单词数: text.trim().split(/\s+/).filter(Boolean).length,
      行数: text.split('\n').length,
      中文字符数: (text.match(/[\u4e00-\u9fff]/g) || []).length,
    },
    null,
    2,
  )
}

/** 工具定义表（name → { description, func }），用于延迟创建 LangChain DynamicTool */
const toolDefs = [
  {
    name: 'calculator',
    description:
      '计算数学表达式。输入一个数学表达式字符串，例如 "2+3*4"、"100/3"、"2**10"。支持加减乘除、幂运算和括号。',
    func: calculatorFunc,
  },
  {
    name: 'get_current_time',
    description:
      '获取当前日期和时间。输入 IANA 时区名称（如 "Asia/Shanghai"、"America/New_York"、"Europe/London"），返回该时区的当前日期时间。留空则使用本地时间。',
    func: timeFunc,
  },
  {
    name: 'text_stats',
    description: '统计文本的字符数、单词数、行数等信息。输入要统计的文本内容。',
    func: textStatsFunc,
  },
] as const

// ── 辅助函数 ──────────────────────────────────────────────────

/** 从工具调用参数中提取字符串输入（DynamicTool 接收单字符串） */
function extractToolInput(args: Record<string, unknown> | string): string {
  if (typeof args === 'string') return args
  if (args.input !== undefined) return String(args.input)
  const strVal = Object.values(args).find((v) => typeof v === 'string')
  return strVal ? String(strVal) : JSON.stringify(args)
}

/** 将文本按固定大小分块 */
function chunkText(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

/** 延迟加载 LangChain 依赖并构建绑定工具的 LLM 实例 + 工具 Map */
async function createLLMWithTools(model: ModelConfig, options?: ChatOptions) {
  const [{ ChatOpenAI }, { HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage }, { DynamicTool }] =
    await Promise.all([
      import('@langchain/openai'),
      import('@langchain/core/messages'),
      import('@langchain/core/tools'),
    ])

  const tools = toolDefs.map(
    (def) =>
      new DynamicTool({
        name: def.name,
        description: def.description,
        func: def.func,
      }),
  )

  const toolMap = new Map(tools.map((t) => [t.name, t]))

  const llm = new ChatOpenAI({
    configuration: { baseURL: model.endpoint, apiKey: model.apiKey },
    modelName: model.modelName,
    temperature: options?.temperature ?? model.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? model.maxTokens,
  }).bindTools(tools)

  return { llm, toolMap, HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage }
}

// ── 智能体元数据 ──────────────────────────────────────────────

export const llmToolAgentDef: AgentDefinition = {
  id: 'demo-llm-tool',
  name: 'LLM Tool Agent',
  description: '调用大模型对话，支持工具调用（计算器、时间查询、文本统计）',
  systemPrompt:
    '你是一个智能助手。当用户的问题涉及数学计算、时间查询或文本统计时，请使用相应的工具来获取准确信息，然后基于工具结果回答用户。其他问题请直接回答。请用中文回复。',
}

// ── 智能体运行器 ──────────────────────────────────────────────

export const llmToolAgentRunner: AgentRunner = {
  async *chat(
    messages: ChatMessage[],
    model: ModelConfig,
    options?: ChatOptions,
  ): AsyncGenerator<ChatChunk, void, unknown> {
    // 延迟加载 LangChain，避免模块顶层副作用
    const { llm, toolMap, HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage } =
      await createLLMWithTools(model, options)

    // 转换消息
    const lcMessages: InstanceType<typeof BaseMessage>[] = []
    if (options?.systemPrompt) {
      lcMessages.push(new SystemMessage(options.systemPrompt))
    }
    for (const msg of messages) {
      if (msg.role === 'user') {
        lcMessages.push(new HumanMessage(msg.content))
      } else if (msg.role === 'assistant') {
        lcMessages.push(new AIMessage(msg.content))
      }
    }

    const MAX_ITERATIONS = 5

    try {
      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        if (options?.signal?.aborted) return

        const response = (await llm.invoke(lcMessages, {
          signal: options?.signal,
        })) as InstanceType<typeof AIMessage>

        const toolCalls = response.tool_calls

        if (toolCalls && toolCalls.length > 0) {
          lcMessages.push(response)

          for (const tc of toolCalls) {
            if (options?.signal?.aborted) return

            const argsDisplay =
              typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args)

            for (const chunk of chunkText(
              `\n🔧 调用工具 \`${tc.name}\`，参数: \`${argsDisplay}\`\n`,
              4,
            )) {
              if (options?.signal?.aborted) return
              yield { type: 'token', content: chunk }
              await new Promise<void>((r) => setTimeout(r, 12))
            }

            const tool = toolMap.get(tc.name)
            const toolInput = extractToolInput(tc.args)
            const result = tool
              ? await tool.invoke(toolInput)
              : `未找到工具: ${tc.name}`

            for (const chunk of chunkText(`📋 ${result}\n\n`, 4)) {
              if (options?.signal?.aborted) return
              yield { type: 'token', content: chunk }
              await new Promise<void>((r) => setTimeout(r, 12))
            }

            lcMessages.push(
              new ToolMessage({
                content: String(result),
                tool_call_id: tc.id ?? '',
              }),
            )
          }
        } else {
          const text =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content)

          for (const chunk of chunkText(text, 3)) {
            if (options?.signal?.aborted) return
            yield { type: 'token', content: chunk }
            await new Promise<void>((r) => setTimeout(r, 18))
          }

          yield { type: 'done' }
          return
        }
      }

      yield { type: 'token', content: '\n\n⚠️ 已达到最大工具调用轮次限制。' }
      yield { type: 'done' }
    } catch (error) {
      yield { type: 'error', error: String(error) }
    }
  },
}
