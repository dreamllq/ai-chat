import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useSession } from '../useSession'
import { ConversationService, MessageService } from '../../services/database'
import { db } from '../../database/db'

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T
  const App = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  const wrapper = mount(App)
  return { result, unmount: () => wrapper.unmount() }
}

// Helper to wait for Dexie liveQuery to propagate
async function flushLiveQuery(): Promise<void> {
  await vi.waitFor(() => {}, { timeout: 200 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 50))
  await nextTick()
}

describe('useSession', () => {
  let session: ReturnType<typeof useSession>
  let unmount: () => void
  let conversationService: ConversationService
  let messageService: MessageService

  beforeEach(async () => {
    // Clear IndexedDB tables before each test
    await db.conversations.clear()
    await db.messages.clear()

    const setup = withSetup(useSession)
    session = setup.result
    unmount = setup.unmount
    conversationService = new ConversationService()
    messageService = new MessageService()
    await flushLiveQuery()
  })

  it('starts with empty conversations and null currentConversationId', () => {
    expect(session.conversations.value ?? []).toEqual([])
    expect(session.currentConversationId.value).toBeNull()
    expect(session.currentConversation.value).toBeUndefined()
  })

  it('createConversation creates and auto-switches to it', async () => {
    const conv = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()

    expect(conv).toBeDefined()
    expect(conv.title).toBe('New Chat')
    expect(conv.agentId).toBe('agent-1')
    expect(conv.modelId).toBe('model-1')
    expect(session.currentConversationId.value).toBe(conv.id)
    expect(session.currentConversation.value?.id).toBe(conv.id)
  })

  it('conversations ref updates after createConversation', async () => {
    await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()

    expect(session.conversations.value).toHaveLength(1)
    expect(session.conversations.value![0].title).toBe('New Chat')
  })

  it('switchConversation changes currentConversationId', async () => {
    const conv1 = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()
    await messageService.create({ conversationId: conv1.id, role: 'user', content: 'hi' })
    await flushLiveQuery()
    const conv2 = await session.createConversation('agent-2', 'model-2')
    await flushLiveQuery()

    // Current should be conv2 (auto-switched)
    expect(session.currentConversationId.value).toBe(conv2.id)

    session.switchConversation(conv1.id)
    expect(session.currentConversationId.value).toBe(conv1.id)
    await flushLiveQuery()
    expect(session.currentConversation.value?.id).toBe(conv1.id)
  })

  it('renameConversation updates title', async () => {
    const conv = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()

    await session.renameConversation(conv.id, 'My Custom Title')
    await flushLiveQuery()

    expect(session.currentConversation.value?.title).toBe('My Custom Title')
  })

  it('currentMessages returns messages for current conversation only (isolation)', async () => {
    const conv1 = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()
    await messageService.create({
      conversationId: conv1.id,
      role: 'user',
      content: 'Hello from conv1',
    })
    await flushLiveQuery()

    const conv2 = await session.createConversation('agent-2', 'model-2')
    await flushLiveQuery()
    await messageService.create({
      conversationId: conv2.id,
      role: 'user',
      content: 'Hello from conv2',
    })
    await messageService.create({
      conversationId: conv2.id,
      role: 'assistant',
      content: 'Response from conv2',
    })
    await flushLiveQuery()

    // Switch to conv2 (should already be current, but be explicit)
    session.switchConversation(conv2.id)
    await flushLiveQuery()

    // Should only see conv2's messages
    const msgs = session.currentMessages.value!
    expect(msgs).toHaveLength(2)
    expect(msgs.every((m) => m.conversationId === conv2.id)).toBe(true)

    // Switch to conv1 and verify isolation
    session.switchConversation(conv1.id)
    await flushLiveQuery()

    const msgs1 = session.currentMessages.value!
    expect(msgs1).toHaveLength(1)
    expect(msgs1[0].content).toBe('Hello from conv1')
  })

  it('switching conversation updates currentMessages', async () => {
    const conv1 = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()
    await messageService.create({
      conversationId: conv1.id,
      role: 'user',
      content: 'Msg in conv1',
    })
    await flushLiveQuery()

    const conv2 = await session.createConversation('agent-2', 'model-2')
    await flushLiveQuery()
    await messageService.create({
      conversationId: conv2.id,
      role: 'assistant',
      content: 'Msg in conv2',
    })
    await flushLiveQuery()

    // Currently on conv2
    expect(session.currentMessages.value).toHaveLength(1)
    expect(session.currentMessages.value![0].content).toBe('Msg in conv2')

    // Switch to conv1
    session.switchConversation(conv1.id)
    await flushLiveQuery()

    expect(session.currentMessages.value).toHaveLength(1)
    expect(session.currentMessages.value![0].content).toBe('Msg in conv1')
  })

  it('deleteConversation removes it and auto-switches to adjacent', async () => {
    const conv1 = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()
    await messageService.create({
      conversationId: conv1.id,
      role: 'user',
      content: 'Conv1 message',
    })
    await flushLiveQuery()
    const conv2 = await session.createConversation('agent-2', 'model-2')
    await flushLiveQuery()
    // Add messages to conv2
    await messageService.create({
      conversationId: conv2.id,
      role: 'user',
      content: 'Will be deleted',
    })
    await flushLiveQuery()

    // Currently on conv2
    expect(session.currentConversationId.value).toBe(conv2.id)

    // Delete conv2 (current), should auto-switch
    await session.deleteConversation(conv2.id)
    await flushLiveQuery()

    expect(session.conversations.value).toHaveLength(1)
    expect(session.conversations.value![0].id).toBe(conv1.id)
    expect(session.currentConversationId.value).toBe(conv1.id)
  })

  it('deleting the last conversation leaves empty state', async () => {
    const conv = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()

    expect(session.conversations.value).toHaveLength(1)

    await session.deleteConversation(conv.id)
    await flushLiveQuery()

    expect(session.conversations.value ?? []).toHaveLength(0)
    expect(session.currentConversationId.value).toBeNull()
    expect(session.currentMessages.value ?? []).toEqual([])
  })

  it('empty state — currentMessages returns empty when no conversation selected', () => {
    expect(session.currentMessages.value ?? []).toEqual([])
    expect(session.currentConversation.value).toBeUndefined()
  })

  it('messageCount is incremented when a message is created', async () => {
    const conv = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()
    expect(conv.messageCount).toBeUndefined()

    await messageService.create({ conversationId: conv.id, role: 'user', content: 'hello' })
    await flushLiveQuery()

    const updated = session.conversations.value!.find(c => c.id === conv.id)
    expect(updated?.messageCount).toBe(1)

    await messageService.create({ conversationId: conv.id, role: 'assistant', content: 'hi' })
    await flushLiveQuery()

    const updated2 = session.conversations.value!.find(c => c.id === conv.id)
    expect(updated2?.messageCount).toBe(2)
  })

  it('createConversation reuses existing empty conversation instead of creating new', async () => {
    const conv1 = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()
    await messageService.create({ conversationId: conv1.id, role: 'user', content: 'hi' })
    await flushLiveQuery()

    const conv2 = await session.createConversation('agent-2', 'model-2')
    await flushLiveQuery()
    expect(conv2.id).not.toBe(conv1.id)

    const result = await session.createConversation('agent-3', 'model-3')
    await flushLiveQuery()

    expect(result.id).toBe(conv2.id)
    expect(session.conversations.value).toHaveLength(2)
  })

  it('createConversation creates new when all conversations have messages', async () => {
    const conv1 = await session.createConversation('agent-1', 'model-1')
    await flushLiveQuery()
    await messageService.create({ conversationId: conv1.id, role: 'user', content: 'hi' })
    await flushLiveQuery()

    const conv2 = await session.createConversation('agent-2', 'model-2')
    await flushLiveQuery()

    expect(conv2.id).not.toBe(conv1.id)
    expect(session.conversations.value).toHaveLength(2)
    expect(session.currentConversationId.value).toBe(conv2.id)
  })
})
