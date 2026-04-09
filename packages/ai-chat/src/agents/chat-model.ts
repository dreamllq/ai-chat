import { ChatOpenAICompletions } from '@langchain/openai'
import type { RequestInterceptor } from '../types'

type DeltaChunkParams = Parameters<ChatOpenAICompletions['_convertCompletionsDeltaToBaseMessageChunk']>
type DeltaChunkReturn = ReturnType<ChatOpenAICompletions['_convertCompletionsDeltaToBaseMessageChunk']>
type MessageConvertParams = Parameters<ChatOpenAICompletions['_convertCompletionsMessageToBaseMessage']>
type MessageConvertReturn = ReturnType<ChatOpenAICompletions['_convertCompletionsMessageToBaseMessage']>

export interface EnhancedChatModelFields {
  requestInterceptor?: RequestInterceptor
}

function createInterceptedFetch(interceptor: RequestInterceptor): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'POST'

    const headers: Record<string, string> = {}
    if (init?.headers) {
      const hdrs = init.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : Array.isArray(init.headers)
          ? Object.fromEntries(init.headers as [string, string][])
          : (init.headers as Record<string, string>)
      Object.assign(headers, hdrs)
    }

    let body: unknown
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string)
      } catch {
        body = String(init.body)
      }
    }

    const ctx = await interceptor({ url, method, headers, body })

    const newHeaders = new Headers(init?.headers)
    for (const [k, v] of Object.entries(ctx.headers)) {
      newHeaders.set(k, v)
    }

    return globalThis.fetch(ctx.url, { ...init, method: ctx.method, headers: newHeaders })
  }
}

export class EnhancedChatModel extends ChatOpenAICompletions {
  constructor(
    fields: ConstructorParameters<typeof ChatOpenAICompletions>[0] & EnhancedChatModelFields,
  ) {
    const { requestInterceptor, ...chatFields } = fields

    if (requestInterceptor) {
      const config = (chatFields as Record<string, unknown>).configuration as
        | Record<string, unknown>
        | undefined
      ;(chatFields as Record<string, unknown>).configuration = {
        ...config,
        fetch: createInterceptedFetch(requestInterceptor),
      }
    }

    super(chatFields as ConstructorParameters<typeof ChatOpenAICompletions>[0])
  }

  protected override _convertCompletionsDeltaToBaseMessageChunk(
    delta: DeltaChunkParams[0],
    rawResponse: DeltaChunkParams[1],
    defaultRole?: DeltaChunkParams[2],
  ): DeltaChunkReturn {
    const messageChunk = super._convertCompletionsDeltaToBaseMessageChunk(
      delta,
      rawResponse,
      defaultRole,
    )

    if (delta.reasoning_content != null) {
      messageChunk.additional_kwargs.reasoning_content = delta.reasoning_content
    }

    return messageChunk
  }

  protected override _convertCompletionsMessageToBaseMessage(
    message: MessageConvertParams[0],
    rawResponse: MessageConvertParams[1],
  ): MessageConvertReturn {
    const langChainMessage = super._convertCompletionsMessageToBaseMessage(
      message,
      rawResponse,
    )

    const rc = (message as { reasoning_content?: unknown }).reasoning_content
    if (rc != null) {
      langChainMessage.additional_kwargs.reasoning_content = rc
    }

    return langChainMessage
  }
}
