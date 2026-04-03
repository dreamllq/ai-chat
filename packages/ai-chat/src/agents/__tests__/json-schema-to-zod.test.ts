import { describe, it, expect } from 'vitest'
import { jsonSchemaToZod } from '../json-schema-to-zod'

describe('jsonSchemaToZod', () => {
  describe('edge cases', () => {
    it('returns z.object({}) for null input', () => {
      const schema = jsonSchemaToZod(null)
      expect(schema.parse({})).toEqual({})
    })

    it('returns z.object({}) for undefined input', () => {
      const schema = jsonSchemaToZod(undefined)
      expect(schema.parse({})).toEqual({})
    })

    it('returns z.object({}) for empty schema {}', () => {
      const schema = jsonSchemaToZod({})
      expect(schema.parse({})).toEqual({})
    })

    it('returns z.object({}) for non-object input (string)', () => {
      const schema = jsonSchemaToZod('not an object')
      expect(schema.parse({})).toEqual({})
    })

    it('returns z.object({}) for non-object input (number)', () => {
      const schema = jsonSchemaToZod(42)
      expect(schema.parse({})).toEqual({})
    })

    it('returns z.unknown() for schema with unrecognized type value', () => {
      const schema = jsonSchemaToZod({ type: 'custom_unknown_type' })
      expect(schema.parse('anything')).toBe('anything')
    })
  })

  describe('string type', () => {
    it('converts { type: "string" }', () => {
      const schema = jsonSchemaToZod({ type: 'string' })
      expect(schema.parse('hello')).toBe('hello')
    })

    it('rejects non-string values', () => {
      const schema = jsonSchemaToZod({ type: 'string' })
      expect(() => schema.parse(123)).toThrow()
    })

    it('preserves description', () => {
      const schema = jsonSchemaToZod({ type: 'string', description: 'A name field' })
      expect(schema.description).toBe('A name field')
    })
  })

  describe('number type', () => {
    it('converts { type: "number" }', () => {
      const schema = jsonSchemaToZod({ type: 'number' })
      expect(schema.parse(3.14)).toBe(3.14)
    })

    it('rejects non-number values', () => {
      const schema = jsonSchemaToZod({ type: 'number' })
      expect(() => schema.parse('not a number')).toThrow()
    })

    it('preserves description', () => {
      const schema = jsonSchemaToZod({ type: 'number', description: 'A count' })
      expect(schema.description).toBe('A count')
    })
  })

  describe('integer type', () => {
    it('converts { type: "integer" }', () => {
      const schema = jsonSchemaToZod({ type: 'integer' })
      expect(schema.parse(42)).toBe(42)
    })

    it('rejects float values', () => {
      const schema = jsonSchemaToZod({ type: 'integer' })
      expect(() => schema.parse(3.14)).toThrow()
    })

    it('rejects non-number values', () => {
      const schema = jsonSchemaToZod({ type: 'integer' })
      expect(() => schema.parse('42')).toThrow()
    })
  })

  describe('boolean type', () => {
    it('converts { type: "boolean" }', () => {
      const schema = jsonSchemaToZod({ type: 'boolean' })
      expect(schema.parse(true)).toBe(true)
      expect(schema.parse(false)).toBe(false)
    })

    it('rejects non-boolean values', () => {
      const schema = jsonSchemaToZod({ type: 'boolean' })
      expect(() => schema.parse('true')).toThrow()
    })
  })

  describe('array type', () => {
    it('converts { type: "array", items: { type: "string" } }', () => {
      const schema = jsonSchemaToZod({
        type: 'array',
        items: { type: 'string' },
      })
      expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
    })

    it('rejects non-array values', () => {
      const schema = jsonSchemaToZod({
        type: 'array',
        items: { type: 'string' },
      })
      expect(() => schema.parse('not array')).toThrow()
    })

    it('rejects items of wrong type', () => {
      const schema = jsonSchemaToZod({
        type: 'array',
        items: { type: 'number' },
      })
      expect(() => schema.parse([1, 'two', 3])).toThrow()
    })

    it('handles array without items as z.array(z.unknown())', () => {
      const schema = jsonSchemaToZod({ type: 'array' })
      expect(schema.parse([1, 'two', true])).toEqual([1, 'two', true])
    })

    it('preserves description', () => {
      const schema = jsonSchemaToZod({
        type: 'array',
        items: { type: 'string' },
        description: 'List of tags',
      })
      expect(schema.description).toBe('List of tags')
    })

    it('handles nested arrays', () => {
      const schema = jsonSchemaToZod({
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' },
        },
      })
      expect(schema.parse([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]])
      expect(() => schema.parse([[1, 'x']])).toThrow()
    })
  })

  describe('object type', () => {
    it('converts simple object with required fields', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      })
      expect(schema.parse({ name: 'Alice', age: 30 })).toEqual({ name: 'Alice', age: 30 })
    })

    it('makes fields optional when not in required array', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      })
      expect(schema.parse({ name: 'Alice' })).toEqual({ name: 'Alice' })
    })

    it('rejects missing required fields', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      })
      expect(() => schema.parse({ age: 30 })).toThrow()
    })

    it('converts object with no properties to z.object({})', () => {
      const schema = jsonSchemaToZod({ type: 'object' })
      expect(schema.parse({})).toEqual({})
    })

    it('converts object with empty properties to z.object({})', () => {
      const schema = jsonSchemaToZod({ type: 'object', properties: {} })
      expect(schema.parse({})).toEqual({})
    })

    it('handles object with no required array (all optional)', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'number' },
        },
      })
      expect(schema.parse({})).toEqual({})
      expect(schema.parse({ a: 'hi' })).toEqual({ a: 'hi' })
    })

    it('preserves description on object', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        description: 'A person',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      })
      expect(schema.description).toBe('A person')
    })

    it('preserves description on nested fields', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name' },
        },
        required: ['name'],
      })
      const shape = (schema as import('zod').ZodObject<Record<string, import('zod').ZodTypeAny>>).shape
      expect(shape.name.description).toBe('Full name')
    })
  })

  describe('nested objects and arrays', () => {
    it('handles nested objects', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                type: 'object',
                properties: {
                  city: { type: 'string' },
                  zip: { type: 'string' },
                },
                required: ['city'],
              },
            },
            required: ['name'],
          },
        },
        required: ['user'],
      })
      expect(
        schema.parse({
          user: { name: 'Alice', address: { city: 'NYC', zip: '10001' } },
        }),
      ).toEqual({
        user: { name: 'Alice', address: { city: 'NYC', zip: '10001' } },
      })
    })

    it('handles object with array of objects', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                label: { type: 'string' },
              },
              required: ['id', 'label'],
            },
          },
        },
        required: ['items'],
      })
      expect(
        schema.parse({
          items: [
            { id: 1, label: 'first' },
            { id: 2, label: 'second' },
          ],
        }),
      ).toEqual({
        items: [
          { id: 1, label: 'first' },
          { id: 2, label: 'second' },
        ],
      })
    })

    it('handles object with no type but has properties', () => {
      const schema = jsonSchemaToZod({
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      })
      expect(schema.parse({ name: 'test' })).toEqual({ name: 'test' })
    })
  })

  describe('enum type', () => {
    it('converts string enum', () => {
      const schema = jsonSchemaToZod({
        enum: ['red', 'green', 'blue'],
      })
      expect(schema.parse('red')).toBe('red')
      expect(schema.parse('blue')).toBe('blue')
    })

    it('rejects value not in enum', () => {
      const schema = jsonSchemaToZod({
        enum: ['red', 'green', 'blue'],
      })
      expect(() => schema.parse('yellow')).toThrow()
    })

    it('converts single-value enum', () => {
      const schema = jsonSchemaToZod({ enum: ['only'] })
      expect(schema.parse('only')).toBe('only')
      expect(() => schema.parse('other')).toThrow()
    })

    it('handles mixed-type enum with literals', () => {
      const schema = jsonSchemaToZod({ enum: ['active', 0, null] })
      expect(schema.parse('active')).toBe('active')
      expect(schema.parse(0)).toBe(0)
      expect(schema.parse(null)).toBe(null)
    })

    it('handles boolean enum values', () => {
      const schema = jsonSchemaToZod({ enum: [true, false] })
      expect(schema.parse(true)).toBe(true)
      expect(schema.parse(false)).toBe(false)
    })

    it('returns z.never() for empty enum', () => {
      const schema = jsonSchemaToZod({ enum: [] })
      expect(() => schema.parse('anything')).toThrow()
    })

    it('preserves description on enum', () => {
      const schema = jsonSchemaToZod({
        enum: ['a', 'b'],
        description: 'Choose one',
      })
      expect(schema.description).toBe('Choose one')
    })
  })

  describe('nullable types (type array)', () => {
    it('handles ["string", "null"] as nullable string', () => {
      const schema = jsonSchemaToZod({ type: ['string', 'null'] })
      expect(schema.parse('hello')).toBe('hello')
      expect(schema.parse(null)).toBe(null)
    })

    it('handles ["number", "null"] as nullable number', () => {
      const schema = jsonSchemaToZod({ type: ['number', 'null'] })
      expect(schema.parse(42)).toBe(42)
      expect(schema.parse(null)).toBe(null)
    })

    it('handles ["null"] as z.null()', () => {
      const schema = jsonSchemaToZod({ type: ['null'] })
      expect(schema.parse(null)).toBe(null)
    })
  })

  describe('real-world MCP tool schemas', () => {
    it('handles a typical search tool schema', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query string' },
          limit: { type: 'integer', description: 'Maximum results to return' },
          includeMetadata: { type: 'boolean', description: 'Include metadata in results' },
        },
        required: ['query'],
      })

      expect(schema.parse({ query: 'test', limit: 10, includeMetadata: true })).toEqual({
        query: 'test',
        limit: 10,
        includeMetadata: true,
      })
      expect(schema.parse({ query: 'minimal' })).toEqual({ query: 'minimal' })
    })

    it('handles a file operation tool schema', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'File content to write' },
          encoding: { type: 'string', description: 'File encoding' },
        },
        required: ['path', 'content'],
      })

      expect(schema.parse({ path: '/tmp/test.txt', content: 'hello' })).toEqual({
        path: '/tmp/test.txt',
        content: 'hello',
      })
      expect(() => schema.parse({ path: '/tmp/test.txt' })).toThrow()
    })

    it('handles a tool with array-of-objects parameter', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                op: { type: 'string', description: 'Operation name' },
                target: { type: 'string', description: 'Target path' },
              },
              required: ['op', 'target'],
            },
            description: 'List of operations to perform',
          },
        },
        required: ['operations'],
      })

      expect(
        schema.parse({
          operations: [
            { op: 'read', target: '/a.txt' },
            { op: 'write', target: '/b.txt' },
          ],
        }),
      ).toEqual({
        operations: [
          { op: 'read', target: '/a.txt' },
          { op: 'write', target: '/b.txt' },
        ],
      })
    })
  })
})
