/**
 * LLM Tool Agent — 支持工具调用的自定义大模型智能体（配置模式）
 *
 * 仅提供 AgentDefinition + 工具函数，由框架内部的 runner 处理 LLM 调用与工具执行循环。
 */
import type { AgentDefinition } from '@ai-chat/vue/types'

// ── 工具函数（纯函数，不依赖 LangChain） ──────────────────────

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

// ── Agent Definition（配置模式，无需提供 runner） ──────────────

export const llmToolAgentDef: AgentDefinition = {
  id: 'demo-llm-tool',
  name: 'LLM Tool Agent',
  description: '调用大模型对话，支持工具调用（计算器、时间查询、文本统计）',
  systemPrompt:
    '你是一个智能助手。当用户的问题涉及数学计算、时间查询或文本统计时，请使用相应的工具来获取准确信息，然后基于工具结果回答用户。其他问题请直接回答。请用中文回复。',
  tools: [
    {
      name: 'calculator',
      description:
        '计算数学表达式。输入一个数学表达式字符串，例如 "2+3*4"、"100/3"、"2**10"。支持加减乘除、幂运算和括号。',
      execute: calculatorFunc,
    },
    {
      name: 'get_current_time',
      description:
        '获取当前日期和时间。输入 IANA 时区名称（如 "Asia/Shanghai"、"America/New_York"、"Europe/London"），返回该时区的当前日期时间。留空则使用本地时间。',
      execute: timeFunc,
    },
    {
      name: 'text_stats',
      description: '统计文本的字符数、单词数、行数等信息。输入要统计的文本内容。',
      execute: textStatsFunc,
    },
  ],
}
