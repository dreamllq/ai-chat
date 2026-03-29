import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { FileUploadService, UploadedFile } from '@ai-chat/vue'
import type { S3StorageConfig, UploadOptions, UploadProgressEvent } from './types'

export class S3StorageService implements FileUploadService {
  private client: S3Client
  private config: S3StorageConfig

  constructor(config: S3StorageConfig) {
    this.config = config
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle,
    })
  }

  private generateKey(fileName: string): string {
    const prefix = this.config.prefix ?? 'uploads'
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const uuid = crypto.randomUUID()
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : ''
    return `${prefix}/${year}/${month}/${day}/${uuid}${ext}`
  }

  private getPublicUrl(key: string): string {
    const baseUrl = this.config.endpoint.replace(/\/s3$/, '')
    return `${baseUrl}/object/public/${this.config.bucket}/${key}`
  }

  async uploadWithProgress(file: File, options?: UploadOptions): Promise<UploadedFile> {
    const key = options?.key ?? this.generateKey(file.name)

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.config.bucket,
        Key: key,
        Body: file,
        ContentType: file.type,
      },
    })

    if (options?.onProgress) {
      upload.on('httpUploadProgress', (progress) => {
        const loaded = progress.loaded ?? 0
        const total = progress.total ?? 0
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0
        options.onProgress!({ loaded, total, percent })
      })
    }

    // Abort upload when signal fires
    if (options?.signal) {
      if (options.signal.aborted) {
        upload.abort()
      } else {
        options.signal.addEventListener('abort', () => upload.abort(), { once: true })
      }
    }

    await upload.done()

    const url = this.getPublicUrl(key)
    return {
      id: key,
      name: file.name,
      url,
      size: file.size,
      mimeType: file.type,
    }
  }

  async upload(file: File, options?: UploadOptions): Promise<UploadedFile> {
    return this.uploadWithProgress(file, options)
  }

  async getFileUrl(fileId: string): Promise<string> {
    return this.getPublicUrl(fileId)
  }
}
