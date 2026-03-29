import { describe, it, expect } from 'vitest'
import {
  getAttachmentType,
  isMessageAttachment,
  isLegacyFileMetadata,
} from '../index'

// === getAttachmentType ===

describe('getAttachmentType', () => {
  it('returns "image" for image/jpeg', () => {
    expect(getAttachmentType('image/jpeg')).toBe('image')
  })

  it('returns "image" for image/png', () => {
    expect(getAttachmentType('image/png')).toBe('image')
  })

  it('returns "audio" for audio/mp3', () => {
    expect(getAttachmentType('audio/mp3')).toBe('audio')
  })

  it('returns "video" for video/mp4', () => {
    expect(getAttachmentType('video/mp4')).toBe('video')
  })

  it('returns "document" for application/pdf', () => {
    expect(getAttachmentType('application/pdf')).toBe('document')
  })

  it('returns "document" for text/plain', () => {
    expect(getAttachmentType('text/plain')).toBe('document')
  })

  it('returns "document" for empty string', () => {
    expect(getAttachmentType('')).toBe('document')
  })

  it('returns "document" for application/octet-stream', () => {
    expect(getAttachmentType('application/octet-stream')).toBe('document')
  })
})

// === isMessageAttachment ===

describe('isMessageAttachment', () => {
  it('returns true for valid URL attachment', () => {
    const attachment = {
      id: '1',
      name: 'photo.jpg',
      url: 'https://cdn.example.com/photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      type: 'image',
    }
    expect(isMessageAttachment(attachment)).toBe(true)
  })

  it('returns true for valid base64 attachment', () => {
    const attachment = {
      id: '2',
      name: 'photo.png',
      data: 'data:image/png;base64,...',
      size: 2048,
      mimeType: 'image/png',
      type: 'image',
    }
    expect(isMessageAttachment(attachment)).toBe(true)
  })

  it('returns false when id is missing', () => {
    const obj = {
      name: 'photo.jpg',
      url: 'https://cdn.example.com/photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      type: 'image',
    }
    expect(isMessageAttachment(obj)).toBe(false)
  })

  it('returns false when name is missing', () => {
    const obj = {
      id: '1',
      url: 'https://cdn.example.com/photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      type: 'image',
    }
    expect(isMessageAttachment(obj)).toBe(false)
  })

  it('returns false when both url and data are missing', () => {
    const obj = {
      id: '1',
      name: 'photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      type: 'image',
    }
    expect(isMessageAttachment(obj)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isMessageAttachment(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isMessageAttachment(undefined)).toBe(false)
  })

  it('returns false for legacy format without id', () => {
    const legacy = { name: 'old.jpg', size: 100, type: 'image/jpeg' }
    expect(isMessageAttachment(legacy)).toBe(false)
  })
})

// === isLegacyFileMetadata ===

describe('isLegacyFileMetadata', () => {
  it('returns true for old format with name, size, type', () => {
    const legacy = { name: 'old.jpg', size: 100, type: 'image/jpeg' }
    expect(isLegacyFileMetadata(legacy)).toBe(true)
  })

  it('returns false for new MessageAttachment format (has extra id field)', () => {
    const attachment = {
      id: '1',
      name: 'photo.jpg',
      url: 'https://cdn.example.com/photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      type: 'image',
    }
    expect(isLegacyFileMetadata(attachment)).toBe(false)
  })

  it('returns false for empty object', () => {
    expect(isLegacyFileMetadata({})).toBe(false)
  })

  it('returns false for null', () => {
    expect(isLegacyFileMetadata(null)).toBe(false)
  })

  it('returns false when type is missing', () => {
    const obj = { name: 'file', size: 100 }
    expect(isLegacyFileMetadata(obj)).toBe(false)
  })
})
