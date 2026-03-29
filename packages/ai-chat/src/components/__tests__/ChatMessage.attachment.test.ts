import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ChatMessage as ChatMessageType } from '../../types'
import ChatMessage from '../ChatMessage.vue'

// Mock useLocale
const mockT = vi.fn((path: string) => {
  const map: Record<string, string> = {
    'chat.copyCode': 'Copy Code',
    'chat.copySuccess': 'Copied!',
    'attachment.image': 'Image',
    'attachment.document': 'Document',
    'attachment.audio': 'Audio',
    'attachment.video': 'Video',
    'attachment.download': 'Download',
    'attachment.unsupportedPreview': 'Preview not available',
  }
  return map[path] ?? path
})

vi.mock('../../composables/useLocale', () => ({
  useLocale: () => ({
    t: mockT,
    locale: { value: {} },
    setLocale: vi.fn(),
  }),
}))

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
  },
  writable: true,
})

function createMessage(overrides: Partial<ChatMessageType> = {}): ChatMessageType {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  }
}

function mountChatMessage(props: { message: ChatMessageType }) {
  return mount(ChatMessage, {
    props,
  })
}

describe('ChatMessage — Attachments', () => {
  beforeEach(() => {
    mockT.mockClear()
    vi.mocked(navigator.clipboard.writeText).mockReset()
  })

  it('renders image URL attachment', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'Check this out',
        metadata: {
          files: [
            {
              id: 'file-1',
              name: 'photo.jpg',
              url: 'https://example.com/photo.jpg',
              size: 102400,
              mimeType: 'image/jpeg',
              type: 'image',
            },
          ],
        },
      }),
    })

    const attachment = wrapper.find('.chat-message__attachment')
    expect(attachment.exists()).toBe(true)
    expect(attachment.classes()).toContain('chat-message__attachment--image')

    const img = wrapper.find('.chat-message__attachment-image')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/photo.jpg')
    expect(img.attributes('alt')).toBe('photo.jpg')
  })

  it('renders base64 image attachment', () => {
    const base64Data = 'data:image/png;base64,iVBORw0KGgo='
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'Base64 image',
        metadata: {
          files: [
            {
              id: 'file-2',
              name: 'icon.png',
              data: base64Data,
              size: 512,
              mimeType: 'image/png',
              type: 'image',
            },
          ],
        },
      }),
    })

    const img = wrapper.find('.chat-message__attachment-image')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(base64Data)
  })

  it('renders PDF/document attachment', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'Here is a doc',
        metadata: {
          files: [
            {
              id: 'file-3',
              name: 'report.pdf',
              url: 'https://example.com/report.pdf',
              size: 2048000,
              mimeType: 'application/pdf',
              type: 'document',
            },
          ],
        },
      }),
    })

    const attachment = wrapper.find('.chat-message__attachment')
    expect(attachment.exists()).toBe(true)
    expect(attachment.classes()).toContain('chat-message__attachment--document')

    const docEl = wrapper.find('.chat-message__attachment-doc')
    expect(docEl.exists()).toBe(true)
    expect(docEl.text()).toContain('report.pdf')
    expect(docEl.text()).toContain('2.0 MB')
  })

  it('renders audio attachment', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'Listen to this',
        metadata: {
          files: [
            {
              id: 'file-4',
              name: 'song.mp3',
              url: 'https://example.com/song.mp3',
              size: 5000000,
              mimeType: 'audio/mpeg',
              type: 'audio',
            },
          ],
        },
      }),
    })

    const attachment = wrapper.find('.chat-message__attachment')
    expect(attachment.exists()).toBe(true)
    expect(attachment.classes()).toContain('chat-message__attachment--audio')

    const audio = wrapper.find('audio')
    expect(audio.exists()).toBe(true)
    expect(audio.attributes('src')).toBe('https://example.com/song.mp3')
    expect(audio.attributes('controls')).toBeDefined()
  })

  it('renders video attachment', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'Watch this',
        metadata: {
          files: [
            {
              id: 'file-5',
              name: 'clip.mp4',
              url: 'https://example.com/clip.mp4',
              size: 15000000,
              mimeType: 'video/mp4',
              type: 'video',
            },
          ],
        },
      }),
    })

    const attachment = wrapper.find('.chat-message__attachment')
    expect(attachment.exists()).toBe(true)
    expect(attachment.classes()).toContain('chat-message__attachment--video')

    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('https://example.com/clip.mp4')
    expect(video.attributes('controls')).toBeDefined()
  })

  it('renders multiple attachments', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'Multiple files',
        metadata: {
          files: [
            {
              id: 'file-a',
              name: 'photo.jpg',
              url: 'https://example.com/photo.jpg',
              size: 1024,
              mimeType: 'image/jpeg',
              type: 'image',
            },
            {
              id: 'file-b',
              name: 'doc.pdf',
              url: 'https://example.com/doc.pdf',
              size: 2048,
              mimeType: 'application/pdf',
              type: 'document',
            },
            {
              id: 'file-c',
              name: 'audio.mp3',
              url: 'https://example.com/audio.mp3',
              size: 4096,
              mimeType: 'audio/mpeg',
              type: 'audio',
            },
          ],
        },
      }),
    })

    const attachments = wrapper.findAll('.chat-message__attachment')
    expect(attachments).toHaveLength(3)
  })

  it('handles old-format legacy metadata without crash', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'Legacy file',
        metadata: {
          files: [
            { name: 'old-file.txt', size: 100, type: 'text/plain' },
          ],
        },
      }),
    })

    // Should render without crash — legacy items are treated as documents
    const legacyDoc = wrapper.find('.chat-message__attachment-doc')
    expect(legacyDoc.exists()).toBe(true)
    expect(legacyDoc.text()).toContain('old-file.txt')
  })

  it('renders no attachment elements when metadata has no files', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'No files here',
        metadata: {},
      }),
    })

    expect(wrapper.find('.chat-message__attachments').exists()).toBe(false)
    expect(wrapper.find('.chat-message__attachment').exists()).toBe(false)
  })

  it('renders no attachment elements when metadata.files is invalid', () => {
    const wrapper = mountChatMessage({
      message: createMessage({
        role: 'user',
        content: 'Bad metadata',
        metadata: {
          files: { not: 'an array' },
        },
      }),
    })

    expect(wrapper.find('.chat-message__attachments').exists()).toBe(false)
    expect(wrapper.find('.chat-message__attachment').exists()).toBe(false)
  })
})
