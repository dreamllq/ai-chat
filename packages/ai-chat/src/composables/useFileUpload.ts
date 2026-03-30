import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type {
  FileUploadService,
  FileUploadState,
  FileUploadOptions,
  MessageAttachment,
  UploadedFile,
} from '../types'
import { getAttachmentType } from '../types'

/** Convert a File to a base64 data URL */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

interface UseFileUploadOptions {
  fileUploadService?: FileUploadService | null
}

interface UseFileUploadReturn {
  fileStates: Ref<FileUploadState[]>
  isUploading: ComputedRef<boolean>
  isAllReady: ComputedRef<boolean>
  addFile: (file: File) => void
  removeFile: (id: string) => void
  retryFile: (id: string) => void
  getCompletedAttachments: () => MessageAttachment[]
  clear: () => void
}

export function useFileUpload(options: UseFileUploadOptions): UseFileUploadReturn {
  const fileStates = ref<FileUploadState[]>([])

  // Internal map for base64 data (no-service mode)
  const base64DataMap = new Map<string, string>()

  const isUploading = computed(() =>
    fileStates.value.some((s) => s.status === 'uploading'),
  )

  const isAllReady = computed(() => {
    if (fileStates.value.length === 0) return true
    return fileStates.value.every((s) => s.status === 'success')
  })

  function updateState(id: string, updates: Partial<FileUploadState>): void {
    fileStates.value = fileStates.value.map((s) =>
      s.id === id ? { ...s, ...updates } : s,
    )
  }

  async function uploadFile(state: FileUploadState): Promise<void> {
    const idx = fileStates.value.findIndex((s) => s.id === state.id)
    if (idx === -1) return

    updateState(state.id, { status: 'uploading' })

    const uploadOptions: FileUploadOptions = {
      onProgress: (event) => {
        updateState(state.id, { progress: event.percent })
      },
      signal: state.abortController?.signal,
    }

    try {
      const result = await options.fileUploadService!.upload(state.file, uploadOptions)
      updateState(state.id, { status: 'success', result })
    } catch (error) {
      // Don't update state if the upload was cancelled (removed from list)
      const stillExists = fileStates.value.some((s) => s.id === state.id)
      if (stillExists) {
        updateState(state.id, {
          status: 'failed',
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
    }
  }

  async function uploadFileBase64(state: FileUploadState): Promise<void> {
    try {
      const data = await fileToBase64(state.file)
      const mimeType = state.file.type || 'application/octet-stream'
      const result: UploadedFile = {
        id: crypto.randomUUID(),
        name: state.file.name,
        url: '',
        size: state.file.size,
        mimeType,
      }
      base64DataMap.set(state.id, data)
      updateState(state.id, { status: 'success', result })
    } catch (error) {
      const stillExists = fileStates.value.some((s) => s.id === state.id)
      if (stillExists) {
        updateState(state.id, {
          status: 'failed',
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
    }
  }

  function addFile(file: File): void {
    const id = crypto.randomUUID()
    const abortController = new AbortController()

    const state: FileUploadState = {
      id,
      file,
      status: 'pending',
      progress: 0,
      abortController,
    }

    fileStates.value = [...fileStates.value, state]

    if (options.fileUploadService) {
      uploadFile(state)
    } else {
      uploadFileBase64(state)
    }
  }

  function removeFile(id: string): void {
    const state = fileStates.value.find((s) => s.id === id)
    if (!state) return

    if (state.status === 'uploading' && state.abortController) {
      state.abortController.abort()
    }

    fileStates.value = fileStates.value.filter((s) => s.id !== id)
    base64DataMap.delete(id)
  }

  function retryFile(id: string): void {
    const state = fileStates.value.find((s) => s.id === id)
    if (!state || state.status !== 'failed') return

    const newAbortController = new AbortController()
    updateState(id, {
      status: 'pending',
      progress: 0,
      error: undefined,
      abortController: newAbortController,
    })

    if (options.fileUploadService) {
      const updatedState = fileStates.value.find((s) => s.id === id)!
      uploadFile(updatedState)
    } else {
      const updatedState = fileStates.value.find((s) => s.id === id)!
      uploadFileBase64(updatedState)
    }
  }

  function getCompletedAttachments(): MessageAttachment[] {
    return fileStates.value
      .filter((s) => s.status === 'success' && s.result != null)
      .map((s): MessageAttachment => {
        const result = s.result!
        const base64Data = base64DataMap.get(s.id)
        return {
          id: result.id,
          name: result.name,
          ...(base64Data ? { data: base64Data } : { url: result.url }),
          size: result.size,
          mimeType: result.mimeType,
          type: getAttachmentType(result.mimeType),
        }
      })
  }

  function clear(): void {
    fileStates.value.forEach((s) => {
      if (s.status === 'uploading' && s.abortController) {
        s.abortController.abort()
      }
    })
    fileStates.value = []
    base64DataMap.clear()
  }

  return {
    fileStates,
    isUploading,
    isAllReady,
    addFile,
    removeFile,
    retryFile,
    getCompletedAttachments,
    clear,
  }
}
