import { ref, computed, watch, type Ref } from 'vue'
import { useObservable } from './useObservable'
import { AgentService } from '../services/database'
import { agentRegistry, ensureDefaultAgent, DEFAULT_AGENT_ID } from '../services/agent'
import type { AgentDefinition } from '../types'

interface AgentState {
  currentAgentId: Ref<string>
  agentConfig: { defaultAgentId?: string; showAgentSelector: boolean }
}

const agentStates = new Map<string, AgentState>()

function getStorageKey(chatId: string): string {
  return `ai-chat:${chatId}:selected-agent-id`
}

function getOrCreateState(chatId: string): AgentState {
  let state = agentStates.get(chatId)
  if (state) return state

  const currentAgentId = ref<string>(DEFAULT_AGENT_ID)
  const agentConfig = { showAgentSelector: true }

  try {
    const saved = localStorage.getItem(getStorageKey(chatId))
    if (saved) currentAgentId.value = saved
  } catch {}

  state = { currentAgentId, agentConfig }
  agentStates.set(chatId, state)
  return state
}

export function _resetAgentState(): void {
  agentStates.clear()
}

export function useAgent(chatId = 'default') {
  const state = getOrCreateState(chatId)
  const agentService = new AgentService()
  const agents = useObservable<AgentDefinition[]>(() => agentService.getAll(chatId))

  // Merge registry definitions (includes runtime-registered agents not in DB)
  const allAgents = computed(() => {
    // Depend on version so runtime register/unregister triggers re-computation
    void agentRegistry.version.value

    ensureDefaultAgent()

    const registryDefs = agentRegistry.getAllDefinitions()
    const dbAgents = agents.value ?? []
    const dbIds = new Set(dbAgents.map((a) => a.id))
    // DB agents take precedence, then append registry-only agents
    const merged = [...dbAgents]
    for (const def of registryDefs) {
      if (!dbIds.has(def.id)) merged.push(def)
    }
    return merged
  })

  const currentAgent = computed(() =>
    allAgents.value.find((a) => a.id === state.currentAgentId.value),
  )

  function resolveDefaultAgent(loaded: AgentDefinition[]): void {
    if (loaded.length === 0) return

    if (!state.agentConfig.showAgentSelector) {
      const targetId = state.agentConfig.defaultAgentId && loaded.some(a => a.id === state.agentConfig.defaultAgentId)
        ? state.agentConfig.defaultAgentId
        : loaded[0].id
      state.currentAgentId.value = targetId
      try { localStorage.setItem(getStorageKey(chatId), targetId) } catch {}
      return
    }

    const exists = loaded.some(a => a.id === state.currentAgentId.value)
    if (exists) return

    if (state.agentConfig.defaultAgentId && loaded.some(a => a.id === state.agentConfig.defaultAgentId)) {
      state.currentAgentId.value = state.agentConfig.defaultAgentId
      try { localStorage.setItem(getStorageKey(chatId), state.agentConfig.defaultAgentId) } catch {}
      return
    }

    const firstId = loaded[0].id
    state.currentAgentId.value = firstId
    try { localStorage.setItem(getStorageKey(chatId), firstId) } catch {}
  }

  watch(allAgents, (loaded) => {
    resolveDefaultAgent(loaded)
  })

  function selectAgent(id: string): void {
    state.currentAgentId.value = id
    try {
      localStorage.setItem(getStorageKey(chatId), id)
    } catch {}
  }

  async function initDefault(options?: {
    defaultAgentId?: string
    showAgentSelector?: boolean
  }): Promise<void> {
    if (options) {
      state.agentConfig = {
        defaultAgentId: options.defaultAgentId,
        showAgentSelector: options.showAgentSelector ?? true,
      }
    }
    resolveDefaultAgent(allAgents.value ?? [])
  }

  return {
    agents: allAgents,
    currentAgentId: state.currentAgentId,
    currentAgent,
    selectAgent,
    initDefault,
  }
}
