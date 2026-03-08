import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { StateField, StateEffect, Extension, RangeSet } from '@codemirror/state'
import { DiffEntry } from '../../ide-react/context/suggested-changes-context'

// State effect: update suggested changes diffs
export const updateSuggestedChangesEffect = StateEffect.define<{
  diffs: DiffEntry[]
  onAccept?: (changeId: string) => void
  onRevert?: (changeId: string) => void
}>()

// Suggested changes decorations state field
const suggestedChangesField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)

    for (const effect of tr.effects) {
      if (effect.is(updateSuggestedChangesEffect)) {
        decorations = buildSuggestedChangesDecorations(
          effect.value.diffs,
          effect.value.onAccept,
          effect.value.onRevert
        )
      }
    }

    return decorations
  },
  provide: f => EditorView.decorations.from(f),
})

// Widget showing the user's original text (that was replaced in real document)
class UserTextWidget extends WidgetType {
  constructor(
    private text: string,
    private changeId: string
  ) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'ol-cm-user-text ol-cm-suggested-change-hoverable'
    span.textContent = this.text
    span.setAttribute('data-change-id', this.changeId)
    span.style.cssText = `
      text-decoration: line-through;
      background-color: #ffebee;
      color: #c62828;
      padding: 1px 2px;
      border-radius: 2px;
      border: 1px solid #ffcdd2;
      cursor: pointer;
    `
    return span
  }

  eq(other: UserTextWidget) {
    return this.text === other.text && this.changeId === other.changeId
  }

  ignoreEvent() {
    return false
  }
}

// Suggested change hover button widget
class SuggestedChangeWidget extends WidgetType {
  constructor(
    private diff: DiffEntry,
    private onAccept: (changeId: string) => void,
    private onRevert: (changeId: string) => void,
    private view: EditorView
  ) {
    super()
  }

  toDOM() {
    // 检测修改位置是否在前三行
    const isInTopThreeLines = this.isInTopThreeLines()

    const container = document.createElement('div')
    container.className = 'ol-cm-suggested-change-widget'
    container.setAttribute('data-widget-change-id', this.diff.id)

    // 根据位置调整弹出方向
    if (isInTopThreeLines) {
      container.setAttribute('data-top-three-lines', 'true')
    }

    container.style.cssText = `
      text-indent: 0;
      overflow: hidden;
      display: none !important;
      position: absolute !important;
      align-items: center !important;
      background-color: #f5f5f5 !important;
      border: 1px solid #ddd !important;
      border-radius: 4px !important;
      padding: 4px 8px !important;
      margin: 2px !important;
      font-size: 12px !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
      z-index: 1000 !important;
      left: 0 !important;
      pointer-events: auto !important;
    `

    // Mouse event listeners
    container.addEventListener('mouseenter', () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }
      container.style.display = 'inline-flex'
      container.setAttribute('data-hover-active', 'true')
      currentVisibleWidget = container
    })

    container.addEventListener('mouseleave', () => {
      hideTimeout = window.setTimeout(() => {
        if (currentVisibleWidget === container) {
          container.style.display = 'none'
          container.removeAttribute('data-hover-active')
          currentVisibleWidget = null
        }
        hideTimeout = null
      }, 200)
    })

    const content = document.createElement('div')
    content.className = 'ol-cm-suggested-change-content'
    content.style.marginRight = '8px'

    // Show user text (original) and real text (suggested)
    const userSpan = document.createElement('span')
    userSpan.className = 'ol-cm-suggested-change-original'
    userSpan.textContent = this.diff.userText || '(deleted)'
    userSpan.style.cssText = 'color: #c62828;'

    const arrow = document.createElement('span')
    arrow.className = 'ol-cm-suggested-change-arrow'
    arrow.textContent = ' → '
    arrow.style.cssText = 'color: #666; font-weight: bold;'

    const realSpan = document.createElement('span')
    realSpan.className = 'ol-cm-suggested-change-suggested'
    realSpan.textContent = this.diff.realText || '(none)'
    realSpan.style.cssText = 'color: #2e7d32'

    content.appendChild(userSpan)
    content.appendChild(arrow)
    content.appendChild(realSpan)

    // Buttons container
    const buttons = document.createElement('div')
    buttons.className = 'ol-cm-suggested-change-buttons'
    buttons.style.cssText = 'display: flex; gap: 4px;'

    const acceptBtn = document.createElement('button')
    acceptBtn.className = 'ol-cm-suggested-change-accept'
    acceptBtn.textContent = '✓'
    acceptBtn.title = 'Accept change (sync to user document)'
    acceptBtn.style.cssText = `
      border: none !important;
      border-radius: 2px !important;
      padding: 2px 6px !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: bold !important;
      background-color: #4caf50 !important;
      color: white !important;
    `
    acceptBtn.onclick = e => {
      e.preventDefault()
      e.stopPropagation()
      this.onAccept(this.diff.id)
    }

    const revertBtn = document.createElement('button')
    revertBtn.className = 'ol-cm-suggested-change-reject'
    revertBtn.textContent = '✗'
    revertBtn.title = 'Revert change (restore user document)'
    revertBtn.style.cssText = `
      border: none !important;
      border-radius: 2px !important;
      padding: 2px 6px !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: bold !important;
      background-color: #f44336 !important;
      color: white !important;
    `
    revertBtn.onclick = e => {
      e.preventDefault()
      e.stopPropagation()
      this.onRevert(this.diff.id)
    }

    buttons.appendChild(acceptBtn)
    buttons.appendChild(revertBtn)
    container.appendChild(content)
    container.appendChild(buttons)

    return container
  }

  eq(other: SuggestedChangeWidget) {
    return JSON.stringify(this.diff) === JSON.stringify(other.diff)
  }

  get estimatedHeight() {
    return 40
  }

  ignoreEvent() {
    return false
  }

  // 检测修改位置是否在前三行
  private isInTopThreeLines(): boolean {
    try {
      const doc = this.view.state.doc
      const line = doc.lineAt(this.diff.realFrom)
      return line.number <= 3
    } catch (error) {
      // 如果获取行号失败，默认返回false（在上方显示）
      return false
    }
  }
}

// Build suggested changes decorations based on diffs
function buildSuggestedChangesDecorations(
  diffs: DiffEntry[],
  onAccept?: (changeId: string) => void,
  onRevert?: (changeId: string) => void
): DecorationSet {
  const decorations: any[] = []

  for (const diff of diffs) {
    // Real document positions (where the decoration appears in CodeMirror)
    const realFrom = Math.max(0, diff.realFrom)
    const realTo = Math.max(realFrom, diff.realTo)

    // Mark the real text (what's currently in the document) as "suggested"
    if (realFrom < realTo) {
      decorations.push(
        Decoration.mark({
          class:
            'ol-cm-suggested-change-insert ol-cm-suggested-change-hoverable',
          attributes: {
            'data-change-id': diff.id,
          },
        }).range(realFrom, realTo)
      )
    }

    // Show the user's original text as a widget (strike-through)
    if (diff.userText) {
      decorations.push(
        Decoration.widget({
          widget: new UserTextWidget(diff.userText, diff.id),
          side: -1,
        }).range(realFrom)
      )
    }

    // Add hover control buttons
    if (onAccept && onRevert && currentView) {
      decorations.push(
        Decoration.widget({
          widget: new SuggestedChangeWidget(
            diff,
            onAccept,
            onRevert,
            currentView
          ),
          side: 1,
          block: false,
        }).range(Math.max(realFrom, realTo))
      )
    }
  }

  return RangeSet.of(decorations, true)
}

// CSS 样式主题
const suggestedChangesTheme = EditorView.baseTheme({
  '.ol-cm-suggested-change-delete': {
    textDecoration: 'line-through',
    backgroundColor: '#ffebee',
    color: '#c62828',
    position: 'relative',
    cursor: 'pointer',
  },

  '.ol-cm-suggested-change-insert': {
    backgroundColor: '#e8f5e8',
    color: '#2e7d32',
    fontWeight: 'bold',
    padding: '1px 2px',
    borderRadius: '2px',
    border: '1px solid #c8e6c9',
    position: 'relative',
    cursor: 'pointer',
  },

  '.ol-cm-suggested-change-hoverable:hover': {
    backgroundColor: '#fff3e0 !important',
    outline: '2px solid #ff9800',
  },

  '.ol-cm-suggested-change-widget': {
    display: 'none',
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '4px 8px',
    margin: '2px',
    fontSize: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    zIndex: '1000',
    top: '-35px',
    left: '0',
    transition: 'opacity 0.2s ease-in-out',
    opacity: '0',
  },

  // 前三行的修改弹出在下方
  '.ol-cm-suggested-change-widget[data-top-three-lines="true"]': {
    top: '0px',
  },

  '.ol-cm-suggested-change-widget[data-hover-active="true"]': {
    opacity: '1',
  },

  '.ol-cm-suggested-change-content': {
    marginRight: '8px',
  },

  '.ol-cm-suggested-change-original': {
    textDecoration: 'line-through',
    color: '#c62828',
  },

  '.ol-cm-suggested-change-arrow': {
    color: '#666',
    fontWeight: 'bold',
  },

  '.ol-cm-suggested-change-suggested': {
    color: '#2e7d32',
    fontWeight: 'bold',
  },

  '.ol-cm-suggested-change-buttons': {
    display: 'flex',
    gap: '4px',
  },

  '.ol-cm-suggested-change-accept, .ol-cm-suggested-change-reject': {
    border: 'none',
    borderRadius: '2px',
    padding: '2px 6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },

  '.ol-cm-suggested-change-accept': {
    backgroundColor: '#4caf50',
    color: 'white',
    '&:hover': {
      backgroundColor: '#45a049',
    },
  },

  '.ol-cm-suggested-change-reject': {
    backgroundColor: '#f44336',
    color: 'white',
    '&:hover': {
      backgroundColor: '#da190b',
    },
  },
})

// 存储当前显示的按钮，用于管理显示状态
let currentVisibleWidget: HTMLElement | null = null
let hideTimeout: number | null = null
// 存储当前的 view 实例
let currentView: EditorView | null = null

// 鼠标悬停事件处理扩展
const hoverExtension = EditorView.domEventHandlers({
  mouseover(event, view) {
    const target = event.target as HTMLElement

    // 检查是否悬停在建议修改文本上
    if (target.classList.contains('ol-cm-suggested-change-hoverable')) {
      const changeId = target.getAttribute('data-change-id')
      if (changeId) {
        const widget = view.dom.querySelector(
          `[data-widget-change-id="${changeId}"]`
        ) as HTMLElement
        if (widget) {
          // 清除之前的隐藏定时器
          if (hideTimeout) {
            clearTimeout(hideTimeout)
            hideTimeout = null
          }

          // 隐藏之前显示的按钮
          if (currentVisibleWidget && currentVisibleWidget !== widget) {
            currentVisibleWidget.style.display = 'none'
            currentVisibleWidget.removeAttribute('data-hover-active')
          }

          // 显示当前按钮
          widget.style.display = 'inline-flex'
          widget.setAttribute('data-hover-active', 'true')
          currentVisibleWidget = widget
        }
      }
    }
  },

  mouseout(event, view) {
    const target = event.target as HTMLElement
    const relatedTarget = event.relatedTarget as HTMLElement

    // 检查是否从建议修改文本移出
    if (target.classList.contains('ol-cm-suggested-change-hoverable')) {
      const changeId = target.getAttribute('data-change-id')
      if (changeId) {
        const widget = view.dom.querySelector(
          `[data-widget-change-id="${changeId}"]`
        ) as HTMLElement
        if (widget && relatedTarget && !widget.contains(relatedTarget)) {
          // 延迟隐藏，给用户时间移动到按钮上
          hideTimeout = window.setTimeout(() => {
            if (currentVisibleWidget === widget) {
              widget.style.display = 'none'
              widget.removeAttribute('data-hover-active')
              currentVisibleWidget = null
            }
            hideTimeout = null
          }, 200)
        }
      }
    }
  },
})

// Create suggested changes extension
export function suggestedChanges(
  diffs: DiffEntry[] = [],
  onAccept?: (changeId: string) => void,
  onRevert?: (changeId: string) => void
): Extension {
  return [
    suggestedChangesField.init(() =>
      buildSuggestedChangesDecorations(diffs, onAccept, onRevert)
    ),
    suggestedChangesTheme,
    hoverExtension,
    // ViewPlugin to provide view context for widgets
    EditorView.updateListener.of(update => {
      if (update.view) {
        // Store view reference for use in widgets
        currentView = update.view
      }
    }),
  ]
}

// Update suggested changes helper function
export function updateSuggestedChanges(
  view: EditorView,
  diffs: DiffEntry[],
  onAccept?: (changeId: string) => void,
  onRevert?: (changeId: string) => void
) {
  view.dispatch({
    effects: updateSuggestedChangesEffect.of({
      diffs,
      onAccept,
      onRevert,
    }),
  })
}
