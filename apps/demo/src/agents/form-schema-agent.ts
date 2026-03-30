/**
 * Form Schema Agent — 动态表单 Schema 生成与修改智能体（配置模式）
 *
 * 仅提供 AgentDefinition + 工具函数，由框架内部的 runner 处理 LLM 调用与工具执行循环。
 */
import type { AgentDefinition } from '@ai-chat/vue/types'

// ── 内部类型 ──────────────────────────────────────────────────

type FormFieldType =
  | 'input'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'datePicker'
  | 'inputNumber'

interface FormFieldOption {
  label: string
  value: string
}

interface FormField {
  name: string
  label: string
  type: FormFieldType
  required?: boolean
  placeholder?: string
  defaultValue?: unknown
  options?: FormFieldOption[]
}

interface FormSchema {
  title: string
  description?: string
  fields: FormField[]
}

// ── 常量 ──────────────────────────────────────────────────────

const VALID_FIELD_TYPES: Set<string> = new Set([
  'input',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'switch',
  'datePicker',
  'inputNumber',
])

// ── 模块级状态 ────────────────────────────────────────────────

let currentSchema: FormSchema | null = null

// ── 校验函数 ──────────────────────────────────────────────────

function validateFormSchema(input: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    return JSON.stringify({ valid: false, errors: ['JSON 格式错误，无法解析'] })
  }

  const errors: string[] = []

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return JSON.stringify({ valid: false, errors: ['输入必须是 JSON 对象'] })
  }

  const schema = parsed as Record<string, unknown>

  // title
  if (typeof schema.title !== 'string' || schema.title.trim() === '') {
    errors.push('title 必须是非空字符串')
  }

  // fields
  if (!Array.isArray(schema.fields)) {
    errors.push('fields 必须是数组')
  } else {
    if (schema.fields.length > 20) {
      errors.push('字段数量不能超过 20 个')
    }

    for (let i = 0; i < schema.fields.length; i++) {
      const field = schema.fields[i] as Record<string, unknown>
      const prefix = `fields[${i}]`

      if (typeof field.name !== 'string' || field.name.trim() === '') {
        errors.push(`${prefix}.name 必须是非空字符串`)
      }

      if (typeof field.label !== 'string' || field.label.trim() === '') {
        errors.push(`${prefix}.label 必须是非空字符串`)
      }

      if (typeof field.type !== 'string' || !VALID_FIELD_TYPES.has(field.type)) {
        errors.push(
          `${prefix}.type 必须是以下类型之一: ${[...VALID_FIELD_TYPES].join(', ')}`,
        )
      }

      // select / radio / checkbox 必须有 options
      if (
        field.type === 'select' ||
        field.type === 'radio' ||
        field.type === 'checkbox'
      ) {
        if (!Array.isArray(field.options) || field.options.length === 0) {
          errors.push(`${prefix}.options 必须是非空数组（当 type 为 ${field.type} 时）`)
        }
      }
    }
  }

  if (errors.length > 0) {
    return JSON.stringify({ valid: false, errors })
  }

  return JSON.stringify({ valid: true, schema })
}

// ── 工具函数 ──────────────────────────────────────────────────

async function getFormSchemaFunc(input: string): Promise<string> {
  if (currentSchema === null) {
    return '当前还没有表单 schema。请告诉用户需要创建什么样的表单。'
  }
  return JSON.stringify(currentSchema, null, 2)
}

async function submitFormSchemaFunc(input: string): Promise<string> {
  const result = validateFormSchema(input)
  const parsed = JSON.parse(result) as { valid: boolean; schema?: FormSchema; errors?: string[] }

  if (!parsed.valid) {
    return result
  }

  currentSchema = parsed.schema!
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
2. 创建新 schema 时，调用 submit_form_schema 工具，传入完整的 JSON
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
        '提交/更新表单 schema。输入必须是符合格式的 JSON 字符串。系统会验证格式，验证通过后保存并在控制台输出。验证失败会返回具体错误信息，请根据错误修改后重新提交。',
      execute: submitFormSchemaFunc,
    },
  ],
}
