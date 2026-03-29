import type { FileUploadOptions, FileUploadProgressEvent } from '@ai-chat/vue'

/** S3 存储服务配置 */
export interface S3StorageConfig {
  /** S3 兼容端点地址 */
  endpoint: string
  /** S3 区域 */
  region: string
  /** S3 Bucket 名称 */
  bucket: string
  /** S3 Access Key ID */
  accessKeyId: string
  /** S3 Secret Access Key */
  secretAccessKey: string
  /** 是否强制路径风格 (Supabase 需要 true) */
  forcePathStyle?: boolean
  /** 上传文件的 key 前缀 (默认 'uploads') */
  prefix?: string
}

/** 上传进度事件 — re-exported from @ai-chat/vue */
export type UploadProgressEvent = FileUploadProgressEvent

/** 上传选项 — extends @ai-chat/vue's FileUploadOptions with S3-specific key */
export interface UploadOptions extends FileUploadOptions {
  /** 自定义 S3 key (覆盖自动生成的路径) */
  key?: string
}
