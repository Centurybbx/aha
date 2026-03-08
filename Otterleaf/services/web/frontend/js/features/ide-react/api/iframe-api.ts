import { debugConsole } from '@/utils/debugging'

// 定义 iframe API 消息类型
export interface IframeApiMessage {
  type: 'apiCall'
  api: string
  method: string
  params: any[]
  callId: string
}

export interface IframeApiResponse {
  type: 'apiResponse'
  callId: string
  success: boolean
  result?: any
  error?: string
}

// 允许的源列表
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
  'http://localhost',
]

// 检查源是否被允许
function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin)
}

// 生成唯一调用ID
function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 处理 API 调用
async function handleApiCall(
  message: IframeApiMessage
): Promise<IframeApiResponse> {
  const { api, method, params, callId } = message

  try {
    // 检查 overleafEditorApi 是否存在
    if (!window.overleafEditorApi) {
      throw new Error('overleafEditorApi not available')
    }

    // 支持 editor 和 project API（除了创建项目功能）
    if (api !== 'editor' && api !== 'project') {
      throw new Error(
        `API '${api}' not supported. Only 'editor' and 'project' APIs are available`
      )
    }

    // 检查方法是否存在
    if (typeof (window.overleafEditorApi as any)[method] !== 'function') {
      throw new Error(`Method '${method}' not found in overleafEditorApi`)
    }

    // 调用 API 方法
    const result = await (window.overleafEditorApi as any)[method](...params)

    return {
      type: 'apiResponse',
      callId,
      success: true,
      result,
    }
  } catch (error) {
    debugConsole.error('Iframe API call failed:', error)

    return {
      type: 'apiResponse',
      callId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// 消息事件处理器
function handleMessage(event: MessageEvent) {
  // 检查源是否被允许
  if (!isAllowedOrigin(event.origin)) {
    debugConsole.warn(
      'Rejected message from unauthorized origin:',
      event.origin
    )
    return
  }

  const message = event.data as IframeApiMessage

  // 验证消息格式
  if (!message || message.type !== 'apiCall') {
    debugConsole.warn('Invalid message format:', message)
    return
  }

  // 处理 API 调用
  handleApiCall(message)
    .then(response => {
      // 发送响应回父窗口
      event.source?.postMessage(response, { targetOrigin: event.origin })
    })
    .catch(error => {
      // 发送错误响应
      const errorResponse: IframeApiResponse = {
        type: 'apiResponse',
        callId: message.callId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
      event.source?.postMessage(errorResponse, { targetOrigin: event.origin })
    })
}

// 初始化 iframe API
export function initializeIframeApi() {
  // 检查是否已经初始化
  if (window.iframeApiInitialized) {
    debugConsole.warn('Iframe API already initialized')
    return
  }

  // 检查 overleafEditorApi 是否可用
  if (!window.overleafEditorApi) {
    debugConsole.warn(
      'overleafEditorApi not available, iframe API will not work'
    )
    return
  }

  // 添加消息监听器
  window.addEventListener('message', handleMessage)

  // 标记为已初始化
  window.iframeApiInitialized = true

  debugConsole.log('Iframe API initialized for origins:', ALLOWED_ORIGINS)
  debugConsole.log(
    'Available API methods:',
    Object.keys(window.overleafEditorApi)
  )
}

// 清理 iframe API
export function cleanupIframeApi() {
  if (window.iframeApiInitialized) {
    window.removeEventListener('message', handleMessage)
    delete window.iframeApiInitialized
    debugConsole.log('Iframe API cleaned up')
  }
}

// 扩展全局 Window 接口
declare global {
  interface Window {
    iframeApiInitialized?: boolean
  }
}

// 便捷方法：发送消息到父窗口
export function postMessageToParent(message: any, targetOrigin: string = '*') {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, { targetOrigin })
  }
}

// 便捷方法：监听来自父窗口的响应
export function listenForResponse(
  callId: string,
  callback: (response: IframeApiResponse) => void,
  timeout: number = 10000
): () => void {
  const handleResponse = (event: MessageEvent) => {
    const response = event.data as IframeApiResponse
    if (response.type === 'apiResponse' && response.callId === callId) {
      callback(response)
      window.removeEventListener('message', handleResponse)
    }
  }

  window.addEventListener('message', handleResponse)

  // 设置超时
  const timeoutId = setTimeout(() => {
    window.removeEventListener('message', handleResponse)
    callback({
      type: 'apiResponse',
      callId,
      success: false,
      error: 'Request timeout',
    })
  }, timeout)

  // 返回清理函数
  return () => {
    clearTimeout(timeoutId)
    window.removeEventListener('message', handleResponse)
  }
}

// 便捷方法：调用父窗口的 API
export function callParentApi(
  api: string,
  method: string,
  params: any[] = []
): Promise<any> {
  return new Promise((resolve, reject) => {
    const callId = generateCallId()

    // 监听响应
    const cleanup = listenForResponse(callId, response => {
      if (response.success) {
        resolve(response.result)
      } else {
        reject(new Error(response.error || 'Unknown error'))
      }
    })

    // 发送 API 调用
    const message: IframeApiMessage = {
      type: 'apiCall',
      api,
      method,
      params,
      callId,
    }

    postMessageToParent(message)
  })
}
