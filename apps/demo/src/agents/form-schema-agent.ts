/**
 * Form Schema Agent — 动态表单 Schema 生成与修改智能体（配置模式）
 *
 * 仅提供 AgentDefinition + 工具函数，由框架内部的 runner 处理 LLM 调用与工具执行循环。
 */
import { z } from 'zod'
import type { AgentDefinition } from '@ai-chat/vue/types'

// ── Zod Schemas ──────────────────────────────────────────────

const FormFieldOptionSchema = z.object({
  label: z.string().describe('选项标签'),
  value: z.string().describe('选项值'),
})

const FormFieldSchema = z.object({
  name: z.string().describe('字段名（英文，用于标识）'),
  label: z.string().describe('显示标签'),
  type: z.enum([
    'input', 'textarea', 'select', 'radio', 'checkbox', 'switch', 'datePicker', 'inputNumber',
  ]).describe('字段类型'),
  required: z.boolean().optional().describe('是否必填'),
  placeholder: z.string().optional().describe('占位提示'),
  defaultValue: z.unknown().optional().describe('默认值'),
  options: z.array(FormFieldOptionSchema).optional().describe('选项列表（select/radio/checkbox 类型必须提供）'),
})

const FormSchemaSchema = z.object({
  title: z.string().describe('表单标题'),
  description: z.string().optional().describe('表单描述'),
  fields: z.array(FormFieldSchema).describe('表单字段列表，最多20个'),
}).describe('表单 Schema 定义')

// ── Derived Types ────────────────────────────────────────────

type FormSchema = z.infer<typeof FormSchemaSchema>

// ── 模块级状态 ────────────────────────────────────────────────

let currentSchema: FormSchema | null = null

// ── 工具函数 ──────────────────────────────────────────────────

async function getFormSchemaFunc(input: string): Promise<string> {
  if (currentSchema === null) {
    return '当前还没有表单 schema。请告诉用户需要创建什么样的表单。'
  }
  return JSON.stringify(currentSchema, null, 2)
}

async function submitFormSchemaFunc(input: unknown): Promise<string> {
  const schema = input as FormSchema
  currentSchema = schema
  console.log('[FormSchema] Schema updated:', JSON.stringify(currentSchema, null, 2))
  return `表单 schema 已更新成功！标题: "${currentSchema.title}"，字段数: ${currentSchema.fields.length}`
}

// ── Agent Definition（配置模式，无需提供 runner） ──────────────

export const formSchemaAgentDef: AgentDefinition = {
  id: 'demo-form-schema',
  name: 'Form Schema Agent',
  description: '生成和修改动态表单 Schema 的智能体',
  systemPrompt: `你是一个表单 Schema 生成助手。你的工作是帮助用户设计和修改表单结构。

**工作规则**:
1. 必须通过工具操作 schema，不要在聊天中直接输出 JSON
2. 创建新 schema 时，调用 submit_form_schema 工具，传入完整的 JSON 对象
3. 修改 schema 时，先调用 get_form_schema 获取当前 schema，修改后再调用 submit_form_schema 提交完整 schema
4. 每次必须提交完整 schema，不要提交部分修改
5. 最多支持 20 个字段
6. 可用字段类型: input, textarea, select, radio, checkbox, switch, datePicker, inputNumber
7. select/radio/checkbox 类型必须提供 options 数组（包含 label 和 value）
8. 用中文与用户交流

**JSON Schema 格式**:
{
  "title": "表单标题",
  "description": "表单描述（可选）",
  "fields": [
    {
      "name": "字段名（英文，用于标识）",
      "label": "显示标签",
      "type": "字段类型",
      "required": true/false,
      "placeholder": "占位提示（可选）",
      "defaultValue": "默认值（可选）",
      "options": [{"label": "选项标签", "value": "选项值"}]
    }
  ]
}`,
  tools: [
    {
      name: 'get_form_schema',
      description:
        '获取当前的表单 schema。返回完整的 JSON 字符串。如果还没有创建过 schema，会返回提示信息。',
      execute: getFormSchemaFunc,
    },
    {
      name: 'submit_form_schema',
      description:
        '提交/更新表单 schema。传入符合格式的 JSON 对象。系统会验证格式，验证通过后保存。验证失败会返回具体错误信息，请根据错误修改后重新提交。',
      schema: FormSchemaSchema,
      execute: submitFormSchemaFunc,
    },
  ],
}
