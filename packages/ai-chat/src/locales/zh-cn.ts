import type { AiChatLocale } from './en'

export const zhCn: AiChatLocale = {
  conversation: {
    newChat: '新对话',
    deleteConfirm: '确定要删除这个对话吗？',
    rename: '重命名',
    empty: '暂无对话',
  },
  chat: {
    placeholder: '输入消息...',
    send: '发送',
    stop: '停止',
    streaming: 'AI 正在思考...',
    resend: '重新发送',
    copyCode: '复制代码',
    copySuccess: '已复制！',
  },
  model: {
    title: '模型管理',
    create: '创建模型',
    delete: '删除',
    deleteConfirm: '确定要删除此模型吗？',
    endpoint: 'API 地址',
    apiKey: 'API 密钥',
    modelName: '模型名称',
    selectModel: '选择模型',
    name: '显示名称',
    provider: '提供商',
    temperature: '温度',
    maxTokens: '最大令牌数',
    addNew: '添加模型',
    manage: '模型管理',
    emptyList: '暂无模型配置',
  },
  agent: {
    title: '智能体',
    select: '选择智能体',
    builtin: '内置',
    custom: '自定义',
  },
  upload: {
    button: '上传文件',
    dragHere: '拖拽文件到此处',
  },
  error: {
    network: '网络错误，请检查网络连接。',
    apiKey: 'API 密钥无效，请检查模型配置。',
    streamInterrupted: '流式传输已中断。',
    retry: '重试',
    agentNotFound: '未找到智能体。',
    modelNotSelected: '请先选择一个模型。',
  },
}
