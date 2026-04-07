// === Components ===
export { default as AiChat } from './components/AiChat.vue'
export { default as AiChatProvider } from './components/AiChatProvider.vue'
export { default as LayoutShell } from './components/LayoutShell.vue'
export { default as Sidebar } from './components/Sidebar.vue'
export { default as ChatMessageList } from './components/ChatMessageList.vue'
import _ChatMessageComponent from './components/ChatMessage.vue'
export { _ChatMessageComponent as ChatMessageComponent }
export { default as ChatInput } from './components/ChatInput.vue'
export { default as ModelSelector } from './components/ModelSelector.vue'
export { default as ModelManager } from './components/ModelManager.vue'
export { default as AgentSelector } from './components/AgentSelector.vue'

// === Types ===
export type {
  MessageRole,
  ChatMessage,
  Conversation,
  ModelConfig,
  AgentDefinition,
  AgentRunner,
  ChatOptions,
  ChatChunk,
  SubAgentExecution,
  SubAgentLogEntry,
  SubAgentCallInfo,
  FileUploadService,
  FileUploadProgressEvent,
  FileUploadOptions,
  UploadedFile,
  AttachmentType,
  MessageAttachment,
  ChatEventType,
} from './types'

export {
  getAttachmentType,
  isMessageAttachment,
  isLegacyFileMetadata,
} from './types'

// === Composables ===
export { useChat } from './composables/useChat'
export { useSession } from './composables/useSession'
export { useModel } from './composables/useModel'
export { useLocale } from './composables/useLocale'
export { useAgent } from './composables/useAgent'
export { useObservable } from './composables/useObservable'

// === Agents ===
import { agentRegistry, registerAgent, ensureDefaultAgent } from './services/agent'

export type { ToolDefinition, SkillDefinition, MCPServerConfig, MCPTransportType } from './types'
export { TitleGenerator } from './agents/title-generator'
export { DeepAgentRunner } from './agents/deep-agent-runner'
export { agentRegistry, registerAgent, ensureDefaultAgent }

// === Locales ===
export { zhCn, en, ja } from './locales'
export type { AiChatLocale, LocaleName } from './locales'

// === Plugin ===
import type { App } from 'vue'
import AiChat from './components/AiChat.vue'

export const AiChatPlugin = {
  install(app: App) {
    app.component('AiChat', AiChat)
  },
}
