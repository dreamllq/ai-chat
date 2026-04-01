import { describe, expectTypeOf, test } from 'vitest'
import type {
  ChatChunk,
  ChatEventType,
  ChatMessage,
  ChatOptions,
  Conversation,
  MessageRole,
  ModelConfig,
  AgentDefinition,
  AgentRunner,
  FileUploadService,
  UploadedFile,
} from '../index'

describe('Core Types', () => {
  test('MessageRole accepts valid values', () => {
    const roles: MessageRole[] = ['user', 'assistant', 'system']
    expectTypeOf(roles).toEqualTypeOf<MessageRole[]>()
  })

  test('ChatMessage has required fields', () => {
    const msg: ChatMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    }
    expectTypeOf(msg).toMatchTypeOf<ChatMessage>()
    expectTypeOf(msg.id).toBeString()
    expectTypeOf(msg.conversationId).toBeString()
    expectTypeOf(msg.role).toEqualTypeOf<MessageRole>()
    expectTypeOf(msg.content).toBeString()
    expectTypeOf(msg.timestamp).toBeNumber()
  })

  test('ChatMessage supports optional fields', () => {
    const msg: ChatMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Hi',
      timestamp: Date.now(),
      isStreaming: true,
      metadata: { model: 'gpt-4' },
    }
    expectTypeOf(msg.isStreaming).toEqualTypeOf<boolean | undefined>()
    expectTypeOf(msg.metadata).toEqualTypeOf<Record<string, unknown> | undefined>()
  })

  test('Conversation has all required fields', () => {
    const conv: Conversation = {
      id: 'conv-1',
      title: 'Test',
      agentId: 'agent-1',
      modelId: 'model-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    expectTypeOf(conv).toMatchTypeOf<Conversation>()
  })

  test('ModelConfig has all required fields', () => {
    const model: ModelConfig = {
      id: 'model-1',
      name: 'GPT-4',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'sk-xxx',
      modelName: 'gpt-4',
      createdAt: Date.now(),
    }
    expectTypeOf(model).toMatchTypeOf<ModelConfig>()
    expectTypeOf(model.temperature).toEqualTypeOf<number | undefined>()
    expectTypeOf(model.maxTokens).toEqualTypeOf<number | undefined>()
  })

  test('AgentDefinition has required and optional fields', () => {
    const agent: AgentDefinition = {
      id: 'agent-1',
      name: 'Default',
    }
    expectTypeOf(agent).toMatchTypeOf<AgentDefinition>()
    expectTypeOf(agent.description).toEqualTypeOf<string | undefined>()
    expectTypeOf(agent.avatar).toEqualTypeOf<string | undefined>()
    expectTypeOf(agent.systemPrompt).toEqualTypeOf<string | undefined>()
    expectTypeOf(agent.isBuiltin).toEqualTypeOf<boolean | undefined>()
  })

  test('ChatChunk type covers token/done/error cases', () => {
    const tokenChunk: ChatChunk = { type: 'token', content: 'Hello' }
    const doneChunk: ChatChunk = { type: 'done' }
    const errorChunk: ChatChunk = { type: 'error', error: 'Something failed' }

    const chunks: ChatChunk[] = [tokenChunk, doneChunk, errorChunk]
    expectTypeOf(chunks[0].type).toEqualTypeOf<'token' | 'done' | 'error' | 'sub_agent_start' | 'sub_agent_log' | 'sub_agent_end'>()

    for (const chunk of chunks) {
      expectTypeOf(chunk.type).toEqualTypeOf<'token' | 'done' | 'error' | 'sub_agent_start' | 'sub_agent_log' | 'sub_agent_end'>()
    }
  })

  test('ChatOptions has all optional fields', () => {
    const opts: ChatOptions = {
      systemPrompt: 'You are helpful',
      temperature: 0.7,
      maxTokens: 4096,
      onToken: (_token: string) => {},
    }
    expectTypeOf(opts).toMatchTypeOf<ChatOptions>()
    expectTypeOf(opts.signal).toEqualTypeOf<AbortSignal | undefined>()
  })

  test('AgentRunner.chat returns AsyncGenerator', () => {
    const runner: AgentRunner = {
      async *chat() {
        yield { type: 'token' as const, content: 'hi' }
      },
    }
    expectTypeOf(runner.chat).toBeCallableWith([], {
      id: '',
      name: '',
      provider: '',
      endpoint: '',
      apiKey: '',
      modelName: '',
      createdAt: 0,
    })
  })

  test('FileUploadService and UploadedFile types', () => {
    const file: UploadedFile = {
      id: 'f-1',
      name: 'test.pdf',
      url: 'https://example.com/test.pdf',
      size: 1024,
      mimeType: 'application/pdf',
    }
    expectTypeOf(file).toMatchTypeOf<UploadedFile>()
  })

  test('ChatEventType covers all event names', () => {
    const events: ChatEventType[] = [
      'message:sent',
      'message:streaming',
      'message:complete',
      'message:error',
      'conversation:created',
      'conversation:deleted',
      'model:changed',
      'agent:changed',
    ]
    expectTypeOf(events).toEqualTypeOf<ChatEventType[]>()
  })
})
