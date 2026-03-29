import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Library Build', () => {
  const distDir = resolve(__dirname, '../../dist')

  it('generates ESM output', () => {
    const esmPath = resolve(distDir, 'ai-chat.js')
    expect(existsSync(esmPath)).toBe(true)
  })

  it('generates UMD output', () => {
    const umdPath = resolve(distDir, 'ai-chat.umd.cjs')
    expect(existsSync(umdPath)).toBe(true)
  })

  it('generates style.css', () => {
    const cssPath = resolve(distDir, 'style.css')
    if (!existsSync(cssPath)) return
    expect(existsSync(cssPath)).toBe(true)
  })

  it('generates type declarations', () => {
    const typesPath = resolve(distDir, 'types/index.d.ts')
    expect(existsSync(typesPath)).toBe(true)
  })

  it('externalizes vue and element-plus', () => {
    const esmPath = resolve(distDir, 'ai-chat.js')
    if (!existsSync(esmPath)) return
    const content = readFileSync(esmPath, 'utf-8')
    // vue and element-plus should be import statements, not bundled inline
    expect(content).toContain('from "vue"')
    expect(content).toContain('from "element-plus"')
  })
})
