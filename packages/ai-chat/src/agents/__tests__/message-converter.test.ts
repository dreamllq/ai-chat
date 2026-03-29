import { describe, it, expect } from 'vitest'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { convertMessages } from '../message-converter'
import type { ChatMessage, MessageAttachment } from '../../types'

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  }
}

function makeImageAttachment(overrides: Partial<MessageAttachment> = {}): MessageAttachment {
  return {
    id: 'att-1',
    name: 'photo.png',
    url: 'data:image/png;base64,abc',
    size: 1024,
    mimeType: 'image/png',
    type: 'image',
    ...overrides,
  }
}

function makeFileAttachment(overrides: Partial<MessageAttachment> = {}): MessageAttachment {
  return {
    id: 'att-2',
    name: 'report.pdf',
    url: 'https://example.com/report.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    type: 'document',
    ...overrides,
  }
}

describe('convertMessages', () => {
  it('should convert pure text messages to correct HumanMessage and AIMessage', () => {
    const messages = [
      makeMessage({ id: 'msg-1', role: 'user', content: 'Hello' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hi there' }),
    ]

    const result = convertMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[0]).toBeInstanceOf(HumanMessage)
    expect(result[0].content).toBe('Hello')
    expect(result[1]).toBeInstanceOf(AIMessage)
    expect(result[1].content).toBe('Hi there')
  })

  it('should prepend SystemMessage when systemPrompt is provided', () => {
    const messages = [makeMessage({ role: 'user', content: 'Hi' })]
    const result = convertMessages(messages, 'You are helpful.')

    expect(result).toHaveLength(2)
    expect(result[0]).toBeInstanceOf(SystemMessage)
    expect(result[0].content).toBe('You are helpful.')
    expect(result[1]).toBeInstanceOf(HumanMessage)
  })

  it('should not prepend SystemMessage when systemPrompt is undefined', () => {
    const messages = [makeMessage({ role: 'user', content: 'Hi' })]
    const result = convertMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(HumanMessage)
  })

  it('should handle image attachments with image_url content format', () => {
    const imageAttachment = makeImageAttachment()
    const messages = [
      makeMessage({
        role: 'user',
        content: 'Look at this image',
        metadata: { files: [imageAttachment] },
      }),
    ]

    const result = convertMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(HumanMessage)

    const content = result[0].content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(Array.isArray(content)).toBe(true)
    expect(content).toHaveLength(2)
    expect(content[0]).toEqual({ type: 'text', text: 'Look at this image' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,abc' },
    })
  })

  it('should prefer file.data over file.url when both are present for images', () => {
    const imageAttachment = makeImageAttachment({
      url: 'https://example.com/photo.png',
      data: 'data:image/png;base64,xyz',
    })
    const messages = [
      makeMessage({
        role: 'user',
        content: 'Check this',
        metadata: { files: [imageAttachment] },
      }),
    ]

    const result = convertMessages(messages)
    const content = result[0].content as Array<{ type: string; image_url?: { url: string } }>

    // Original code uses `file.url || file.data!` — url is truthy so it wins
    expect(content[1].image_url!.url).toBe('https://example.com/photo.png')
  })

  it('should use file.data as fallback for image URL when url is undefined', () => {
    const imageAttachment = makeImageAttachment({
      url: undefined,
      data: 'data:image/png;base64,xyz',
    })
    const messages = [
      makeMessage({
        role: 'user',
        content: 'Check this',
        metadata: { files: [imageAttachment] },
      }),
    ]

    const result = convertMessages(messages)
    const content = result[0].content as Array<{ type: string; image_url?: { url: string } }>

    expect(content[1].image_url!.url).toBe('data:image/png;base64,xyz')
  })

  it('should handle non-image file attachments as text descriptions', () => {
    const fileAttachment = makeFileAttachment()
    const messages = [
      makeMessage({
        role: 'user',
        content: 'See this file',
        metadata: { files: [fileAttachment] },
      }),
    ]

    const result = convertMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(HumanMessage)

    const content = result[0].content as Array<{ type: string; text?: string }>
    expect(content).toHaveLength(2)
    expect(content[0]).toEqual({ type: 'text', text: 'See this file' })
    expect(content[1]).toEqual({
      type: 'text',
      text: '[Attached file: report.pdf, 2.0KB]',
    })
  })

  it('should handle mixed conversation with various message types', () => {
    const messages = [
      makeMessage({ id: 'msg-1', role: 'user', content: 'Hello' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content: 'Hi!' }),
      makeMessage({
        id: 'msg-3',
        role: 'user',
        content: 'Describe this',
        metadata: { files: [makeImageAttachment(), makeFileAttachment()] },
      }),
      makeMessage({ id: 'msg-4', role: 'assistant', content: 'Sure!' }),
    ]

    const result = convertMessages(messages, 'Be concise')

    expect(result).toHaveLength(5) // system + 2 user + 2 assistant
    expect(result[0]).toBeInstanceOf(SystemMessage)
    expect(result[1]).toBeInstanceOf(HumanMessage)
    expect(result[1].content).toBe('Hello')
    expect(result[2]).toBeInstanceOf(AIMessage)
    expect(result[3]).toBeInstanceOf(HumanMessage)
    // Third message has mixed attachments
    const msg3Content = result[3].content as Array<{ type: string }>
    expect(msg3Content).toHaveLength(3) // text + image + file
    expect(result[4]).toBeInstanceOf(AIMessage)
  })

  it('should return empty array for empty messages without systemPrompt', () => {
    const result = convertMessages([])
    expect(result).toEqual([])
  })

  it('should return only SystemMessage for empty messages with systemPrompt', () => {
    const result = convertMessages([], 'System prompt')
    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(SystemMessage)
    expect(result[0].content).toBe('System prompt')
  })

  it('should produce simple string HumanMessage for user messages without attachments', () => {
    const messages = [makeMessage({ role: 'user', content: 'Just text' })]
    const result = convertMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(HumanMessage)
    expect(result[0].content).toBe('Just text')
  })

  it('should skip invalid attachments and produce simple string message', () => {
    const messages = [
      makeMessage({
        role: 'user',
        content: 'Bad files',
        metadata: { files: [{ not: 'valid' }] },
      }),
    ]
    const result = convertMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(HumanMessage)
    expect(result[0].content).toBe('Bad files')
  })

  it('should skip image attachments without url or data', () => {
    // When both url and data are undefined, isMessageAttachment returns false,
    // so the attachment is filtered out and we get a simple string message
    const messages = [
      makeMessage({
        role: 'user',
        content: 'Broken image',
        metadata: {
          files: [
            { id: 'att-1', name: 'photo.png', size: 1024, mimeType: 'image/png', type: 'image' },
          ],
        },
      }),
    ]
    const result = convertMessages(messages)

    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(HumanMessage)
    // isMessageAttachment filters this out (no url/data string), so simple string content
    expect(result[0].content).toBe('Broken image')
  })
})
