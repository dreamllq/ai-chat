# Decisions — ai-chat-component

## 2026-03-28 Initial
- i18n: Custom provide/inject (no vue-i18n dependency)
- Element Plus: peerDependency, not bundled
- DB: Dexie.js with fake-indexeddb for testing
- Agent: AsyncGenerator pattern for streaming
- Build: Vite library mode, ESM + UMD
