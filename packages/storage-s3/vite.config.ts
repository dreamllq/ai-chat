import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: 'dist/types',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'StorageS3',
      fileName: 'storage-s3',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['@ai-chat/vue'],
      output: {
        globals: {
          '@ai-chat/vue': 'AiChat',
        },
      },
    },
  },
})
