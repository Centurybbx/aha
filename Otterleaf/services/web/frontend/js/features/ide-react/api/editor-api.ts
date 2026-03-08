import { EditorView } from '@codemirror/view'
import { debugConsole } from '@/utils/debugging'
import { DiffEntry } from '../context/suggested-changes-context'
import getMeta from '@/utils/meta'
import { findEntityByPath } from '@/features/file-tree/util/path'
import type { Folder } from '../../../../../types/folder'

// 全局变量存储文件树数据
let globalFileTreeData: Folder | null = null

// 设置文件树数据的函数（由外部调用）
export function setFileTreeData(fileTreeData: Folder | null) {
  globalFileTreeData = fileTreeData
}

// 获取文件树数据的函数
function getFileTreeData(): Folder | null {
  // 首先尝试从全局变量获取
  if (globalFileTreeData) {
    return globalFileTreeData
  }

  // 尝试从window对象获取（如果其他地方设置了）
  try {
    const windowData = (window as any).fileTreeData
    if (windowData) {
      return windowData
    }
  } catch (error) {
    debugConsole.warn('Could not access window.fileTreeData:', error)
  }

  return null
}

// 辅助函数：通过路径查找真正的实体ID
function findEntityIdByPath(
  fileTreeData: Folder,
  path: string
): { entityId: string; entityType: string } | null {
  if (!fileTreeData) {
    return null
  }

  try {
    const result = findEntityByPath(
      fileTreeData,
      path.startsWith('/') ? path.slice(1) : path
    )
    console.log('findEntityIdByPath', result)
    if (result) {
      return {
        entityId: result.entity._id,
        entityType: result.type,
      }
    }
    return null
  } catch (error) {
    debugConsole.warn('Could not find entity ID for path:', path, error)
    return null
  }
}

// 辅助函数：通过ID查找实体类型
function findEntityById(
  fileTreeData: Folder,
  id: string
): { entityId: string; entityType: string } | null {
  if (!fileTreeData) {
    return null
  }

  try {
    // 在文档中查找
    const doc = fileTreeData.docs.find(doc => doc._id === id)
    if (doc) {
      return {
        entityId: doc._id,
        entityType: 'doc',
      }
    }

    // 在文件引用中查找
    const fileRef = fileTreeData.fileRefs.find(fileRef => fileRef._id === id)
    if (fileRef) {
      return {
        entityId: fileRef._id,
        entityType: 'fileRef',
      }
    }

    // 在文件夹中查找
    const folder = fileTreeData.folders.find(folder => folder._id === id)
    if (folder) {
      return {
        entityId: folder._id,
        entityType: 'folder',
      }
    }

    // 递归在子文件夹中查找
    for (const subfolder of fileTreeData.folders) {
      const result = findEntityById(subfolder, id)
      if (result) {
        return result
      }
    }

    return null
  } catch (error) {
    debugConsole.warn('Could not find entity by ID:', id, error)
    return null
  }
}

// 定义API事件类型
export interface EditorApiEvents {
  'editor:getSelection': {
    requestId: string
  }
  'editor:getSelection:response': {
    requestId: string
    success: boolean
    data?: {
      from: number
      to: number
      text: string
      line: number
      column: number
    }
    error?: string
  }
  'editor:setSelection': {
    requestId: string
    from: number
    to: number
  }
  'editor:setSelection:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:replaceText': {
    requestId: string
    from: number
    to: number
    text: string
    suggestedOnly?: boolean // 新增：是否仅创建建议修改
  }
  'editor:replaceText:response': {
    requestId: string
    success: boolean
    changeId?: string // 新增：建议修改的ID
    error?: string
  }
  'editor:suggestChange': {
    requestId: string
    from: number
    to: number
    text: string
  }
  'editor:suggestChange:response': {
    requestId: string
    success: boolean
    changeId?: string
    error?: string
  }
  'editor:acceptChange': {
    requestId: string
    changeId: string
  }
  'editor:acceptChange:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:rejectChange': {
    requestId: string
    changeId: string
  }
  'editor:rejectChange:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:getDocument': {
    requestId: string
    includeChanges?: boolean // 新增：是否包含建议修改
  }
  'editor:getDocument:response': {
    requestId: string
    success: boolean
    data?: {
      content: string
      userDocument?: string // User's baseline document
      realDocument?: string // Real document with applied changes
      length: number
      diffs?: DiffEntry[] // Computed diffs
    }
    error?: string
  }
  'editor:recompile': {
    requestId: string
    options?: any
  }
  'editor:recompile:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:downloadFile': {
    requestId: string
    fileId: string
    fileName?: string
  }
  'editor:downloadFile:response': {
    requestId: string
    success: boolean
    downloadUrl?: string
    error?: string
  }
  'editor:uploadFile': {
    requestId: string
    file: File
    fileName?: string
    folderId?: string
  }
  'editor:uploadFile:response': {
    requestId: string
    success: boolean
    entityId?: string
    hash?: string
    error?: string
  }
  'project:listFiles': {
    requestId: string
  }
  'project:listFiles:response': {
    requestId: string
    success: boolean
    files?: Array<{
      id: string
      name: string
      type: 'file' | 'doc' | 'folder'
      path: string
      size?: number
      entityId?: string
      entityType?: string
      children?: Array<any>
    }>
    error?: string
  }
  'project:createFolder': {
    requestId: string
    folderName: string
    parentFolderId?: string
  }
  'project:createFolder:response': {
    requestId: string
    success: boolean
    folderId?: string
    error?: string
  }
  'project:renameFile': {
    requestId: string
    fileId: string
    newName: string
    entityType?: string
  }
  'project:renameFile:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'project:deleteFile': {
    requestId: string
    fileId: string
    entityType?: string
  }
  'project:deleteFile:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:openAiDiff': {
    requestId: string
    fileId?: string
  }
  'editor:openAiDiff:response': {
    requestId: string
    success: boolean
    error?: string
  }
  'editor:closeAiDiff': {
    requestId: string
    fileId?: string
  }
  'editor:closeAiDiff:response': {
    requestId: string
    success: boolean
    error?: string
  }
}

// 全局编辑器视图引用
let globalEditorView: EditorView | null = null

// 全局编译上下文引用
let globalCompileContext: { startCompile: (options?: any) => void } | null =
  null

// Global suggested changes context reference
let globalSuggestedChangesContext: {
  userDocument: string
  diffs: DiffEntry[]
  acceptChange: (changeId: string) => void
  revertChange: (changeId: string) => void
  setUserDocument: (content: string) => void
  setRealDocument: (content: string) => void
  getApplyToEditorCallback: () => ((diff: DiffEntry) => void) | null
  setApplyToEditorCallback: (callback: (diff: DiffEntry) => void) => void
  openAiDiff: (fileId?: string) => void
  closeAiDiff: (fileId?: string) => void
} | null = null

// 设置全局编辑器视图
export function setGlobalEditorView(view: EditorView | null) {
  globalEditorView = view
}

// 设置全局编译上下文
export function setGlobalCompileContext(
  context: { startCompile: (options?: any) => void } | null
) {
  globalCompileContext = context
}

// Set global suggested changes context reference
export function setGlobalSuggestedChangesContext(
  context: {
    userDocument: string
    diffs: DiffEntry[]
    acceptChange: (changeId: string) => void
    revertChange: (changeId: string) => void
    setUserDocument: (content: string) => void
    setRealDocument: (content: string) => void
    getApplyToEditorCallback: () => ((diff: DiffEntry) => void) | null
    setApplyToEditorCallback: (callback: (diff: DiffEntry) => void) => void
    openAiDiff: (fileId?: string) => void
    closeAiDiff: (fileId?: string) => void
  } | null
) {
  globalSuggestedChangesContext = context
}

// 获取当前编辑器视图
function getEditorView(): EditorView | null {
  return globalEditorView
}

// 生成唯一请求ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 获取选中文本的位置和内容
function getSelection(): {
  from: number
  to: number
  text: string
  line: number
  column: number
} | null {
  const view = getEditorView()
  if (!view) {
    return null
  }

  const state = view.state
  const selection = state.selection.main

  if (selection.empty) {
    // 没有选中文本，返回光标位置
    const pos = selection.head
    const line = state.doc.lineAt(pos)
    return {
      from: pos,
      to: pos,
      text: '',
      line: line.number - 1, // 0-indexed
      column: pos - line.from,
    }
  }

  const from = selection.from
  const to = selection.to
  const text = state.doc.sliceString(from, to)
  const line = state.doc.lineAt(from)

  return {
    from,
    to,
    text,
    line: line.number - 1, // 0-indexed
    column: from - line.from,
  }
}

// 设置选中文本
function setSelection(from: number, to: number): boolean {
  const view = getEditorView()
  if (!view) {
    return false
  }

  try {
    const state = view.state
    const docLength = state.doc.length

    // 确保位置在文档范围内
    const clampedFrom = Math.max(0, Math.min(from, docLength))
    const clampedTo = Math.max(clampedFrom, Math.min(to, docLength))

    view.dispatch({
      selection: { anchor: clampedFrom, head: clampedTo },
    })

    return true
  } catch (error) {
    debugConsole.error('Failed to set selection:', error)
    return false
  }
}

// Replace text (supports suggested mode)
function replaceText(
  from: number,
  to: number,
  text: string,
  suggestedOnly: boolean = false
): boolean | string {
  const view = getEditorView()
  if (suggestedOnly && globalSuggestedChangesContext) {
    globalSuggestedChangesContext.openAiDiff()
    // Suggested mode: update real document with the suggested change
    try {
      const currentContent = view?.state?.doc?.toString?.() ?? ''
      const newContent =
        currentContent.slice(0, from) + text + currentContent.slice(to)
      globalSuggestedChangesContext.setRealDocument(newContent)

      return 'suggested_change_applied'
    } catch (error) {
      debugConsole.error('Failed to create suggested change:', error)
      return false
    }
  }

  // Direct modification mode
  if (!view) {
    return false
  }

  try {
    const state = view.state
    const docLength = state.doc.length

    // Ensure positions are within document range
    const clampedFrom = Math.max(0, Math.min(from, docLength))
    const clampedTo = Math.max(clampedFrom, Math.min(to, docLength))

    view.dispatch({
      changes: { from: clampedFrom, to: clampedTo, insert: text },
    })

    return true
  } catch (error) {
    debugConsole.error('Failed to replace text:', error)
    return false
  }
}

// Create suggested change (applies immediately to real document)
function suggestChange(from: number, to: number, text: string): string | null {
  if (!globalSuggestedChangesContext) {
    return null
  }
  const view = getEditorView()

  try {
    // Update real document with the suggested change
    const currentContent = view?.state?.doc?.toString?.() ?? ''
    const newContent =
      currentContent.slice(0, from) + text + currentContent.slice(to)
    globalSuggestedChangesContext.setRealDocument(newContent)

    return 'suggested_change_applied'
  } catch (error) {
    debugConsole.error('Failed to create suggested change:', error)
    return null
  }
}

// Accept change: sync from real document to user document (update baseline)
function acceptChange(changeId: string): boolean {
  if (!globalSuggestedChangesContext) {
    return false
  }

  try {
    globalSuggestedChangesContext.acceptChange(changeId)
    return true
  } catch (error) {
    debugConsole.error('Failed to accept change:', error)
    return false
  }
}

// Revert change (undo the change from real document)
function rejectChange(changeId: string): boolean {
  if (!globalSuggestedChangesContext) {
    return false
  }

  try {
    globalSuggestedChangesContext.revertChange(changeId)
    return true
  } catch (error) {
    debugConsole.error('Failed to revert change:', error)
    return false
  }
}

// Get document content (with option to include changes info)
function getDocument(includeChanges: boolean = true): {
  content: string
  userDocument?: string
  realDocument?: string
  length: number
  diffs?: DiffEntry[]
} | null {
  const view = getEditorView()
  if (!view) {
    return null
  }

  const realDocument = view.state.doc.toString()

  if (includeChanges && globalSuggestedChangesContext) {
    // Return with changes information
    return {
      content: realDocument, // Real document is the current content
      userDocument: globalSuggestedChangesContext.userDocument,
      realDocument,
      length: realDocument.length,
      diffs: globalSuggestedChangesContext.diffs,
    }
  }

  // Return basic version (for compilation, use user document)
  const userDocument =
    globalSuggestedChangesContext?.userDocument || realDocument
  return {
    content: userDocument, // For compilation, use user document (baseline)
    length: userDocument.length,
  }
}

// 下载文件
function downloadFile(fileId: string, fileName?: string): string | null {
  try {
    // 获取当前项目ID
    const projectId = getMeta('ol-project_id')
    if (!projectId) {
      debugConsole.error('Project ID not available for file download')
      return null
    }

    // 构建下载URL
    const baseUrl = window.location.origin
    const downloadUrl = `${baseUrl}/project/${projectId}/file/${fileId}`

    // 如果有文件名，添加到URL参数中
    const url = fileName
      ? `${downloadUrl}?filename=${encodeURIComponent(fileName)}`
      : downloadUrl

    debugConsole.log('Generated download URL:', url)
    return url
  } catch (error) {
    debugConsole.error('Failed to generate download URL:', error)
    return null
  }
}

// 列出项目文件 - 直接从文件树数据获取，保持树结构
async function listProjectFiles(): Promise<{
  success: boolean
  files?: Array<{
    id: string
    name: string
    type: 'file' | 'doc' | 'folder'
    path: string
    size?: number
    entityId?: string
    entityType?: string
    children?: Array<any> // 保持树结构
  }>
  error?: string
}> {
  try {
    // 直接从文件树数据获取，不需要HTTP请求
    const fileTreeData = getFileTreeData()
    if (!fileTreeData) {
      return {
        success: false,
        error: 'File tree data not available',
      }
    }

    debugConsole.log('Getting project files from file tree data:', fileTreeData)

    // 递归遍历文件树，保持树结构
    function traverseTree(folder: any, path = ''): Array<any> {
      const files: Array<any> = []

      // 添加当前文件夹
      if (folder._id && folder.name) {
        files.push({
          id: folder._id,
          name: folder.name,
          type: 'folder',
          path: path + '/' + folder.name,
          entityId: folder._id,
          entityType: 'folder',
          children: [],
        })
      }

      // 遍历文档
      if (folder.docs) {
        folder.docs.forEach((doc: any) => {
          files.push({
            id: doc._id,
            name: doc.name,
            type: 'doc',
            path: path + '/' + doc.name,
            entityId: doc._id,
            entityType: 'doc',
          })
        })
      }

      // 遍历文件引用
      if (folder.fileRefs) {
        folder.fileRefs.forEach((fileRef: any) => {
          files.push({
            id: fileRef._id,
            name: fileRef.name,
            type: 'file',
            path: path + '/' + fileRef.name,
            size: fileRef.size,
            entityId: fileRef._id,
            entityType: 'fileRef',
          })
        })
      }

      // 递归遍历子文件夹
      if (folder.folders) {
        folder.folders.forEach((subFolder: any) => {
          const subFiles = traverseTree(subFolder, path + '/' + subFolder.name)
          files.push(...subFiles)
        })
      }

      return files
    }

    const files = traverseTree(fileTreeData)

    debugConsole.log('Project files retrieved from file tree:', files)
    return {
      success: true,
      files: files,
    }
  } catch (error) {
    debugConsole.error('Failed to list project files from file tree:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// 创建文件夹
async function createFolder(
  folderName: string,
  parentFolderId?: string
): Promise<{ success: boolean; folderId?: string; error?: string }> {
  try {
    // 获取当前项目ID
    const projectId = getMeta('ol-project_id')
    if (!projectId) {
      return {
        success: false,
        error: 'Project ID not available',
      }
    }

    // 获取CSRF token
    const csrfToken = getMeta('ol-csrfToken')
    if (!csrfToken) {
      return {
        success: false,
        error: 'CSRF token not available',
      }
    }

    // 如果没有指定父文件夹ID，需要从文件树数据中获取根文件夹ID
    let targetParentId = parentFolderId
    if (!targetParentId) {
      const fileTreeData = getFileTreeData()
      if (fileTreeData && fileTreeData._id) {
        // 使用文件树的根文件夹ID，而不是项目ID
        targetParentId = fileTreeData._id
        debugConsole.log(
          'Using root folder ID from file tree data:',
          targetParentId
        )
      } else {
        // 如果文件树数据不可用，回退到项目ID
        targetParentId = projectId
        debugConsole.warn(
          'File tree data not available, using project ID as fallback:',
          targetParentId
        )
      }
    }

    // 构建创建文件夹的URL
    const baseUrl = window.location.origin
    const createFolderUrl = `${baseUrl}/project/${projectId}/folder`

    debugConsole.log('Creating folder:', {
      folderName,
      parentFolderId: targetParentId,
      createFolderUrl,
      csrfToken: csrfToken ? 'present' : 'missing',
      projectId,
    })

    // 发送创建文件夹请求
    const response = await fetch(createFolderUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': csrfToken,
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        name: folderName,
        parent_folder_id: targetParentId,
      }),
    })

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text()
      debugConsole.error('Create folder request failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      })
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    let result
    try {
      result = await response.json()
    } catch (parseError) {
      debugConsole.error('Failed to parse response as JSON:', parseError)
      return {
        success: false,
        error: 'Invalid response format from server',
      }
    }

    if (result._id) {
      debugConsole.log('Folder created successfully:', result)
      return {
        success: true,
        folderId: result._id,
      }
    } else {
      debugConsole.error('Folder creation failed:', result)
      return {
        success: false,
        error: result.error || 'Folder creation failed',
      }
    }
  } catch (error) {
    debugConsole.error('Failed to create folder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// 重命名文件
async function renameFile(
  fileId: string,
  newName: string,
  entityType?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 获取当前项目ID
    const projectId = getMeta('ol-project_id')
    if (!projectId) {
      return {
        success: false,
        error: 'Project ID not available',
      }
    }

    // 获取CSRF token
    const csrfToken = getMeta('ol-csrfToken')
    if (!csrfToken) {
      return {
        success: false,
        error: 'CSRF token not available',
      }
    }

    // 确定实体类型
    const fileTypeMap = {
      fileRef: 'file',
      doc: 'doc',
      folder: 'folder',
    }

    let resolvedEntityType =
      fileTypeMap[entityType as keyof typeof fileTypeMap] || 'file' // 默认类型
    // 如果fileId看起来像路径（包含/），尝试从文件树数据获取真正的实体ID
    if (fileId.includes('/')) {
      const fileTreeData = getFileTreeData()
      if (fileTreeData) {
        const entityInfo = findEntityIdByPath(fileTreeData, fileId)
        if (entityInfo) {
          // 使用真正的实体ID和类型
          fileId = entityInfo.entityId
          resolvedEntityType =
            fileTypeMap[entityInfo.entityType as keyof typeof fileTypeMap]
          debugConsole.log(
            'Resolved entity ID from path:',
            fileId,
            '->',
            entityInfo.entityId,
            resolvedEntityType
          )
        } else {
          debugConsole.warn('Could not find entity ID for path:', fileId)
        }
      } else {
        debugConsole.warn(
          'File tree data not available for path resolution:',
          fileId
        )
      }
    } else if (!entityType) {
      // 如果fileId不是路径且没有提供实体类型，尝试通过文件树数据查找实体类型
      const fileTreeData = getFileTreeData()
      if (fileTreeData) {
        const entityInfo = findEntityById(fileTreeData, fileId)
        if (entityInfo) {
          resolvedEntityType =
            fileTypeMap[entityInfo.entityType as keyof typeof fileTypeMap]
          debugConsole.log(
            'Found entity type for ID:',
            fileId,
            '->',
            resolvedEntityType
          )
        } else {
          debugConsole.warn('Could not find entity type for ID:', fileId)
        }
      } else {
        debugConsole.warn(
          'File tree data not available for entity type resolution:',
          fileId
        )
      }
    }

    // 构建重命名文件的URL
    const baseUrl = window.location.origin
    const renameUrl = `${baseUrl}/project/${projectId}/${resolvedEntityType}/${fileId}/rename`

    debugConsole.log('Renaming file:', {
      fileId,
      newName,
      renameUrl,
      csrfToken: csrfToken ? 'present' : 'missing',
      projectId,
    })

    // 发送重命名文件请求
    const response = await fetch(renameUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        name: newName,
      }),
    })

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text()
      debugConsole.error('Rename file request failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      })
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    if (response.status === 204) {
      debugConsole.log('File renamed successfully')
      return {
        success: true,
      }
    } else {
      const result = await response.text()
      debugConsole.error('File rename failed:', result)
      return {
        success: false,
        error: result || 'File rename failed',
      }
    }
  } catch (error) {
    debugConsole.error('Failed to rename file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// 上传文件
async function uploadFile(
  file: File,
  fileName?: string,
  folderId?: string
): Promise<{
  success: boolean
  entityId?: string
  hash?: string
  error?: string
}> {
  try {
    // 获取当前项目ID
    const projectId = getMeta('ol-project_id')
    if (!projectId) {
      return {
        success: false,
        error: 'Project ID not available for file upload',
      }
    }

    // 获取CSRF token
    const csrfToken = getMeta('ol-csrfToken')
    if (!csrfToken) {
      return {
        success: false,
        error: 'CSRF token not available',
      }
    }

    // 如果没有指定folderId，需要从文件树数据中获取根文件夹ID
    let targetFolderId = folderId
    if (!targetFolderId) {
      const fileTreeData = getFileTreeData()
      if (fileTreeData && fileTreeData._id) {
        // 使用文件树的根文件夹ID，而不是项目ID
        targetFolderId = fileTreeData._id
        debugConsole.log(
          'Using root folder ID from file tree data for upload:',
          targetFolderId
        )
      } else {
        // 如果文件树数据不可用，回退到项目ID
        targetFolderId = projectId
        debugConsole.warn(
          'File tree data not available for upload, using project ID as fallback:',
          targetFolderId
        )
      }
    }

    // 使用指定的文件名或原始文件名
    const finalFileName = fileName || file.name

    // 创建FormData
    const formData = new FormData()
    formData.append('qqfile', file)
    formData.append('name', finalFileName)
    if (folderId) {
      formData.append('folder_id', folderId)
    }

    // 构建上传URL
    const baseUrl = window.location.origin
    const uploadUrl = `${baseUrl}/project/${projectId}/upload?folder_id=${targetFolderId}`

    debugConsole.log('Uploading file:', {
      fileName: finalFileName,
      folderId: targetFolderId,
      uploadUrl,
      csrfToken: csrfToken ? 'present' : 'missing',
      projectId,
    })

    // 发送上传请求
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Csrf-Token': csrfToken, // 使用正确的header名称
      },
      credentials: 'same-origin', // 包含cookies以维持会话状态
      body: formData,
    })

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text()
      debugConsole.error('Upload request failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      })
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    let result
    try {
      result = await response.json()
    } catch (parseError) {
      debugConsole.error('Failed to parse response as JSON:', parseError)
      return {
        success: false,
        error: 'Invalid response format from server',
      }
    }

    if (result.success) {
      debugConsole.log('File uploaded successfully:', result)
      return {
        success: true,
        entityId: result.entity_id,
        hash: result.hash,
      }
    } else {
      debugConsole.error('File upload failed:', result)
      return {
        success: false,
        error: result.error || 'Upload failed',
      }
    }
  } catch (error) {
    debugConsole.error('Failed to upload file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// 删除文件
async function deleteFile(
  fileId: string,
  entityType?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 获取当前项目ID
    const projectId = getMeta('ol-project_id')
    if (!projectId) {
      return {
        success: false,
        error: 'Project ID not available',
      }
    }

    // 获取CSRF token
    const csrfToken = getMeta('ol-csrfToken')
    if (!csrfToken) {
      return {
        success: false,
        error: 'CSRF token not available',
      }
    }

    // 确定实体类型
    let resolvedEntityType = entityType || 'fileRef' // 默认类型

    // 如果fileId看起来像路径（包含/），尝试从文件树数据获取真正的实体ID
    if (fileId.includes('/')) {
      const fileTreeData = getFileTreeData()
      if (fileTreeData) {
        const entityInfo = findEntityIdByPath(fileTreeData, fileId)
        if (entityInfo) {
          // 使用真正的实体ID和类型
          fileId = entityInfo.entityId
          resolvedEntityType = entityInfo.entityType
          debugConsole.log(
            'Resolved entity ID from path for deletion:',
            fileId,
            '->',
            entityInfo.entityId,
            resolvedEntityType
          )
        } else {
          debugConsole.warn('Could not find entity ID for path:', fileId)
        }
      } else {
        debugConsole.warn(
          'File tree data not available for path resolution:',
          fileId
        )
      }
    } else if (!entityType) {
      // 如果fileId不是路径且没有提供实体类型，尝试通过文件树数据查找实体类型
      const fileTreeData = getFileTreeData()
      if (fileTreeData) {
        const entityInfo = findEntityById(fileTreeData, fileId)
        if (entityInfo) {
          resolvedEntityType = entityInfo.entityType
          debugConsole.log(
            'Found entity type for deletion:',
            fileId,
            '->',
            resolvedEntityType
          )
        } else {
          debugConsole.warn('Could not find entity type for ID:', fileId)
        }
      } else {
        debugConsole.warn(
          'File tree data not available for entity type resolution:',
          fileId
        )
      }
    }

    // 构建删除文件的URL
    const baseUrl = window.location.origin
    const deleteUrl = `${baseUrl}/project/${projectId}/${resolvedEntityType}/${fileId}`

    debugConsole.log('Deleting file:', {
      fileId,
      deleteUrl,
      csrfToken: csrfToken ? 'present' : 'missing',
      projectId,
      entityType: resolvedEntityType,
    })

    // 发送删除文件请求
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'X-Csrf-Token': csrfToken,
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    })

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text()
      debugConsole.error('Delete file request failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      })
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    debugConsole.log('File deleted successfully')
    return {
      success: true,
    }
  } catch (error) {
    debugConsole.error('Failed to delete file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// 处理API事件
function handleApiEvent(event: CustomEvent) {
  const { type, detail } = event

  switch (type) {
    case 'editor:getSelection': {
      const { requestId } = detail as EditorApiEvents['editor:getSelection']
      const selection = getSelection()

      const response: EditorApiEvents['editor:getSelection:response'] = {
        requestId,
        success: selection !== null,
        data: selection || undefined,
        error: selection === null ? 'Editor not available' : undefined,
      }

      window.dispatchEvent(
        new CustomEvent('editor:getSelection:response', { detail: response })
      )
      break
    }

    case 'editor:setSelection': {
      const { requestId, from, to } =
        detail as EditorApiEvents['editor:setSelection']
      const success = setSelection(from, to)

      const response: EditorApiEvents['editor:setSelection:response'] = {
        requestId,
        success,
        error: success ? undefined : 'Failed to set selection',
      }

      window.dispatchEvent(
        new CustomEvent('editor:setSelection:response', { detail: response })
      )
      break
    }

    case 'editor:replaceText': {
      const { requestId, from, to, text, suggestedOnly } =
        detail as EditorApiEvents['editor:replaceText']
      const result = replaceText(from, to, text, suggestedOnly)

      const response: EditorApiEvents['editor:replaceText:response'] = {
        requestId,
        success: result !== false,
        changeId: typeof result === 'string' ? result : undefined,
        error: result === false ? 'Failed to replace text' : undefined,
      }

      window.dispatchEvent(
        new CustomEvent('editor:replaceText:response', { detail: response })
      )
      break
    }

    case 'editor:suggestChange': {
      const { requestId, from, to, text } =
        detail as EditorApiEvents['editor:suggestChange']
      const changeId = suggestChange(from, to, text)

      const response: EditorApiEvents['editor:suggestChange:response'] = {
        requestId,
        success: changeId !== null,
        changeId: changeId || undefined,
        error:
          changeId === null ? 'Failed to create suggested change' : undefined,
      }

      window.dispatchEvent(
        new CustomEvent('editor:suggestChange:response', { detail: response })
      )
      break
    }

    case 'editor:acceptChange': {
      const { requestId, changeId } =
        detail as EditorApiEvents['editor:acceptChange']
      const success = acceptChange(changeId)

      const response: EditorApiEvents['editor:acceptChange:response'] = {
        requestId,
        success,
        error: success ? undefined : 'Failed to accept change',
      }

      window.dispatchEvent(
        new CustomEvent('editor:acceptChange:response', { detail: response })
      )
      break
    }

    case 'editor:rejectChange': {
      const { requestId, changeId } =
        detail as EditorApiEvents['editor:rejectChange']
      const success = rejectChange(changeId)

      const response: EditorApiEvents['editor:rejectChange:response'] = {
        requestId,
        success,
        error: success ? undefined : 'Failed to reject change',
      }

      window.dispatchEvent(
        new CustomEvent('editor:rejectChange:response', { detail: response })
      )
      break
    }

    case 'editor:getDocument': {
      const { requestId, includeChanges } =
        detail as EditorApiEvents['editor:getDocument']
      const document = getDocument(includeChanges)

      const response: EditorApiEvents['editor:getDocument:response'] = {
        requestId,
        success: document !== null,
        data: document || undefined,
        error: document === null ? 'Editor not available' : undefined,
      }

      window.dispatchEvent(
        new CustomEvent('editor:getDocument:response', { detail: response })
      )
      break
    }

    case 'editor:recompile': {
      const { requestId, options } =
        detail as EditorApiEvents['editor:recompile']

      if (!globalCompileContext) {
        const response: EditorApiEvents['editor:recompile:response'] = {
          requestId,
          success: false,
          error: 'Compile context not available',
        }
        window.dispatchEvent(
          new CustomEvent('editor:recompile:response', { detail: response })
        )
        break
      }

      try {
        // 编译时确保使用原始文档内容，不包含建议修改
        // 这里可以通过 options 传递特殊标记来指示使用原始内容
        const compileOptions = {
          ...options,
          useOriginalContent: true, // 标记使用原始内容进行编译
        }

        globalCompileContext.startCompile(compileOptions)
        const response: EditorApiEvents['editor:recompile:response'] = {
          requestId,
          success: true,
        }
        window.dispatchEvent(
          new CustomEvent('editor:recompile:response', { detail: response })
        )
      } catch (error) {
        const response: EditorApiEvents['editor:recompile:response'] = {
          requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        window.dispatchEvent(
          new CustomEvent('editor:recompile:response', { detail: response })
        )
      }
      break
    }

    case 'editor:downloadFile': {
      const { requestId, fileId, fileName } =
        detail as EditorApiEvents['editor:downloadFile']
      const downloadUrl = downloadFile(fileId, fileName)

      const response: EditorApiEvents['editor:downloadFile:response'] = {
        requestId,
        success: downloadUrl !== null,
        downloadUrl: downloadUrl || undefined,
        error:
          downloadUrl === null ? 'Failed to generate download URL' : undefined,
      }

      window.dispatchEvent(
        new CustomEvent('editor:downloadFile:response', { detail: response })
      )
      break
    }

    case 'editor:uploadFile': {
      const { requestId, file, fileName, folderId } =
        detail as EditorApiEvents['editor:uploadFile']

      // 异步处理上传
      uploadFile(file, fileName, folderId)
        .then(result => {
          const response: EditorApiEvents['editor:uploadFile:response'] = {
            requestId,
            success: result.success,
            entityId: result.entityId,
            hash: result.hash,
            error: result.error,
          }

          window.dispatchEvent(
            new CustomEvent('editor:uploadFile:response', { detail: response })
          )
        })
        .catch(error => {
          const response: EditorApiEvents['editor:uploadFile:response'] = {
            requestId,
            success: false,
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          }

          window.dispatchEvent(
            new CustomEvent('editor:uploadFile:response', { detail: response })
          )
        })
      break
    }

    case 'project:deleteFile': {
      const { requestId, fileId, entityType } =
        detail as EditorApiEvents['project:deleteFile']

      // 异步处理删除文件
      deleteFile(fileId, entityType)
        .then(result => {
          const response: EditorApiEvents['project:deleteFile:response'] = {
            requestId,
            success: result.success,
            error: result.error,
          }

          window.dispatchEvent(
            new CustomEvent('project:deleteFile:response', {
              detail: response,
            })
          )
        })
        .catch(error => {
          const response: EditorApiEvents['project:deleteFile:response'] = {
            requestId,
            success: false,
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          }

          window.dispatchEvent(
            new CustomEvent('project:deleteFile:response', {
              detail: response,
            })
          )
        })
      break
    }

    case 'project:listFiles': {
      const { requestId } = detail as EditorApiEvents['project:listFiles']

      // 异步处理列出文件
      listProjectFiles()
        .then(result => {
          const response: EditorApiEvents['project:listFiles:response'] = {
            requestId,
            success: result.success,
            files: result.files,
            error: result.error,
          }

          window.dispatchEvent(
            new CustomEvent('project:listFiles:response', { detail: response })
          )
        })
        .catch(error => {
          const response: EditorApiEvents['project:listFiles:response'] = {
            requestId,
            success: false,
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          }

          window.dispatchEvent(
            new CustomEvent('project:listFiles:response', { detail: response })
          )
        })
      break
    }

    case 'project:createFolder': {
      const { requestId, folderName, parentFolderId } =
        detail as EditorApiEvents['project:createFolder']

      // 异步处理创建文件夹
      createFolder(folderName, parentFolderId)
        .then(result => {
          const response: EditorApiEvents['project:createFolder:response'] = {
            requestId,
            success: result.success,
            folderId: result.folderId,
            error: result.error,
          }

          window.dispatchEvent(
            new CustomEvent('project:createFolder:response', {
              detail: response,
            })
          )
        })
        .catch(error => {
          const response: EditorApiEvents['project:createFolder:response'] = {
            requestId,
            success: false,
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          }

          window.dispatchEvent(
            new CustomEvent('project:createFolder:response', {
              detail: response,
            })
          )
        })
      break
    }

    case 'project:renameFile': {
      const { requestId, fileId, newName, entityType } =
        detail as EditorApiEvents['project:renameFile']

      // 异步处理重命名文件
      renameFile(fileId, newName, entityType)
        .then(result => {
          const response: EditorApiEvents['project:renameFile:response'] = {
            requestId,
            success: result.success,
            error: result.error,
          }

          window.dispatchEvent(
            new CustomEvent('project:renameFile:response', { detail: response })
          )
        })
        .catch(error => {
          const response: EditorApiEvents['project:renameFile:response'] = {
            requestId,
            success: false,
            error:
              error instanceof Error ? error.message : 'Unknown error occurred',
          }

          window.dispatchEvent(
            new CustomEvent('project:renameFile:response', { detail: response })
          )
        })
      break
    }

    case 'editor:openAiDiff': {
      const { requestId, fileId } = detail as EditorApiEvents['editor:openAiDiff']

      if (!globalSuggestedChangesContext) {
        const response: EditorApiEvents['editor:openAiDiff:response'] = {
          requestId,
          success: false,
          error: 'Suggested changes context not available',
        }
        window.dispatchEvent(
          new CustomEvent('editor:openAiDiff:response', { detail: response })
        )
        break
      }

      try {
        globalSuggestedChangesContext.openAiDiff(fileId)
        const response: EditorApiEvents['editor:openAiDiff:response'] = {
          requestId,
          success: true,
        }
        window.dispatchEvent(
          new CustomEvent('editor:openAiDiff:response', { detail: response })
        )
      } catch (error) {
        const response: EditorApiEvents['editor:openAiDiff:response'] = {
          requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        window.dispatchEvent(
          new CustomEvent('editor:openAiDiff:response', { detail: response })
        )
      }
      break
    }

    case 'editor:closeAiDiff': {
      const { requestId, fileId } = detail as EditorApiEvents['editor:closeAiDiff']

      if (!globalSuggestedChangesContext) {
        const response: EditorApiEvents['editor:closeAiDiff:response'] = {
          requestId,
          success: false,
          error: 'Suggested changes context not available',
        }
        window.dispatchEvent(
          new CustomEvent('editor:closeAiDiff:response', { detail: response })
        )
        break
      }

      try {
        globalSuggestedChangesContext.closeAiDiff(fileId)
        const response: EditorApiEvents['editor:closeAiDiff:response'] = {
          requestId,
          success: true,
        }
        window.dispatchEvent(
          new CustomEvent('editor:closeAiDiff:response', { detail: response })
        )
      } catch (error) {
        const response: EditorApiEvents['editor:closeAiDiff:response'] = {
          requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        window.dispatchEvent(
          new CustomEvent('editor:closeAiDiff:response', { detail: response })
        )
      }
      break
    }

    default:
      debugConsole.warn('Unknown editor API event:', type)
  }
}

// 初始化API事件监听器
export function initializeEditorApi() {
  // 监听所有编辑器API事件
  const eventTypes: (keyof EditorApiEvents)[] = [
    'editor:getSelection',
    'editor:setSelection',
    'editor:replaceText',
    'editor:suggestChange',
    'editor:acceptChange',
    'editor:rejectChange',
    'editor:getDocument',
    'editor:recompile',
    'editor:downloadFile',
    'editor:uploadFile',
    'editor:openAiDiff',
    'editor:closeAiDiff',
    'project:listFiles',
    'project:createFolder',
    'project:renameFile',
    'project:deleteFile',
  ]

  eventTypes.forEach(eventType => {
    window.addEventListener(eventType, handleApiEvent as EventListener)
  })

  debugConsole.log('Editor API initialized')
}

// 清理API事件监听器
export function cleanupEditorApi() {
  const eventTypes: (keyof EditorApiEvents)[] = [
    'editor:getSelection',
    'editor:setSelection',
    'editor:replaceText',
    'editor:suggestChange',
    'editor:acceptChange',
    'editor:rejectChange',
    'editor:getDocument',
    'editor:recompile',
    'editor:downloadFile',
    'editor:uploadFile',
    'editor:openAiDiff',
    'editor:closeAiDiff',
    'project:listFiles',
    'project:createFolder',
    'project:renameFile',
    'project:deleteFile',
  ]

  eventTypes.forEach(eventType => {
    window.removeEventListener(eventType, handleApiEvent as EventListener)
  })

  debugConsole.log('Editor API cleaned up')
}

// 导出便捷方法供外部使用
export const editorApi = {
  // 获取选中文本
  getSelection: (): Promise<
    EditorApiEvents['editor:getSelection:response']['data']
  > => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:getSelection:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:getSelection:response',
            handleResponse as EventListener
          )
          resolve(detail.data)
        }
      }

      window.addEventListener(
        'editor:getSelection:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:getSelection', {
          detail: { requestId },
        })
      )
    })
  },

  // 设置选中文本
  setSelection: (from: number, to: number): Promise<boolean> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:setSelection:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:setSelection:response',
            handleResponse as EventListener
          )
          resolve(detail.success)
        }
      }

      window.addEventListener(
        'editor:setSelection:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:setSelection', {
          detail: { requestId, from, to },
        })
      )
    })
  },

  // 替换文本
  replaceText: (
    from: number,
    to: number,
    text: string,
    suggestedOnly?: boolean
  ): Promise<{ success: boolean; changeId?: string }> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:replaceText:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:replaceText:response',
            handleResponse as EventListener
          )
          resolve({ success: detail.success, changeId: detail.changeId })
        }
      }

      window.addEventListener(
        'editor:replaceText:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:replaceText', {
          detail: { requestId, from, to, text, suggestedOnly },
        })
      )
    })
  },

  // 创建建议修改
  suggestChange: (
    from: number,
    to: number,
    text: string
  ): Promise<{ success: boolean; changeId?: string }> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:suggestChange:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:suggestChange:response',
            handleResponse as EventListener
          )
          resolve({ success: detail.success, changeId: detail.changeId })
        }
      }

      window.addEventListener(
        'editor:suggestChange:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:suggestChange', {
          detail: { requestId, from, to, text },
        })
      )
    })
  },

  // 接受建议修改
  acceptChange: (changeId: string): Promise<boolean> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:acceptChange:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:acceptChange:response',
            handleResponse as EventListener
          )
          resolve(detail.success)
        }
      }

      window.addEventListener(
        'editor:acceptChange:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:acceptChange', {
          detail: { requestId, changeId },
        })
      )
    })
  },

  // 拒绝建议修改
  rejectChange: (changeId: string): Promise<boolean> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:rejectChange:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:rejectChange:response',
            handleResponse as EventListener
          )
          resolve(detail.success)
        }
      }

      window.addEventListener(
        'editor:rejectChange:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:rejectChange', {
          detail: { requestId, changeId },
        })
      )
    })
  },

  // 获取文档内容
  getDocument: (
    includeChanges?: boolean
  ): Promise<EditorApiEvents['editor:getDocument:response']['data']> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:getDocument:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:getDocument:response',
            handleResponse as EventListener
          )
          resolve(detail.data)
        }
      }

      window.addEventListener(
        'editor:getDocument:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:getDocument', {
          detail: { requestId, includeChanges },
        })
      )
    })
  },

  // 重新编译
  recompile: (options?: any): Promise<boolean> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:recompile:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:recompile:response',
            handleResponse as EventListener
          )
          resolve(detail.success)
        }
      }

      window.addEventListener(
        'editor:recompile:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:recompile', {
          detail: { requestId, options },
        })
      )
    })
  },

  // 下载文件
  downloadFile: (
    fileId: string,
    fileName?: string
  ): Promise<{ success: boolean; downloadUrl?: string }> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:downloadFile:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:downloadFile:response',
            handleResponse as EventListener
          )
          resolve({
            success: detail.success,
            downloadUrl: detail.downloadUrl,
          })
        }
      }

      window.addEventListener(
        'editor:downloadFile:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:downloadFile', {
          detail: { requestId, fileId, fileName },
        })
      )
    })
  },

  // 上传文件
  uploadFile: (
    file: File,
    fileName?: string,
    folderId?: string
  ): Promise<{
    success: boolean
    entityId?: string
    hash?: string
    error?: string
  }> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:uploadFile:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:uploadFile:response',
            handleResponse as EventListener
          )
          resolve({
            success: detail.success,
            entityId: detail.entityId,
            hash: detail.hash,
            error: detail.error,
          })
        }
      }

      window.addEventListener(
        'editor:uploadFile:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:uploadFile', {
          detail: { requestId, file, fileName, folderId },
        })
      )
    })
  },

  // 列出项目文件
  listProjectFiles: (): Promise<{
    success: boolean
    files?: Array<{
      id: string
      name: string
      type: 'file' | 'folder' | 'doc'
      path: string
      entityId?: string
      entityType?: string
    }>
    error?: string
  }> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['project:listFiles:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'project:listFiles:response',
            handleResponse as EventListener
          )
          resolve({
            success: detail.success,
            files: detail.files,
            error: detail.error,
          })
        }
      }

      window.addEventListener(
        'project:listFiles:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('project:listFiles', {
          detail: { requestId },
        })
      )
    })
  },

  // 创建文件夹
  createFolder: (
    folderName: string,
    parentFolderId?: string
  ): Promise<{ success: boolean; folderId?: string; error?: string }> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['project:createFolder:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'project:createFolder:response',
            handleResponse as EventListener
          )
          resolve({
            success: detail.success,
            folderId: detail.folderId,
            error: detail.error,
          })
        }
      }

      window.addEventListener(
        'project:createFolder:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('project:createFolder', {
          detail: { requestId, folderName, parentFolderId },
        })
      )
    })
  },

  // 重命名文件
  renameFile: (
    fileId: string,
    newName: string,
    entityType?: string
  ): Promise<{ success: boolean; error?: string }> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['project:renameFile:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'project:renameFile:response',
            handleResponse as EventListener
          )
          resolve({
            success: detail.success,
            error: detail.error,
          })
        }
      }

      window.addEventListener(
        'project:renameFile:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('project:renameFile', {
          detail: { requestId, fileId, newName, entityType },
        })
      )
    })
  },

  // 删除文件
  deleteFile: (
    fileId: string,
    entityType?: string
  ): Promise<{ success: boolean; error?: string }> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['project:deleteFile:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'project:deleteFile:response',
            handleResponse as EventListener
          )
          resolve({
            success: detail.success,
            error: detail.error,
          })
        }
      }

      window.addEventListener(
        'project:deleteFile:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('project:deleteFile', {
          detail: { requestId, fileId, entityType },
        })
      )
    })
  },

  // AI diff mode control methods
  openAiDiff: (fileId?: string): Promise<boolean> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:openAiDiff:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:openAiDiff:response',
            handleResponse as EventListener
          )
          resolve(detail.success)
        }
      }

      window.addEventListener(
        'editor:openAiDiff:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:openAiDiff', {
          detail: { requestId, fileId },
        })
      )
    })
  },

  closeAiDiff: (fileId?: string): Promise<boolean> => {
    return new Promise(resolve => {
      const requestId = generateRequestId()

      const handleResponse = (event: CustomEvent) => {
        const { detail } = event as {
          detail: EditorApiEvents['editor:closeAiDiff:response']
        }
        if (detail.requestId === requestId) {
          window.removeEventListener(
            'editor:closeAiDiff:response',
            handleResponse as EventListener
          )
          resolve(detail.success)
        }
      }

      window.addEventListener(
        'editor:closeAiDiff:response',
        handleResponse as EventListener
      )
      window.dispatchEvent(
        new CustomEvent('editor:closeAiDiff', {
          detail: { requestId, fileId },
        })
      )
    })
  },
}

// 将API暴露到全局window对象
declare global {
  interface Window {
    overleafEditorApi: typeof editorApi
  }
}

// 在模块加载时暴露API到全局
if (typeof window !== 'undefined') {
  window.overleafEditorApi = editorApi
}
