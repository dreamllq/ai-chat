import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

const aiChatSrc = resolve(__dirname, '../../packages/ai-chat/src')

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@ai-chat/vue': resolve(aiChatSrc, 'index.ts'),
      '@ai-chat/storage-s3': resolve(__dirname, '../../packages/storage-s3/src/index.ts'),
      // 源码中 @/* 路径别名需要映射到 packages/ai-chat/src/*
      '@': aiChatSrc,
    },
  },
})
