# Otterflow bib 引用预览实现计划

## 目标
在 Otterflow 中实现类似 deertube 的 bib/citation 小窗预览：当用户在聊天或 Markdown 内容中 hover（必要时 click）某个引用时，弹出一个小窗，展示该引用对应的标题、来源、摘要/摘录及定位信息。

## 现状对照

### deertube 的具体做法
1. Markdown 渲染入口：`deertube/src/components/markdown/renderer.tsx`
   - `MarkdownRenderer` 接收 `resolveReferencePreview`。
   - 重写 `a` 渲染；当链接是 `deertube://...` 时，在 `onMouseEnter` 触发 `showReferenceTooltip(...)`。
   - 使用 `referencePreviewCacheRef`、`referencePreviewTokenRef` 和 `ReferenceTooltipState` 管理缓存、竞态与 loading 状态。
   - 通过 `createPortal(...)` 渲染固定定位 tooltip，并自定义 hide delay、滚轮滚动与 viewport 边界定位。
2. 数据解析入口：`deertube/src/components/FlowWorkspace.tsx`
   - `resolveReferencePreview` -> `resolveBrowserReference` -> `trpc.deepSearch.resolveReference.mutate(...)`
   - 返回 `title`、`url`、`text`、`startLine`、`endLine`
   - `stripLineNumberPrefix()` 会去掉 `1 | ...` 这类行号前缀
3. 调用链路：`deertube/src/components/chat/ChatHistoryPanel.tsx`
   - `MarkdownRenderer` 通过 `resolveReferencePreview={onResolveReferencePreview}` 接入预览数据解析能力

### Otterflow 当前状态
1. Markdown 主渲染链路：`Otterflow/app/src/renderer/src/pages/chat/components/chat/assistant-content-renderer.tsx` -> `Otterflow/app/src/renderer/src/components/markdown/renderer.tsx`
   - `MdxRenderer` 使用 `react-markdown` + `remark-gfm` + `remark-math`
2. 自定义 markdown 组件：`Otterflow/app/src/renderer/src/components/markdown/components/mdx-components.tsx`
   - 目前只改写了 `a`、`pre`、`ol`、`ul`、`table`，没有 citation 逻辑
3. 可复用弹层 primitive：`Otterflow/app/src/renderer/src/components/ui/hover-card.tsx` 与 `Otterflow/app/src/renderer/src/components/ui/popover.tsx`
   - 已有 Radix HoverCard/Popover，可直接复用，不必照搬 deertube 的手写 portal/定位逻辑
4. 现有“引用块”近似方案：`Otterflow/app/src/renderer/src/pages/chat/components/chat/part-renderer.tsx`
   - `QuoteBlock` 只对 `<quote_latex>...</quote_latex>` 做 `title` tooltip；它不在 `MdxRenderer` 主链路，也不支持 bib 解析
5. 数据模型现状：
   - `Otterflow/schema/core.yml` 已定义 `Annotation`、`FileCitation`、`UrlCitation`、`MessageContentText...annotations`
   - 但当前前端没有消费 `annotations` 的实现
   - 当前聊天 UI 里传给渲染器的 `TextUIPart` 只有 `text: string`，没有 citation metadata

## 推荐方案
推荐走“deertube 的 link interception 思路 + Otterflow 的 HoverCard primitive”，不要直接复制 deertube 的手写 portal。

### Phase 1：建立 citation 解析与渲染骨架
1. 在 `Otterflow/app/src/renderer/src/components/markdown/` 下新增 citation 预处理或 remark 插件
   - 识别 `\cite{key}`、`\citep{key}`、`\citet{key}`，以及多 key（如 `\citep{a,b}`）
   - 将其转换成可被 `react-markdown` 的 `a` 组件拦截的 link 节点，例如 `href="otterflow-cite:key"` 或 `href="otterflow-cite:key1,key2"`
   - 初期可保留原始显示文本，确保正文渲染不被破坏
2. 在 `mdx-components.tsx` 的 `a` 渲染中新增 `otterflow-cite:` 分支
   - 普通 http/https 链接维持原行为
   - citation 链接交给 `CitationTrigger` 组件

### Phase 2：实现预览组件
1. 新增 `CitationTrigger` / `CitationPreviewCard` 组件
2. 优先使用 `HoverCard`
   - hover 打开
   - 支持 loading / not found / ready 三态
   - 使用 Radix 自带 portal 和定位能力，避免手写 `createPortal + fixed positioning`
3. 卡片信息建议对齐 deertube，但内容更贴近 bib
   - 标题
   - authors / year
   - venue / journal / url / doi
   - abstract 或 snippet
   - 可选：关联文件、页码、行号

### Phase 3：打通数据来源
建议分两层推进，先易后稳。

#### 路线 A（建议先落地的前端 POC）
- 给 `MdxRenderer` 增加 `resolveCitationPreview?: (keys: string[]) => Promise<CitationPreview[] | null>` 或 `citationPreviewMap`
- 由 `AssistantContentRenderer`、`SubagentContent`、`MarkdownPreviewer` 向下透传
- 如果项目上下文里已经有 bibliography/bib 数据，可在这里做 key -> entry 查找
- 适合先把交互和 UI 跑通

#### 路线 B（更稳的正式方案）
- 让后端或模型输出携带结构化 citation metadata，而不是只靠 regex 扫描纯文本
- 优先复用现有 `annotations` 协议（`schema/core.yml` 已定义）
- 在前端把 annotation span 映射为 citation trigger，避免字符串正则在 streaming、多语言和复杂 markdown 下失真
- 如果未来支持 URL citation / file citation，这一层也可以直接复用

### Phase 4：覆盖 Otterflow 的实际入口
至少要覆盖：
- `assistant-content-renderer.tsx`
- `subagent-content.tsx`
- `MarkdownPreviewer.tsx`

如果只改 chat 主消息，其他 markdown 视图会行为不一致。

## 关键设计决策
1. 触发载体
   - deertube 的触发载体是 `deertube://` 链接
   - Otterflow 当前没有 bib 链接，因此要先把 `\cite...{}` 变成可拦截的 citation link/node
2. 弹层实现
   - deertube 用自写 portal/positioning，是因为它直接在 `MarkdownRenderer` 内处理 `deertube://` 引用
   - Otterflow 已有 `HoverCard/Popover`；优先复用，只有在 hover 稳定性或滚动体验不够时才 fallback 到自写 portal
3. 数据源
   - 没有 citation metadata，就只能预览占位 key，用户体验会很差
   - 因此 UI 改造和数据协议需要一起规划，至少要有 key -> bib entry 的 resolver
4. 渐进式交付
   - POC：remark/预处理 + HoverCard + local resolver
   - 正式版：annotations / structured citation payload

## 具体任务拆分
1. 梳理并确认 Otterflow 中 bib 数据的真实来源（`.bib`、后端响应、project metadata，还是模型附带数据）
2. 设计 `CitationPreview` 类型，例如：
   - `key`
   - `title`
   - `authors`
   - `year`
   - `source`
   - `url`
   - `snippet`
   - `locator`
3. 实现 `remark-citation-link`（或等价预处理器），把 `\cite*{}` 转成内部 citation 节点或链接
4. 扩展 `MdxRendererProps`，增加 citation resolver 或 map
5. 实现 `CitationTrigger` + `CitationPreviewCard`
6. 将 citation 组件接入三处 markdown 入口
7. 处理 streaming 更新、missing key、multi-cite、hover 到卡片区域不中断等边界
8. 补充验证用例

## 验证清单
- `\citep{foo}` 能 hover 出卡片
- `\citep{foo,bar}` 能展示多条或聚合预览
- 无匹配 entry 时优雅降级，不影响正文显示
- 普通外链、代码块、表格不受影响
- Chat / subagent / markdown preview 三处一致
- 深色/浅色主题正常
- 键盘 focus 和 click fallback 可用

## 风险与注意事项
- 仅靠正则直接处理纯文本 citation，容易在 streaming 和复杂 markdown 场景误判
- `quote_latex` 方案虽然已有 tooltip，但它不在 markdown 主链路，不适合直接扩成 bib 预览主方案
- 若 bibliography 数据仍未进入前端，应该先补 resolver/contract，再做 UI
