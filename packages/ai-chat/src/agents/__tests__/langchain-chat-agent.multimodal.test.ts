import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage, ModelConfig, MessageAttachment } from '../../types'

// Module-level mock stream function — accessible in both vi.mock and tests
const mockStream = vi.fn()

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    stream: mockStream,
  })),
}))

import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { LangChainChatAgent } from '../langchain-chat-agent'

function makeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'model-1',
    name: 'Test Model',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    modelName: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    createdAt: Date.now(),
    ...overrides,
  }
}

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

function makeAttachment(overrides: Partial<MessageAttachment> = {}): MessageAttachment {
  return {
    id: 'att-1',
    name: 'photo.jpg',
    url: 'https://example.com/photo.jpg',
    size: 1024 * 100, // 100KB
    mimeType: 'image/jpeg',
    type: 'image',
    ...overrides,
  }
}

/** Helper: capture messages passed to llm.stream() */
function captureStreamMessages(): { messages: unknown[] } {
  const captured: { messages: unknown[] } = { messages: [] }
  mockStream.mockImplementation(async (messages: unknown[]) => {
    captured.messages.push(...(messages as unknown[]))
    return (async function* () {
      yield { content: 'ok' }
    })()
  })
  return captured
}

describe('LangChainChatAgent — multimodal convertMessages', () => {
  let agent: LangChainChatAgent

  beforeEach(() => {
    vi.clearAllMocks()
    agent = new LangChainChatAgent()
  })

  it('should produce multimodal content array for image URL attachment', async () => {
    const captured = captureStreamMessages()

    const attachment = makeAttachment({
      name: 'photo.jpg',
      url: 'https://example.com/photo.jpg',
      size: 204800,
      mimeType: 'image/jpeg',
      type: 'image',
    })

    const messages = [
      makeMessage({
        content: 'What is in this image?',
        metadata: { files: [attachment] },
      }),
    ]

    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    expect(captured.messages).toHaveLength(1)
    const humanMsg = captured.messages[0] as HumanMessage
    expect(humanMsg).toBeInstanceOf(HumanMessage)

    const content = humanMsg.content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(Array.isArray(content)).toBe(true)
    expect(content).toHaveLength(2)
    expect(content[0]).toEqual({ type: 'text', text: 'What is in this image?' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://example.com/photo.jpg' },
    })
  })

  it('should produce multimodal content array for base64 image attachment', async () => {
    const captured = captureStreamMessages()

    const attachment = makeAttachment({
      name: 'pic.png',
      data: 'data:image/png;base64,iVBORw0KGgo=',
      url: undefined,
      size: 50000,
      mimeType: 'image/png',
      type: 'image',
    })

    const messages = [
      makeMessage({
        content: 'Describe this',
        metadata: { files: [attachment] },
      }),
    ]

    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    const humanMsg = captured.messages[0] as HumanMessage
    const content = humanMsg.content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(Array.isArray(content)).toBe(true)
    expect(content).toHaveLength(2)
    expect(content[0]).toEqual({ type: 'text', text: 'Describe this' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' },
    })
  })

  it('should describe PDF attachment as text, not image_url', async () => {
    const captured = captureStreamMessages()

    const attachment = makeAttachment({
      id: 'att-pdf',
      name: 'report.pdf',
      url: 'https://example.com/report.pdf',
      size: 204800, // 200KB
      mimeType: 'application/pdf',
      type: 'document',
    })

    const messages = [
      makeMessage({
        content: 'Summarize this',
        metadata: { files: [attachment] },
      }),
    ]

    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    const humanMsg = captured.messages[0] as HumanMessage
    const content = humanMsg.content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(Array.isArray(content)).toBe(true)
    expect(content).toHaveLength(2)
    expect(content[0]).toEqual({ type: 'text', text: 'Summarize this' })
    expect(content[1]).toEqual({
      type: 'text',
      text: '[Attached file: report.pdf, 200.0KB]',
    })
    // Ensure no image_url block
    expect(content.some((c) => c.type === 'image_url')).toBe(false)
  })

  it('should describe audio attachment as text only', async () => {
    const captured = captureStreamMessages()

    const attachment = makeAttachment({
      id: 'att-audio',
      name: 'song.mp3',
      url: 'https://example.com/song.mp3',
      size: 3072 * 1024,
      mimeType: 'audio/mpeg',
      type: 'audio',
    })

    const messages = [
      makeMessage({
        content: 'Transcribe this',
        metadata: { files: [attachment] },
      }),
    ]

    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    const humanMsg = captured.messages[0] as HumanMessage
    const content = humanMsg.content as Array<{ type: string; text?: string }>
    expect(Array.isArray(content)).toBe(true)
    expect(content).toHaveLength(2)
    expect(content[1].type).toBe('text')
    expect(content[1].text).toContain('song.mp3')
  })

  it('should describe video attachment as text only', async () => {
    const captured = captureStreamMessages()

    const attachment = makeAttachment({
      id: 'att-video',
      name: 'clip.mp4',
      url: 'https://example.com/clip.mp4',
      size: 5000 * 1024,
      mimeType: 'video/mp4',
      type: 'video',
    })

    const messages = [
      makeMessage({
        content: 'What happens in this video?',
        metadata: { files: [attachment] },
      }),
    ]

    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    const humanMsg = captured.messages[0] as HumanMessage
    const content = humanMsg.content as Array<{ type: string; text?: string }>
    expect(content.some((c) => c.type === 'image_url')).toBe(false)
    expect(content[1].text).toContain('clip.mp4')
  })

  it('should produce string content when no metadata.files', async () => {
    const captured = captureStreamMessages()

    const messages = [makeMessage({ content: 'Just text', metadata: {} })]

    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    const humanMsg = captured.messages[0] as HumanMessage
    expect(humanMsg).toBeInstanceOf(HumanMessage)
    expect(humanMsg.content).toBe('Just text')
  })

  it('should handle old-format metadata {name, size, type} gracefully without crash', async () => {
    const captured = captureStreamMessages()

    // Old format: { name: string, size: number, type: string } — NOT a valid MessageAttachment
    const messages = [
      makeMessage({
        content: 'Legacy data',
        metadata: {
          files: [{ name: 'old.txt', size: 1234, type: 'text/plain' }],
        },
      }),
    ]

    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    const humanMsg = captured.messages[0] as HumanMessage
    expect(humanMsg).toBeInstanceOf(HumanMessage)
    // Should fall back to string content since the attachment doesn't pass isMessageAttachment
    expect(humanMsg.content).toBe('Legacy data')
  })

  it('should handle mixed content — text + image + PDF', async () => {
    const captured = captureStreamMessages()

    const imageAttachment = makeAttachment({
      id: 'att-img',
      name: 'diagram.png',
      url: 'https://example.com/diagram.png',
      size: 50000,
      mimeType: 'image/png',
      type: 'image',
    })

    const pdfAttachment = makeAttachment({
      id: 'att-pdf',
      name: 'report.pdf',
      url: 'https://example.com/report.pdf',
      size: 204800,
      mimeType: 'application/pdf',
      type: 'document',
    })

    const messages = [
      makeMessage({
        content: 'Analyze these',
        metadata: { files: [imageAttachment, pdfAttachment] },
      }),
    ]

    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    const humanMsg = captured.messages[0] as HumanMessage
    const content = humanMsg.content as Array<{ type: string; text?: string; image_url?: { url: string } }>
    expect(Array.isArray(content)).toBe(true)
    // text + image_url + text (pdf description)
    expect(content).toHaveLength(3)
    expect(content[0]).toEqual({ type: 'text', text: 'Analyze these' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://example.com/diagram.png' },
    })
    expect(content[2]).toEqual({
      type: 'text',
      text: '[Attached file: report.pdf, 200.0KB]',
    })
  })

  it('should still produce correct AIMessage for assistant messages alongside multimodal user messages', async () => {
    const captured = captureStreamMessages()

    const imageAttachment = makeAttachment({
      id: 'att-img',
      name: 'photo.jpg',
      url: 'https://example.com/photo.jpg',
      size: 80000,
      mimeType: 'image/jpeg',
      type: 'image',
    })

    const messages = [
      makeMessage({
        role: 'user',
        content: 'Look at this',
        metadata: { files: [imageAttachment] },
      }),
      makeMessage({
        role: 'assistant',
        content: 'I see a photo',
        metadata: {},
      }),
    ]

    for await (const _ of agent.chat(messages, makeModel())) {
      void _
    }

    expect(captured.messages).toHaveLength(2)
    expect(captured.messages[0]).toBeInstanceOf(HumanMessage)
    expect(captured.messages[1]).toBeInstanceOf(AIMessage)

    const humanContent = (captured.messages[0] as HumanMessage).content
    expect(Array.isArray(humanContent)).toBe(true)

    const aiContent = (captured.messages[1] as AIMessage).content
    expect(aiContent).toBe('I see a photo')
  })
})
