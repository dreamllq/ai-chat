import { ref, computed, watch } from 'vue'
import { useObservable } from './useObservable'
import { AgentService } from '../services/database'
import { agentRegistry, ensureDefaultAgent, DEFAULT_AGENT_ID } from '../services/agent'
import type { AgentDefinition } from '../types'

const STORAGE_KEY = 'ai-chat:selected-agent-id'

const currentAgentId = ref<string>(DEFAULT_AGENT_ID)
let agentConfig: { defaultAgentId?: string; showAgentSelector: boolean } = { showAgentSelector: true }

try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) currentAgentId.value = saved
} catch {}

export function _resetAgentState() {
  currentAgentId.value = DEFAULT_AGENT_ID
  agentConfig = { showAgentSelector: true }
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function useAgent() {
  const agentService = new AgentService()
  const agents = useObservable<AgentDefinition[]>(() => agentService.getAll())

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
    allAgents.value.find((a) => a.id === currentAgentId.value),
  )

  function resolveDefaultAgent(loaded: AgentDefinition[]): void {
    if (loaded.length === 0) return

    if (!agentConfig.showAgentSelector) {
      const targetId = agentConfig.defaultAgentId && loaded.some(a => a.id === agentConfig.defaultAgentId)
        ? agentConfig.defaultAgentId
        : loaded[0].id
      currentAgentId.value = targetId
      try { localStorage.setItem(STORAGE_KEY, targetId) } catch {}
      return
    }

    const exists = loaded.some(a => a.id === currentAgentId.value)
    if (exists) return

    if (agentConfig.defaultAgentId && loaded.some(a => a.id === agentConfig.defaultAgentId)) {
      currentAgentId.value = agentConfig.defaultAgentId
      try { localStorage.setItem(STORAGE_KEY, agentConfig.defaultAgentId) } catch {}
      return
    }

    const firstId = loaded[0].id
    currentAgentId.value = firstId
    try { localStorage.setItem(STORAGE_KEY, firstId) } catch {}
  }

  watch(allAgents, (loaded) => {
    resolveDefaultAgent(loaded)
  })

  function selectAgent(id: string): void {
    currentAgentId.value = id
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {}
  }

  async function initDefault(options?: {
    defaultAgentId?: string
    showAgentSelector?: boolean
  }): Promise<void> {
    if (options) {
      agentConfig = {
        defaultAgentId: options.defaultAgentId,
        showAgentSelector: options.showAgentSelector ?? true,
      }
    }
    resolveDefaultAgent(allAgents.value ?? [])
  }

  return {
    agents: allAgents,
    currentAgentId,
    currentAgent,
    selectAgent,
    initDefault,
  }
}
