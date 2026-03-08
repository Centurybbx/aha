# Suggested Changes Architecture / 建议修改架构

## Overview / 概述

The suggested changes system now uses a **dual-document architecture** for cleaner management and better user experience.

建议修改系统现在使用**双文档架构**以实现更清晰的管理和更好的用户体验。

## Architecture / 架构

### Terminology / 术语

1. **User Document (用户文档)**
   - The baseline document from the user's perspective
   - Used as the reference for calculating diffs
   - Used for PDF compilation (so PDF shows the original document)
   - 用户视角的基准文档
   - 用作计算 diff 的参考
   - 用于 PDF 编译（所以 PDF 显示原始文档）

2. **Real Document (真实文档)**
   - The actual document content in CodeMirror editor
   - Contains all suggested changes already applied
   - What the user sees in the editor
   - CodeMirror 编辑器中的实际文档内容
   - 包含所有已应用的建议修改
   - 用户在编辑器中看到的内容

### How It Works / 工作原理

```
┌──────────────────┐
│  User Document   │  ← Baseline (for compilation)
│  (基准文档)       │
└──────────────────┘
         │
         │ Apply suggested changes
         │ (应用建议修改)
         ▼
┌──────────────────┐
│  Real Document   │  ← What user sees in editor
│  (真实文档)       │     (用户在编辑器中看到的)
└──────────────────┘
         │
         │ Calculate diffs
         │ (计算差异)
         ▼
┌──────────────────┐
│  Diff Display    │  ← Visual representation
│  (差异展示)       │     (可视化表示)
└──────────────────┘
```

### Workflow / 工作流程

1. **Apply Suggested Change / 应用建议修改**
   ```typescript
   applySuggestedChange(userDocFrom, userDocTo, text)
   ```
   - Immediately modifies the real document (CodeMirror content)
   - Records the change in `appliedChanges` array
   - Handles overlapping changes by automatically merging them
   - Calculates new diffs
   - 立即修改真实文档（CodeMirror 内容）
   - 在 `appliedChanges` 数组中记录修改
   - 通过自动合并处理重叠的修改
   - 计算新的 diff

2. **Display Diffs / 显示差异**
   - Diffs are calculated between user document and real document
   - Displayed as decorations in CodeMirror
   - Shows strike-through for user's original text (as a widget before the new text)
   - Shows highlighted for new suggested text
   - Two buttons appear on hover: ✓ (accept) and ✗ (revert)
   - 在用户文档和真实文档之间计算差异
   - 在 CodeMirror 中显示为装饰器
   - 为用户的原始文本显示删除线（作为新文本之前的小部件）
   - 为新的建议文本显示高亮
   - 悬停时显示两个按钮：✓（同意）和 ✗（拒绝）

3. **Accept Change / 同意修改**
   ```typescript
   acceptChange(changeId)
   ```
   - Syncs the change from real document to user document
   - Updates the user document baseline to include this change
   - The diff disappears as both documents now agree on this part
   - 将修改从真实文档同步到用户文档
   - 更新用户文档基准以包含此修改
   - diff 消失，因为两个文档现在对这部分达成一致

4. **Revert Change / 拒绝修改**
   ```typescript
   revertChange(changeId)
   ```
   - Removes the change from real document
   - Restores the original text from user document
   - Updates diffs
   - 从真实文档中移除修改
   - 从用户文档恢复原始文本
   - 更新差异

### Key Components / 关键组件

1. **SuggestedChangesContext**
   - Manages user document, applied changes, and diffs
   - Provides callbacks for applying/reverting changes
   - 管理用户文档、已应用的修改和差异
   - 提供应用/撤销修改的回调

2. **SuggestedChangesIntegration**
   - Bridges context with CodeMirror editor
   - Handles actual document modifications
   - 连接 context 和 CodeMirror 编辑器
   - 处理实际的文档修改

3. **suggested-changes.ts**
   - CodeMirror extension for visual diff display
   - Handles decorations and widgets
   - CodeMirror 扩展，用于可视化差异展示
   - 处理装饰器和小部件

### Advantages / 优势

1. **Immediate Feedback / 即时反馈**
   - Suggested changes appear immediately in the editor
   - PDF compilation shows the result with changes applied
   - 建议的修改立即在编辑器中出现
   - PDF 编译显示应用修改后的结果

2. **Clear Accept/Revert / 清晰的同意/拒绝**
   - Accept (✓): User agrees with the change, sync to baseline
   - Revert (✗): User disagrees, restore original text
   - 同意（✓）：用户同意修改，同步到基准
   - 拒绝（✗）：用户不同意，恢复原始文本

3. **Automatic Merge / 自动合并**
   - Overlapping changes are automatically merged
   - No manual intervention needed
   - 重叠的修改自动合并
   - 不需要手动干预

4. **Clear Visualization / 清晰的可视化**
   - Diffs show exactly what changed
   - User sees both original and new text side by side
   - 差异准确显示了什么发生了变化
   - 用户并排看到原始文本和新文本

5. **Flexible Workflow / 灵活的工作流**
   - Accept all changes: user document becomes same as real document
   - Reject all changes: real document reverts to user document
   - 接受所有修改：用户文档变得与真实文档相同
   - 拒绝所有修改：真实文档恢复为用户文档

## API Usage / API 使用

### Create Suggested Change / 创建建议修改

```javascript
// Apply a suggested change (modifies real document immediately)
const changeId = await window.overleafEditorApi.suggestChange(10, 20, "new text")
```

### Accept Change / 同意修改

```javascript
// Accept a change (sync to user document baseline)
await window.overleafEditorApi.acceptChange(changeId)
// After accepting, the diff disappears
```

### Revert Change / 拒绝修改

```javascript
// Revert a change from real document (restore user document text)
await window.overleafEditorApi.rejectChange(changeId)
// After reverting, the change is removed from real document
```

### Get Document Content / 获取文档内容

```javascript
// Get document with changes info
const doc = await window.overleafEditorApi.getDocument(true)
console.log('Real document:', doc.realDocument)
console.log('User document:', doc.userDocument)
console.log('Applied changes:', doc.appliedChanges)
console.log('Diffs:', doc.diffs)

// Get user document only (for compilation)
const userDoc = await window.overleafEditorApi.getDocument(false)
console.log('User document (for compilation):', userDoc.content)
```

## Migration Notes / 迁移说明

### Breaking Changes / 破坏性变更

1. `SuggestedChange` interface replaced with `AppliedChange` and `DiffEntry`
2. `addSuggestedChange` replaced with `applySuggestedChange`
3. `acceptChange` behavior changed: now syncs change to user document (updates baseline)
4. `rejectChange` still works as `revertChange` (restores user document text)
5. `originalDocument` renamed to `userDocument`
6. `modifiedDocument` no longer exists (use `realDocument` or CodeMirror content)
7. Overlapping changes are now automatically merged

### Compatibility / 兼容性

- API signatures remain similar where possible
- `acceptChange` and `rejectChange` (now `revertChange`) are both functional
- Old test code may need updates to reflect new behavior

