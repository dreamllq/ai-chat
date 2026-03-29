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

/** 上传进度事件 */
export interface UploadProgressEvent {
  /** 已上传字节 */
  loaded: number
  /** 总字节 */
  total: number
  /** 进度百分比 (0-100) */
  percent: number
}

/** 上传选项 */
export interface UploadOptions {
  /** 上传进度回调 */
  onProgress?: (event: UploadProgressEvent) => void
  /** 自定义 S3 key (覆盖自动生成的路径) */
  key?: string
}
