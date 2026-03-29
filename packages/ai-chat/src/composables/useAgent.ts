import { ref, computed, watch } from 'vue'
import { useObservable } from './useObservable'
import { AgentService } from '../services/database'
import { agentRegistry } from '../services/agent'
import type { AgentDefinition } from '../types'

const STORAGE_KEY = 'ai-chat:selected-agent-id'

// Module-level singleton — shared across all useAgent() callers
const currentAgentId = ref<string>('langchain-chat')

// Restore persisted selection on module load
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) currentAgentId.value = saved
} catch {}

/** Reset singleton state (for testing) */
export function _resetAgentState() {
  currentAgentId.value = 'langchain-chat'
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

  // Validate persisted selection against loaded agents
  watch(allAgents, (loaded) => {
    if (currentAgentId.value && loaded.length > 0) {
      const exists = loaded.some((a) => a.id === currentAgentId.value)
      if (!exists) {
        // Saved agent no longer exists — fall back to first available
        const firstId = loaded[0].id
        currentAgentId.value = firstId
        try {
          localStorage.setItem(STORAGE_KEY, firstId)
        } catch {}
      }
    }
  })

  function selectAgent(id: string): void {
    currentAgentId.value = id
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {}
  }

  async function initDefault(): Promise<void> {
    // Only set default if no valid selection exists
    const loaded = allAgents.value
    if (loaded.length > 0) {
      const exists = loaded.some((a) => a.id === currentAgentId.value)
      if (!exists) {
        const firstId = loaded[0].id
        currentAgentId.value = firstId
        try {
          localStorage.setItem(STORAGE_KEY, firstId)
        } catch {}
      }
    }
  }

  return {
    agents: allAgents,
    currentAgentId,
    currentAgent,
    selectAgent,
    initDefault,
  }
}
