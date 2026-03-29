export interface AiChatLocale {
  conversation: {
    newChat: string
    deleteConfirm: string
    rename: string
    empty: string
  }
  chat: {
    placeholder: string
    send: string
    stop: string
    streaming: string
    resend: string
    copyCode: string
    copySuccess: string
  }
  model: {
    title: string
    create: string
    delete: string
    deleteConfirm: string
    endpoint: string
    apiKey: string
    modelName: string
    selectModel: string
    name: string
    provider: string
    temperature: string
    maxTokens: string
    addNew: string
    emptyList: string
  }
  agent: {
    title: string
    select: string
    builtin: string
    custom: string
  }
  upload: {
    button: string
    dragHere: string
  }
  error: {
    network: string
    apiKey: string
    streamInterrupted: string
    retry: string
    agentNotFound: string
    modelNotSelected: string
  }
}

export const en: AiChatLocale = {
  conversation: {
    newChat: 'New Chat',
    deleteConfirm: 'Are you sure you want to delete this conversation?',
    rename: 'Rename',
    empty: 'No conversations yet',
  },
  chat: {
    placeholder: 'Type a message...',
    send: 'Send',
    stop: 'Stop',
    streaming: 'AI is thinking...',
    resend: 'Resend',
    copyCode: 'Copy Code',
    copySuccess: 'Copied!',
  },
  model: {
    title: 'Model Management',
    create: 'Create Model',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this model?',
    endpoint: 'API Endpoint',
    apiKey: 'API Key',
    modelName: 'Model Name',
    selectModel: 'Select Model',
    name: 'Display Name',
    provider: 'Provider',
    temperature: 'Temperature',
    maxTokens: 'Max Tokens',
    addNew: 'Add Model',
    emptyList: 'No models configured',
  },
  agent: {
    title: 'Agent',
    select: 'Select Agent',
    builtin: 'Built-in',
    custom: 'Custom',
  },
  upload: {
    button: 'Upload File',
    dragHere: 'Drag files here',
  },
  error: {
    network: 'Network error. Please check your connection.',
    apiKey: 'Invalid API Key. Please check your model configuration.',
    streamInterrupted: 'Stream was interrupted.',
    retry: 'Retry',
    agentNotFound: 'Agent not found.',
    modelNotSelected: 'Please select a model first.',
  },
}
