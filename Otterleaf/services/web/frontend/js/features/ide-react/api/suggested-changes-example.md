# 建议修改系统使用指南

## 概述

建议修改系统允许你创建文本修改建议，而不是直接修改文档。用户可以在编辑器中看到 inline diff，并选择接受或拒绝这些修改。编译功能会使用原始文档内容，而 getDocument API 可以返回包含建议修改的版本。

## 主要功能

1. **建议修改模式**: `replaceText` API 支持 `suggestedOnly` 参数
2. **Inline Diff 显示**: 在编辑器中显示建议的修改
3. **接受/拒绝 UI**: 悬浮按钮允许用户接受或拒绝修改
4. **原始文档编译**: 编译功能使用原始文档，不包含建议修改
5. **灵活的文档获取**: `getDocument` API 可以返回原始版本或包含建议修改的版本

## API 使用示例

### 1. 创建建议修改

```javascript
// 使用 replaceText API 创建建议修改
const result = await window.overleafEditorApi.replaceText(10, 20, "新文本", true)
if (result.success) {
  console.log('建议修改已创建，ID:', result.changeId)
}

// 或者使用专门的 suggestChange API
const result = await window.overleafEditorApi.suggestChange(10, 20, "新文本")
if (result.success) {
  console.log('建议修改已创建，ID:', result.changeId)
}
```

### 2. 获取文档内容

```javascript
// 获取包含建议修改的文档内容（默认行为）
const docWithChanges = await window.overleafEditorApi.getDocument(true)
console.log('修改后的内容:', docWithChanges.content)
console.log('原始内容:', docWithChanges.originalContent)
console.log('建议修改列表:', docWithChanges.suggestedChanges)

// 获取原始文档内容（用于编译）
const originalDoc = await window.overleafEditorApi.getDocument(false)
console.log('原始内容:', originalDoc.content)
```

### 3. 接受或拒绝修改

```javascript
// 接受修改
const accepted = await window.overleafEditorApi.acceptChange(changeId)
if (accepted) {
  console.log('修改已接受')
}

// 拒绝修改
const rejected = await window.overleafEditorApi.rejectChange(changeId)
if (rejected) {
  console.log('修改已拒绝')
}
```

### 4. 编译原始文档

```javascript
// 编译功能自动使用原始文档内容
const compiled = await window.overleafEditorApi.recompile()
if (compiled) {
  console.log('编译完成（使用原始文档）')
}
```

## 在 React 组件中使用

```tsx
import { useSuggestedChanges } from '@/features/ide-react/context/suggested-changes-context'

function MyComponent() {
  const {
    suggestedChanges,
    originalDocument,
    modifiedDocument,
    addSuggestedChange,
    acceptChange,
    rejectChange,
    clearAllChanges
  } = useSuggestedChanges()

  const handleSuggestChange = () => {
    const changeId = addSuggestedChange(10, 20, "新文本")
    console.log('创建了建议修改:', changeId)
  }

  const handleAcceptChange = (changeId: string) => {
    acceptChange(changeId)
  }

  const handleRejectChange = (changeId: string) => {
    rejectChange(changeId)
  }

  return (
    <div>
      <p>原始文档长度: {originalDocument.length}</p>
      <p>修改后文档长度: {modifiedDocument.length}</p>
      <p>待处理修改数量: {suggestedChanges.filter(c => c.status === 'pending').length}</p>
      
      <button onClick={handleSuggestChange}>创建建议修改</button>
      <button onClick={() => clearAllChanges()}>清除所有修改</button>
      
      {suggestedChanges.map(change => (
        <div key={change.id}>
          <span>{change.originalText} → {change.suggestedText}</span>
          <button onClick={() => handleAcceptChange(change.id)}>接受</button>
          <button onClick={() => handleRejectChange(change.id)}>拒绝</button>
        </div>
      ))}
    </div>
  )
}
```

## 数据结构

### SuggestedChange

```typescript
interface SuggestedChange {
  id: string                    // 唯一标识符
  from: number                  // 开始位置
  to: number                    // 结束位置
  originalText: string          // 原始文本
  suggestedText: string         // 建议文本
  timestamp: number             // 创建时间戳
  status: 'pending' | 'accepted' | 'rejected'  // 状态
}
```

## 样式定制

建议修改的样式可以通过 CSS 定制：

```css
/* 删除的文本样式 */
.ol-cm-suggested-change-delete {
  text-decoration: line-through;
  background-color: #ffebee;
  color: #c62828;
}

/* 插入的文本样式 */
.ol-cm-suggested-change-insert {
  background-color: #e8f5e8;
  color: #2e7d32;
  font-weight: bold;
}

/* 悬浮控制按钮样式 */
.ol-cm-suggested-change-widget {
  display: inline-flex;
  align-items: center;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  margin: 2px;
  font-size: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```

## 注意事项

1. **位置同步**: 建议修改的位置会随着文档的其他修改自动调整
2. **编译隔离**: 编译功能始终使用原始文档内容，确保编译结果的一致性
3. **状态管理**: 建议修改状态在内存中管理，页面刷新后会丢失
4. **性能考虑**: 大量建议修改可能影响编辑器性能，建议适度使用

## 扩展功能

系统设计为可扩展的，可以轻松添加以下功能：

- 建议修改的持久化存储
- 多用户协作的建议修改
- 建议修改的批量操作
- 更复杂的 diff 算法
- 建议修改的版本历史


