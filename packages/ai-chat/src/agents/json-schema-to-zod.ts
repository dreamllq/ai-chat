import { z, type ZodType, type ZodTypeAny } from 'zod'

type JsonSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null'

interface JsonSchemaObject {
  type?: JsonSchemaType | JsonSchemaType[]
  properties?: Record<string, JsonSchemaObject>
  required?: string[]
  items?: JsonSchemaObject
  enum?: (string | number | boolean | null)[]
  description?: string
  [key: string]: unknown
}

/**
 * Convert a JSON Schema object (MCP tool `inputSchema`) to a Zod v4 schema.
 * Supports: string, number, integer, boolean, array, object, enum.
 * Returns `z.object({})` for null/undefined/empty-schema, `z.unknown()` for unsupported types.
 */
export function jsonSchemaToZod(schema: unknown): ZodType {
  if (schema == null) {
    return z.object({})
  }

  if (typeof schema !== 'object') {
    return z.object({})
  }

  const schemaObj = schema as JsonSchemaObject

  if (Object.keys(schemaObj).length === 0) {
    return z.object({})
  }

  if (schemaObj.enum != null) {
    return convertEnum(schemaObj)
  }

  if (schemaObj.type == null && schemaObj.properties != null) {
    return convertObject(schemaObj)
  }

  if (schemaObj.type == null) {
    return z.unknown()
  }

  if (typeof schemaObj.type === 'string') {
    return convertByType(schemaObj.type, schemaObj)
  }

  if (Array.isArray(schemaObj.type)) {
    const nonNullTypes = schemaObj.type.filter((t) => t !== 'null')
    if (nonNullTypes.length === 0) {
      return z.null()
    }
    const converted = convertByType(nonNullTypes[0], schemaObj)
    if (schemaObj.type.includes('null')) {
      return converted.nullable()
    }
    return converted
  }

  return z.unknown()
}

function convertByType(type: JsonSchemaType, schema: JsonSchemaObject): ZodType {
  switch (type) {
    case 'string':
      return withDescription(z.string(), schema.description)
    case 'number':
      return withDescription(z.number(), schema.description)
    case 'integer':
      return withDescription(z.number().int(), schema.description)
    case 'boolean':
      return withDescription(z.boolean(), schema.description)
    case 'array':
      return convertArray(schema)
    case 'object':
      return convertObject(schema)
    case 'null':
      return z.null()
    default:
      return z.unknown()
  }
}

function convertObject(schema: JsonSchemaObject): ZodType {
  const properties = schema.properties

  // Object with no properties → empty object schema
  if (properties == null || Object.keys(properties).length === 0) {
    return withDescription(z.object({}), schema.description)
  }

  const required = new Set(schema.required ?? [])
  const shape: Record<string, ZodTypeAny> = {}

  for (const [key, propSchema] of Object.entries(properties)) {
    const zodType = jsonSchemaToZod(propSchema)
    if (required.has(key)) {
      shape[key] = zodType
    } else {
      shape[key] = zodType.optional()
    }
  }

  return withDescription(z.object(shape), schema.description)
}

function convertArray(schema: JsonSchemaObject): ZodType {
  if (schema.items != null) {
    const itemsSchema = jsonSchemaToZod(schema.items)
    return withDescription(z.array(itemsSchema), schema.description)
  }
  return withDescription(z.array(z.unknown()), schema.description)
}

function convertEnum(schema: JsonSchemaObject): ZodType {
  const enumValues = schema.enum!

  if (enumValues.length === 0) {
    return withDescription(z.never(), schema.description)
  }

  // If all values are strings, use z.enum() for better type inference
  if (enumValues.every((v): v is string => typeof v === 'string')) {
    return withDescription(z.enum(enumValues as [string, ...string[]]), schema.description)
  }

  // Mixed types: use z.union of literals
  const [first, ...rest] = enumValues
  if (rest.length === 0) {
    return withDescription(z.literal(first), schema.description)
  }

  const literals = enumValues.map((v) => z.literal(v)) as unknown as [ZodTypeAny, ...ZodTypeAny[]]
  return withDescription(z.union(literals), schema.description)
}

function withDescription<T extends ZodType>(schema: T, description: string | undefined): T {
  if (description != null && description.length > 0) {
    return schema.describe(description) as T
  }
  return schema
}
