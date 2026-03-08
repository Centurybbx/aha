# Overleaf Editor Iframe API 使用指南

## 概述

Overleaf Editor 现在支持通过 iframe 嵌入，并提供了完整的 API 接口供外部应用调用。外部应用可以嵌入 Overleaf 编辑器，并通过 postMessage 与编辑器进行通信。iframe API 直接调用 `window.overleafEditorApi` 中注册的 API 方法。

## 支持的源

目前支持以下源进行 iframe 通信：
- `http://localhost:5173`
- `https://localhost:5173`
- `http://127.0.0.1:5173`
- `https://127.0.0.1:5173`

## 基本用法

### 1. 嵌入 iframe

```html
<iframe 
  id="overleaf-editor"
  src="https://your-overleaf-domain.com/project/your-project-id"
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

### 2. 监听来自 iframe 的消息

```javascript
// 监听来自 iframe 的消息
window.addEventListener('message', function(event) {
  // 验证来源
  if (event.origin !== "https://your-overleaf-domain.com") return;
  
  const { type, callId, success, result, error } = event.data;
  
  if (type === 'apiResponse') {
    if (success) {
      console.log('API 调用成功:', result);
    } else {
      console.error('API 调用失败:', error);
    }
  }
});
```

### 3. 调用编辑器 API

```javascript
// 调用编辑器 API 的辅助函数
function callEditorApi(api, method, params = []) {
  const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  const iframe = document.getElementById('overleaf-editor');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'apiCall',
      api: api,
      method: method,
      params: params,
      callId: callId
    }, 'https://your-overleaf-domain.com');
  }
  
  return callId;
}
```

## API 示例

### 1. 获取当前选中文本

```javascript
// 调用 API
const callId = callEditorApi('editor', 'getSelection');

// 监听响应
window.addEventListener('message', function(event) {
  if (event.origin !== "https://your-overleaf-domain.com") return;
  
  const { type, callId: responseCallId, success, result, error } = event.data;
  
  if (type === 'apiResponse' && responseCallId === callId) {
    if (success) {
      console.log('选中的文本:', result);
      // result 包含: { from, to, text, line, column }
    } else {
      console.error('获取选中文本失败:', error);
    }
  }
});
```

### 2. 设置选中文本

```javascript
const callId = callEditorApi('editor', 'setSelection', [10, 20]);

window.addEventListener('message', function(event) {
  if (event.origin !== "https://your-overleaf-domain.com") return;
  
  const { type, callId: responseCallId, success, error } = event.data;
  
  if (type === 'apiResponse' && responseCallId === callId) {
    if (success) {
      console.log('选中文本设置成功');
    } else {
      console.error('设置选中文本失败:', error);
    }
  }
});
```

### 3. 替换文本

```javascript
const callId = callEditorApi('editor', 'replaceText', [10, 20, '新的文本内容']);

window.addEventListener('message', function(event) {
  if (event.origin !== "https://your-overleaf-domain.com") return;
  
  const { type, callId: responseCallId, success, result, error } = event.data;
  
  if (type === 'apiResponse' && responseCallId === callId) {
    if (success) {
      console.log('文本替换成功');
    } else {
      console.error('文本替换失败:', error);
    }
  }
});
```

### 4. 建议修改（仅创建建议，不直接修改）

```javascript
const callId = callEditorApi('editor', 'suggestChange', [10, 20, '建议的文本内容']);

window.addEventListener('message', function(event) {
  if (event.origin !== "https://your-overleaf-domain.com") return;
  
  const { type, callId: responseCallId, success, result, error } = event.data;
  
  if (type === 'apiResponse' && responseCallId === callId) {
    if (success) {
      console.log('建议修改创建成功，ID:', result.changeId);
      // 可以使用 changeId 来接受或拒绝建议
    } else {
      console.error('创建建议修改失败:', error);
    }
  }
});
```

### 5. 接受建议修改

```javascript
const changeId = 'change_12345'; // 从 suggestChange 响应中获取
const callId = callEditorApi('editor', 'acceptChange', [changeId]);

window.addEventListener('message', function(event) {
  if (event.origin !== "https://your-overleaf-domain.com") return;
  
  const { type, callId: responseCallId, success, error } = event.data;
  
  if (type === 'apiResponse' && responseCallId === callId) {
    if (success) {
      console.log('建议修改已接受');
    } else {
      console.error('接受建议修改失败:', error);
    }
  }
});
```

### 6. 拒绝建议修改

```javascript
const changeId = 'change_12345'; // 从 suggestChange 响应中获取
const callId = callEditorApi('editor', 'rejectChange', [changeId]);

window.addEventListener('message', function(event) {
  if (event.origin !== "https://your-overleaf-domain.com") return;
  
  const { type, callId: responseCallId, success, error } = event.data;
  
  if (type === 'apiResponse' && responseCallId === callId) {
    if (success) {
      console.log('建议修改已拒绝');
    } else {
      console.error('拒绝建议修改失败:', error);
    }
  }
});
```

### 7. 获取文档内容

```javascript
const callId = callEditorApi('editor', 'getDocument', [true]); // true 表示包含建议修改

window.addEventListener('message', function(event) {
  if (event.origin !== "https://your-overleaf-domain.com") return;
  
  const { type, callId: responseCallId, success, result, error } = event.data;
  
  if (type === 'apiResponse' && responseCallId === callId) {
    if (success) {
      console.log('文档内容:', result);
      // result 包含: { content, changes: [...] }
    } else {
      console.error('获取文档内容失败:', error);
    }
  }
});
```

### 8. 重新编译

```javascript
const callId = callEditorApi('editor', 'recompile', [{}]);

window.addEventListener('message', function(event) {
  if (event.origin !== "https://your-overleaf-domain.com") return;
  
  const { type, callId: responseCallId, success, error } = event.data;
  
  if (type === 'apiResponse' && responseCallId === callId) {
    if (success) {
      console.log('重新编译成功');
    } else {
      console.error('重新编译失败:', error);
    }
  }
});
```

## 完整的封装类示例

```javascript
class OverleafEditorAPI {
  constructor(iframeId, overleafOrigin) {
    this.iframeId = iframeId;
    this.overleafOrigin = overleafOrigin;
    this.pendingCalls = new Map();
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.origin !== this.overleafOrigin) return;
      
      const { type, callId, success, result, error } = event.data;
      
      if (type === 'apiResponse' && this.pendingCalls.has(callId)) {
        const { resolve, reject } = this.pendingCalls.get(callId);
        this.pendingCalls.delete(callId);
        
        if (success) {
          resolve(result);
        } else {
          reject(new Error(error));
        }
      }
    });
  }

  callApi(api, method, params = []) {
    return new Promise((resolve, reject) => {
      const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      this.pendingCalls.set(callId, { resolve, reject });
      
      const iframe = document.getElementById(this.iframeId);
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'apiCall',
          api: api,
          method: method,
          params: params,
          callId: callId
        }, this.overleafOrigin);
      } else {
        reject(new Error('Iframe not found or not loaded'));
      }
    });
  }

  // 便捷方法
  async getSelection() {
    return this.callApi('editor', 'getSelection');
  }

  async setSelection(from, to) {
    return this.callApi('editor', 'setSelection', [from, to]);
  }

  async replaceText(from, to, text) {
    return this.callApi('editor', 'replaceText', [from, to, text]);
  }

  async suggestChange(from, to, text) {
    return this.callApi('editor', 'suggestChange', [from, to, text]);
  }

  async acceptChange(changeId) {
    return this.callApi('editor', 'acceptChange', [changeId]);
  }

  async rejectChange(changeId) {
    return this.callApi('editor', 'rejectChange', [changeId]);
  }

  async getDocument(includeChanges = false) {
    return this.callApi('editor', 'getDocument', [includeChanges]);
  }

  async recompile(options = {}) {
    return this.callApi('editor', 'recompile', [options]);
  }
}

// 使用示例
const editorAPI = new OverleafEditorAPI('overleaf-editor', 'https://your-overleaf-domain.com');

// 等待 iframe 加载完成
document.getElementById('overleaf-editor').addEventListener('load', async () => {
  try {
    // 获取当前选中文本
    const selection = await editorAPI.getSelection();
    console.log('当前选中:', selection);

    // 替换文本
    await editorAPI.replaceText(0, 10, 'Hello World');
    console.log('文本替换完成');

    // 创建建议修改
    const change = await editorAPI.suggestChange(20, 30, '建议的文本');
    console.log('建议修改创建:', change.changeId);

    // 接受建议修改
    await editorAPI.acceptChange(change.changeId);
    console.log('建议修改已接受');

  } catch (error) {
    console.error('API 调用失败:', error);
  }
});
```

## 错误处理

所有 API 调用都可能失败，建议始终使用 try-catch 或检查响应中的 success 字段：

```javascript
try {
  const result = await editorAPI.getSelection();
  console.log('成功:', result);
} catch (error) {
  console.error('失败:', error.message);
}
```

### 6. 下载文件

```javascript
// 下载文件
async function downloadFile(fileId, fileName) {
  try {
    const result = await callEditorApi('editor', 'downloadFile', [fileId, fileName]);
    
    if (result.success && result.downloadUrl) {
      // 自动打开下载链接
      window.open(result.downloadUrl, '_blank');
      console.log('文件下载URL:', result.downloadUrl);
    } else {
      console.error('下载失败:', result.error);
    }
  } catch (error) {
    console.error('下载文件失败:', error.message);
  }
}

// 使用示例
downloadFile('file123', 'my-document.pdf');
```

### 7. 上传文件

```javascript
// 上传文件
async function uploadFile(file, fileName, folderId) {
  try {
    const params = [file];
    if (fileName) params.push(fileName);
    if (folderId) params.push(folderId);
    
    const result = await callEditorApi('editor', 'uploadFile', params);
    
    if (result.success) {
      console.log('文件上传成功!');
      console.log('实体ID:', result.entityId);
      console.log('文件哈希:', result.hash);
    } else {
      console.error('上传失败:', result.error);
    }
  } catch (error) {
    console.error('上传文件失败:', error.message);
  }
}

// 使用示例
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];
uploadFile(file, 'custom-name.pdf', 'folder123');
```

## 注意事项

1. 确保 iframe 已完全加载后再调用 API
2. 始终验证消息来源以确保安全性
3. 处理异步调用的超时情况
4. 建议修改功能需要用户手动接受或拒绝
5. 某些操作可能需要用户权限或项目状态允许
6. 文件操作需要确保用户有相应的项目权限

## 中文版本

### 概述

Overleaf 编辑器现在支持通过 iframe 嵌入，并提供了完整的 API 接口供外部应用调用。外部应用可以嵌入 Overleaf 编辑器，并通过 postMessage 与编辑器进行通信。iframe API 直接调用 `window.overleafEditorApi` 中注册的 API 方法。

### 基本用法

1. **嵌入 iframe**：在您的 HTML 页面中嵌入 Overleaf 编辑器
2. **监听消息**：设置消息监听器来处理来自编辑器的响应
3. **调用 API**：通过 postMessage 调用编辑器的各种功能

### 主要功能

- **文本选择**：获取和设置当前选中的文本
- **文本替换**：直接替换指定位置的文本
- **建议修改**：创建、接受或拒绝建议修改
- **文档操作**：获取文档内容和重新编译
- **异步通信**：支持 Promise 风格的异步调用

这个 API 设计遵循了现代 Web 开发的最佳实践，提供了类型安全、错误处理和易于使用的接口。
