import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import type { FileUploadService, UploadedFile, FileUploadOptions } from '../../types'
import { useFileUpload } from '../useFileUpload'

// --- Helpers ---

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T
  const App = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  const wrapper = mount(App)
  return { result, unmount: () => wrapper.unmount() }
}

function createMockFile(name: string, type: string, size = 1024): File {
  return new File(['x'.repeat(size)], name, { type })
}

/** Create a mock upload service where you can control when upload resolves/rejects */
function createControllableUploadService() {
  let pendingResolve: ((result: UploadedFile) => void) | null = null
  let pendingReject: ((error: Error) => void) | null = null
  let capturedOptions: FileUploadOptions | undefined

  const uploadFn = vi.fn(async (file: File, options?: FileUploadOptions): Promise<UploadedFile> => {
    capturedOptions = options
    return new Promise<UploadedFile>((resolve, reject) => {
      pendingResolve = resolve
      pendingReject = reject
    })
  })

  return {
    service: {
      upload: uploadFn,
      getFileUrl: vi.fn(async (id: string) => `https://cdn.example.com/${id}`),
    } satisfies FileUploadService,
    resolve: (result?: UploadedFile) => {
      if (pendingResolve) {
        pendingResolve(
          result ?? {
            id: 'upload-id',
            name: 'test.png',
            url: 'https://cdn.example.com/test.png',
            size: 1024,
            mimeType: 'image/png',
          },
        )
        pendingResolve = null
      }
    },
    reject: (error: Error) => {
      if (pendingReject) {
        pendingReject(error)
        pendingReject = null
      }
    },
    /** Manually trigger onProgress callback captured from the last upload call */
    triggerProgress: (percent: number) => {
      if (capturedOptions?.onProgress) {
        capturedOptions.onProgress({ loaded: Math.round(percent * 10.24), total: 1024, percent })
      }
    },
  }
}

// --- Test Suite ---

describe('useFileUpload', () => {
  let result: ReturnType<typeof useFileUpload>
  let unmount: () => void

  beforeEach(() => {
    // Fresh instance each test
  })

  afterEach(() => {
    unmount?.()
  })

  function setup(options?: { fileUploadService?: FileUploadService | null }) {
    const s = withSetup(() =>
      useFileUpload({
        fileUploadService: options?.fileUploadService ?? null,
      }),
    )
    result = s.result
    unmount = s.unmount
    return result
  }

  // Test 1: addFile with service → triggers upload, status = uploading
  it('addFile: triggers upload when service provided, status becomes uploading', async () => {
    const { service } = createControllableUploadService()
    setup({ fileUploadService: service })

    const file = createMockFile('test.png', 'image/png')
    result.addFile(file)

    await nextTick()

    expect(result.fileStates.value).toHaveLength(1)
    expect(result.fileStates.value[0].status).toBe('uploading')
    expect(result.fileStates.value[0].file).toBe(file)
    expect(result.fileStates.value[0].progress).toBe(0)
    expect(result.fileStates.value[0].abortController).toBeDefined()
    expect(service.upload).toHaveBeenCalledOnce()
  })

  // Test 2: addFile without service (Base64) → status = success immediately
  it('addFile: without service, status becomes success immediately (Base64 mode)', async () => {
    setup({ fileUploadService: null })

    const file = createMockFile('doc.pdf', 'application/pdf', 100)
    result.addFile(file)

    // Wait for async fileToBase64
    await vi.waitFor(() => {
      expect(result.fileStates.value[0]?.status).toBe('success')
    })

    expect(result.fileStates.value[0].result).toBeDefined()
    expect(result.fileStates.value[0].result!.name).toBe('doc.pdf')
  })

  // Test 3: progress updates via onProgress callback
  it('progress: updates when service calls onProgress', async () => {
    const { service, triggerProgress } = createControllableUploadService()
    setup({ fileUploadService: service })

    const file = createMockFile('photo.jpg', 'image/jpeg')
    result.addFile(file)
    await nextTick()

    // Manually trigger progress callback
    triggerProgress(50)

    expect(result.fileStates.value[0].progress).toBe(50)
  })

  // Test 4: upload success → status = success, result has UploadedFile
  it('upload success: status becomes success with result', async () => {
    const { service, resolve } = createControllableUploadService()
    setup({ fileUploadService: service })

    const file = createMockFile('photo.jpg', 'image/jpeg')
    result.addFile(file)
    await nextTick()

    resolve({
      id: 'upload-photo',
      name: 'photo.jpg',
      url: 'https://cdn.example.com/photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
    })

    await vi.waitFor(() => {
      expect(result.fileStates.value[0].status).toBe('success')
    })

    expect(result.fileStates.value[0].result).toBeDefined()
    expect(result.fileStates.value[0].result!.url).toBe('https://cdn.example.com/photo.jpg')
  })

  // Test 5: upload failure → status = failed, error has value
  it('upload failure: status becomes failed with error', async () => {
    const { service, reject } = createControllableUploadService()
    setup({ fileUploadService: service })

    const file = createMockFile('broken.txt', 'text/plain')
    result.addFile(file)
    await nextTick()

    reject(new Error('Network error'))

    await vi.waitFor(() => {
      expect(result.fileStates.value[0].status).toBe('failed')
    })

    expect(result.fileStates.value[0].error).toBeInstanceOf(Error)
    expect(result.fileStates.value[0].error!.message).toBe('Network error')
  })

  // Test 6: removeFile during upload → abort called
  it('removeFile: during upload, aborts the request', async () => {
    const { service } = createControllableUploadService()
    setup({ fileUploadService: service })

    const file = createMockFile('test.png', 'image/png')
    result.addFile(file)
    await nextTick()

    const stateId = result.fileStates.value[0].id
    const abortSpy = vi.spyOn(result.fileStates.value[0].abortController!, 'abort')

    result.removeFile(stateId)

    expect(abortSpy).toHaveBeenCalled()
    expect(result.fileStates.value).toHaveLength(0)
  })

  // Test 7: removeFile after upload → just removes from list
  it('removeFile: after upload complete, just removes from list', async () => {
    const { service, resolve } = createControllableUploadService()
    setup({ fileUploadService: service })

    const file = createMockFile('test.png', 'image/png')
    result.addFile(file)
    await nextTick()
    resolve()
    await vi.waitFor(() => {
      expect(result.fileStates.value[0].status).toBe('success')
    })

    const stateId = result.fileStates.value[0].id
    result.removeFile(stateId)

    expect(result.fileStates.value).toHaveLength(0)
  })

  // Test 8: retryFile → resets to uploading, progress 0, new AbortController
  it('retryFile: resets status to uploading with new AbortController', async () => {
    const { service, reject } = createControllableUploadService()
    setup({ fileUploadService: service })

    const file = createMockFile('test.png', 'image/png')
    result.addFile(file)
    await nextTick()
    reject(new Error('fail'))
    await vi.waitFor(() => {
      expect(result.fileStates.value[0].status).toBe('failed')
    })

    result.retryFile(result.fileStates.value[0].id)
    await nextTick()

    expect(result.fileStates.value[0].status).toBe('uploading')
    expect(result.fileStates.value[0].progress).toBe(0)
    expect(result.fileStates.value[0].error).toBeUndefined()
    expect(result.fileStates.value[0].abortController).toBeDefined()
  })

  // Test 9: isUploading computed
  it('isUploading: true when any file is uploading', async () => {
    const { service } = createControllableUploadService()
    setup({ fileUploadService: service })

    expect(result.isUploading.value).toBe(false)

    result.addFile(createMockFile('a.png', 'image/png'))
    await nextTick()

    expect(result.isUploading.value).toBe(true)
  })

  // Test 10: isAllReady computed
  it('isAllReady: true when all files are success (empty = true)', async () => {
    const { service, resolve } = createControllableUploadService()
    setup({ fileUploadService: service })

    expect(result.isAllReady.value).toBe(true) // empty list

    result.addFile(createMockFile('a.png', 'image/png'))
    await nextTick()

    expect(result.isAllReady.value).toBe(false) // uploading

    resolve()
    await vi.waitFor(() => {
      expect(result.isAllReady.value).toBe(true)
    })
  })

  // Test 11: getCompletedAttachments
  it('getCompletedAttachments: returns MessageAttachment[] for success files', async () => {
    const { service, resolve } = createControllableUploadService()
    setup({ fileUploadService: service })

    result.addFile(createMockFile('photo.jpg', 'image/jpeg'))
    await nextTick()
    resolve({
      id: 'upload-photo',
      name: 'photo.jpg',
      url: 'https://cdn.example.com/photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
    })
    await vi.waitFor(() => {
      expect(result.fileStates.value[0].status).toBe('success')
    })

    const attachments = result.getCompletedAttachments()
    expect(attachments).toHaveLength(1)
    expect(attachments[0].name).toBe('photo.jpg')
    expect(attachments[0].type).toBe('image')
    expect(attachments[0].url).toBeDefined()
  })

  // Test 12: clear
  it('clear: empties all file states', async () => {
    const { service, resolve } = createControllableUploadService()
    setup({ fileUploadService: service })

    result.addFile(createMockFile('a.png', 'image/png'))
    await nextTick()
    resolve()
    await vi.waitFor(() => {
      expect(result.fileStates.value[0].status).toBe('success')
    })

    result.clear()
    expect(result.fileStates.value).toHaveLength(0)
  })

  // Test 13: multi-file parallel upload
  it('multi-file: each file uploads independently', async () => {
    const { service } = createControllableUploadService()
    setup({ fileUploadService: service })

    result.addFile(createMockFile('a.png', 'image/png'))
    result.addFile(createMockFile('b.pdf', 'application/pdf'))
    result.addFile(createMockFile('c.mp3', 'audio/mpeg'))
    await nextTick()

    expect(result.fileStates.value).toHaveLength(3)
    expect(service.upload).toHaveBeenCalledTimes(3)
    expect(result.isUploading.value).toBe(true)
  })
})
