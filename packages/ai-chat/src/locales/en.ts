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
    thinking: string
    thinkingToggle: string
    tokenUsage: string
    promptTokens: string
    completionTokens: string
    totalTokens: string
  }
  model: {
    title: string
    create: string
    delete: string
    deleteConfirm: string
    endpoint: string
    apiKey: string
    apiKeyPlaceholder: string
    modelName: string
    selectModel: string
    name: string
    provider: string
    temperature: string
    maxTokens: string
    addNew: string
    manage: string
    emptyList: string
    builtin: string
    save: string
    cancel: string
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
  attachment: {
    uploading: string
    uploadFailed: string
    image: string
    document: string
    audio: string
    video: string
    download: string
    fileTooLarge: string
    unsupportedPreview: string
    removeFile: string
  }
  error: {
    network: string
    apiKey: string
    streamInterrupted: string
    retry: string
    agentNotFound: string
    modelNotSelected: string
  }
  timeAgo: {
    justNow: string
    secondsAgo: string
    minutesAgo: string
    hoursAgo: string
    yesterday: string
    dateFormat: string
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
    thinking: 'Thinking',
    thinkingToggle: 'Click to expand',
    tokenUsage: 'Tokens',
    promptTokens: 'Input',
    completionTokens: 'Output',
    totalTokens: 'Total',
  },
  model: {
    title: 'Model Management',
    create: 'Create Model',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this model?',
    endpoint: 'API Endpoint',
    apiKey: 'API Key',
    apiKeyPlaceholder: 'Enter your API key to start using this model',
    modelName: 'Model Name',
    selectModel: 'Select Model',
    name: 'Display Name',
    provider: 'Provider',
    temperature: 'Temperature',
    maxTokens: 'Max Tokens',
    addNew: 'Add Model',
    manage: 'Model Management',
    emptyList: 'No models configured',
    builtin: 'Built-in',
    save: 'Save',
    cancel: 'Cancel',
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
  attachment: {
    uploading: 'Uploading...',
    uploadFailed: 'Upload failed',
    image: 'Image',
    document: 'Document',
    audio: 'Audio',
    video: 'Video',
    download: 'Download',
    fileTooLarge: 'File too large',
    unsupportedPreview: 'Preview not available',
    removeFile: 'Remove',
  },
  error: {
    network: 'Network error. Please check your connection.',
    apiKey: 'Invalid API Key. Please check your model configuration.',
    streamInterrupted: 'Stream was interrupted.',
    retry: 'Retry',
    agentNotFound: 'Agent not found.',
    modelNotSelected: 'Please select a model first.',
  },
  timeAgo: {
    justNow: 'just now',
    secondsAgo: '{n} seconds ago',
    minutesAgo: '{n} minutes ago',
    hoursAgo: '{n} hours ago',
    yesterday: 'yesterday',
    dateFormat: '{month}/{day} {hours}:{minutes}',
  },
}
