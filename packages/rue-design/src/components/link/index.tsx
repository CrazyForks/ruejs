/* RUE_VAPOR_TRANSFORMED */
/*
Link 组件概述
- 保留 Rue 当前 link/link-* 视觉基底，同时补齐 Typography.Link 风格的文本能力。
- 支持 href/to、disabled、ellipsis、copyable、editable、文本修饰与安全外链 rel。
- to 链接在点击时复用 RouterLink 的导航逻辑，避免无 Router 环境下渲染期报错。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, ref, render as renderRue, useRef, watch } from '@rue-js/rue'
import { RouterLink } from '@rue-js/router'

/** LinkVariant 视觉或语义变体类型。 */
export type LinkVariant =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'info'
  | 'warning'
  | 'error'

/** LinkColor 语义色类型。 */
export type LinkColor = LinkVariant | 'danger'
/** LinkType 视觉或语义变体类型。 */
export type LinkType = 'secondary' | 'success' | 'warning' | 'danger'
/** LinkIconPlacement 位置或方向类型。 */
export type LinkIconPlacement = 'start' | 'end'

/** LinkCopyConfig 配置对象。 */
export interface LinkCopyConfig {
  /** text 区域配置。 */
  text?: string | (() => string | Promise<string>)
  /** onCopy 事件回调。 */
  onCopy?: (event?: MouseEvent) => void
  /** 图标内容。 */
  icon?: any
  /** tooltips 配置项。 */
  tooltips?: any
  /** format 配置项。 */
  format?: 'text/plain' | 'text/html'
  /** tabIndex 配置项。 */
  tabIndex?: number
}

/** LinkEditAutoSizeConfig 配置对象。 */
export interface LinkEditAutoSizeConfig {
  /** minRows 配置项。 */
  minRows?: number
  /** maxRows 配置项。 */
  maxRows?: number
}

/** LinkEditConfig 配置对象。 */
export interface LinkEditConfig {
  /** text 区域配置。 */
  text?: string
  /** editing 配置项。 */
  editing?: boolean
  /** 图标内容。 */
  icon?: any
  /** tooltip 配置项。 */
  tooltip?: any
  /** onStart 事件回调。 */
  onStart?: () => void
  /** 值或状态变化时触发的回调。 */
  onChange?: (value: string) => void
  /** onCancel 事件回调。 */
  onCancel?: () => void
  /** onEnd 事件回调。 */
  onEnd?: () => void
  /** maxLength 配置项。 */
  maxLength?: number
  /** autoSize 尺寸。 */
  autoSize?: boolean | LinkEditAutoSizeConfig
  /** triggerType 配置项。 */
  triggerType?: ('icon' | 'text')[]
  /** enterIcon 图标内容。 */
  enterIcon?: any
  /** tabIndex 配置项。 */
  tabIndex?: number
}

/** LinkEllipsisExpandInfo 接口。 */
export interface LinkEllipsisExpandInfo {
  /** expanded 配置项。 */
  expanded: boolean
}

/** LinkEllipsisConfig 配置对象。 */
export interface LinkEllipsisConfig {
  /** rows 配置项。 */
  rows?: number
  /** tooltip 配置项。 */
  tooltip?: boolean | string
  /** expandable 配置项。 */
  expandable?: boolean | 'collapsible'
  /** 后缀内容。 */
  suffix?: string
  /** symbol 配置项。 */
  symbol?: any | ((expanded: boolean) => any)
  /** defaultExpanded 配置项。 */
  defaultExpanded?: boolean
  /** expanded 配置项。 */
  expanded?: boolean
  /** onExpand 事件回调。 */
  onExpand?: (event: MouseEvent, info: LinkEllipsisExpandInfo) => void
  /** onEllipsis 事件回调。 */
  onEllipsis?: (ellipsis: boolean) => void
}

/** LinkProps 组件属性。 */
export interface LinkProps {
  /** 链接地址。 */
  href?: string
  /** 链接或定位目标。 */
  target?: string
  /** 链接 rel 属性。 */
  rel?: string
  /** to 配置项。 */
  to?: string
  /** replace 配置项。 */
  replace?: boolean
  /** 点击时触发的回调。 */
  onClick?: (e: MouseEvent) => void
  /** 组件视觉变体。 */
  variant?: LinkVariant
  /** 组件语义色。 */
  color?: LinkColor
  /** 组件类型或语义类型。 */
  type?: LinkType
  /** hover 配置项。 */
  hover?: boolean
  /** 是否禁用交互。 */
  disabled?: boolean
  /** ellipsis 配置项。 */
  ellipsis?: boolean | LinkEllipsisConfig
  /** copyable 配置项。 */
  copyable?: boolean | LinkCopyConfig
  /** editable 配置项。 */
  editable?: boolean | LinkEditConfig
  /** mark 配置项。 */
  mark?: boolean
  /** code 配置项。 */
  code?: boolean
  /** keyboard 配置项。 */
  keyboard?: boolean
  /** underline 配置项。 */
  underline?: boolean
  /** delete 配置项。 */
  delete?: boolean
  /** strong 配置项。 */
  strong?: boolean
  /** italic 配置项。 */
  italic?: boolean
  /** 图标内容。 */
  icon?: any
  /** iconPlacement 配置项。 */
  iconPlacement?: LinkIconPlacement
  /** block 配置项。 */
  block?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: any
  /** 标题内容。 */
  title?: string
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

interface NormalizedCopyConfig extends LinkCopyConfig {
  enabled: boolean
}

interface NormalizedEditConfig extends LinkEditConfig {
  enabled: boolean
  triggerType: ('icon' | 'text')[]
}

interface NormalizedEllipsisConfig extends LinkEllipsisConfig {
  enabled: boolean
  rows: number
  tooltip: boolean | string
  expandable: boolean | 'collapsible'
}

/** merge Class Names 的内部工具函数。 */
const mergeClassNames = (...parts: Array<string | undefined | false>) => {
  return parts.filter(Boolean).join(' ')
}

/** merge Styles 的内部工具函数。 */
const mergeStyles = (...parts: Array<Record<string, any> | undefined>) => {
  const merged: Record<string, any> = {}
  parts.forEach(part => {
    if (part) Object.assign(merged, part)
  })
  return Object.keys(merged).length > 0 ? merged : undefined
}

/** 转换为 Text 的内部工具函数。 */
const toText = (value: any): string => {
  if (value == null || value === false || value === true) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(item => toText(item)).join('')
  if (typeof value === 'object') {
    if ('props' in value && (value as any).props?.children !== undefined) {
      return toText((value as any).props.children)
    }
    if ('children' in value) return toText((value as any).children)
  }
  return ''
}

/** stop Event 的内部工具函数。 */
const stopEvent = (event?: MouseEvent | KeyboardEvent) => {
  if (!event) return
  if (typeof (event as any).preventDefault === 'function') {
    ;(event as any).preventDefault()
  }
  if (typeof (event as any).stopPropagation === 'function') {
    ;(event as any).stopPropagation()
  }
}

/** 归一化 Copy Config 的内部工具函数。 */
const normalizeCopyConfig = (copyable?: boolean | LinkCopyConfig): NormalizedCopyConfig => {
  if (!copyable) return { enabled: false }
  return typeof copyable === 'object' ? { ...copyable, enabled: true } : { enabled: true }
}

/** 归一化 Edit Config 的内部工具函数。 */
const normalizeEditConfig = (editable?: boolean | LinkEditConfig): NormalizedEditConfig => {
  if (!editable) return { enabled: false, triggerType: ['icon'] }
  const config = typeof editable === 'object' ? editable : {}
  return {
    ...config,
    enabled: true,
    triggerType: config.triggerType ?? ['icon'],
  }
}

/** 解析 Color Class 的内部工具函数。 */
const resolveColorClass = (color?: LinkColor) => {
  if (!color) return undefined
  return `link-${color === 'danger' ? 'error' : color}`
}

/** 解析 Type Class 的内部工具函数。 */
const resolveTypeClass = (type?: LinkType) => {
  switch (type) {
    case 'secondary':
      return 'text-base-content/65'
    case 'success':
      return 'link-success'
    case 'warning':
      return 'link-warning'
    case 'danger':
      return 'link-error'
    default:
      return undefined
  }
}

/** 解析 Router Href 的内部工具函数。 */
const resolveRouterHref = (to: string) => {
  const resolvedHref = RouterLink.__rueHref(to)
  if (!resolvedHref) {
    return '#/'
  }
  if (resolvedHref === to && to && !to.startsWith('#')) {
    return `#${to}`
  }
  return resolvedHref
}

/** 解析 Ellipsis 的内部工具函数。 */
const resolveEllipsis = (ellipsis?: boolean | LinkEllipsisConfig): NormalizedEllipsisConfig => {
  if (!ellipsis) {
    return { enabled: false, rows: 1, tooltip: false, expandable: false }
  }
  if (typeof ellipsis === 'object') {
    return {
      ...ellipsis,
      enabled: true,
      rows: Math.max(1, ellipsis.rows ?? 1),
      tooltip: ellipsis.tooltip ?? true,
      expandable: ellipsis.expandable ?? false,
    }
  }
  return { enabled: true, rows: 1, tooltip: true, expandable: false }
}

/** 构建 Link Class Name 的内部工具函数。 */
const buildLinkClassName = ({
  variant,
  color,
  type,
  hover,
  disabled,
  underline,
  deleted,
  strong,
  italic,
  block,
  hasIcon,
  ellipsis,
  className,
}: {
  variant?: LinkVariant
  color?: LinkColor
  type?: LinkType
  hover?: boolean
  disabled?: boolean
  underline?: boolean
  deleted?: boolean
  strong?: boolean
  italic?: boolean
  block?: boolean
  hasIcon?: boolean
  ellipsis?: { enabled: boolean }
  className?: string
}) => {
  const resolvedColor = color ?? variant
  const needsInlineLayout = hasIcon || ellipsis?.enabled
  const displayClass = block
    ? 'flex w-full items-center gap-1.5'
    : needsInlineLayout
      ? 'inline-flex max-w-full items-center gap-1.5 align-baseline'
      : undefined

  return mergeClassNames(
    'link',
    resolvedColor ? resolveColorClass(resolvedColor) : resolveTypeClass(type),
    hover ? 'link-hover' : undefined,
    disabled ? 'cursor-not-allowed opacity-45 no-underline hover:no-underline' : undefined,
    underline ? 'underline decoration-current underline-offset-4' : undefined,
    deleted ? 'line-through' : undefined,
    strong ? 'font-semibold' : undefined,
    italic ? 'italic' : undefined,
    displayClass,
    className,
  )
}

/** 构建 Ellipsis Style 的内部工具函数。 */
const buildEllipsisStyle = (rows: number) => {
  if (rows <= 1) return undefined
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: rows,
  }
}

/** 解析 Title Value 的内部工具函数。 */
const resolveTitleValue = (
  title: string | undefined,
  ellipsis: NormalizedEllipsisConfig,
  text: string,
) => {
  if (title !== undefined) return title
  if (!ellipsis.enabled || ellipsis.tooltip === false) return undefined
  if (typeof ellipsis.tooltip === 'string') return ellipsis.tooltip
  return text
}

/** 解析 Expand Symbol 的内部工具函数。 */
const resolveExpandSymbol = (ellipsis: NormalizedEllipsisConfig, expanded: boolean) => {
  if (typeof ellipsis.symbol === 'function') return ellipsis.symbol(expanded)
  if (ellipsis.symbol != null) return ellipsis.symbol
  return expanded ? '收起' : '展开'
}

/** 归一化 Rows Value 的内部工具函数。 */
const normalizeRowsValue = (autoSize?: boolean | LinkEditAutoSizeConfig) => {
  if (!autoSize) return undefined
  const config = typeof autoSize === 'object' ? autoSize : undefined
  const minRows = typeof config?.minRows === 'number' && config.minRows > 0 ? config.minRows : 2
  return String(minRows)
}

/** sync Textarea Auto Size 的内部工具函数。 */
const syncTextareaAutoSize = (
  element: HTMLTextAreaElement | undefined,
  autoSize?: boolean | LinkEditAutoSizeConfig,
) => {
  if (!element) return
  if (!autoSize) {
    element.style.height = ''
    element.style.overflowY = ''
    return
  }

  const config = typeof autoSize === 'object' ? autoSize : undefined
  const computedStyle = window.getComputedStyle(element)
  const lineHeightValue = Number.parseFloat(computedStyle.lineHeight)
  const fontSizeValue = Number.parseFloat(computedStyle.fontSize)
  const lineHeight = Number.isFinite(lineHeightValue)
    ? lineHeightValue
    : Number.isFinite(fontSizeValue)
      ? fontSizeValue * 1.5
      : 24
  const borderHeight =
    Number.parseFloat(computedStyle.borderTopWidth || '0') +
    Number.parseFloat(computedStyle.borderBottomWidth || '0')
  const paddingHeight =
    Number.parseFloat(computedStyle.paddingTop || '0') +
    Number.parseFloat(computedStyle.paddingBottom || '0')
  const minRows = typeof config?.minRows === 'number' && config.minRows > 0 ? config.minRows : 2
  const maxRows =
    typeof config?.maxRows === 'number' && config.maxRows > 0
      ? Math.max(config.maxRows, minRows)
      : undefined

  element.style.height = 'auto'
  let nextHeight = element.scrollHeight

  if (typeof minRows === 'number') {
    nextHeight = Math.max(nextHeight, minRows * lineHeight + borderHeight + paddingHeight)
  }

  if (typeof maxRows === 'number') {
    const maxHeight = maxRows * lineHeight + borderHeight + paddingHeight
    element.style.overflowY = nextHeight > maxHeight ? 'auto' : 'hidden'
    nextHeight = Math.min(nextHeight, maxHeight)
  } else {
    element.style.overflowY = 'hidden'
  }

  element.style.height = `${nextHeight}px`
}

/** read Copy Text 的内部工具函数。 */
const readCopyText = async (config: NormalizedCopyConfig, children: any) => {
  const source = config.text
  const value = typeof source === 'function' ? await source() : source
  return value ?? toText(children)
}

/** fallback Copy Text 的内部工具函数。 */
const fallbackCopyText = (text: string) => {
  if (typeof document === 'undefined') return
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand?.('copy')
  document.body.removeChild(textarea)
}

/** write Clipboard 的内部工具函数。 */
const writeClipboard = async (text: string, format?: LinkCopyConfig['format']) => {
  const clipboard = (globalThis as any).navigator?.clipboard
  if (format === 'text/html' && clipboard?.write && (globalThis as any).ClipboardItem) {
    const item = new (globalThis as any).ClipboardItem({
      'text/html': new Blob([text], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })
    await clipboard.write([item])
    return
  }
  if (clipboard?.writeText) {
    await clipboard.writeText(text)
    return
  }
  fallbackCopyText(text)
}

/** 渲染 Decorated Content 的内部工具函数。 */
const renderDecoratedContent = (
  content: any,
  {
    mark,
    code,
    keyboard,
  }: {
    mark?: boolean
    code?: boolean
    keyboard?: boolean
  },
) => {
  let node = content
  if (keyboard) {
    node = <kbd className="kbd kbd-sm align-middle">{node}</kbd>
  }
  if (code) {
    node = <code className="rounded bg-base-200 px-1.5 py-0.5 text-[0.9em]">{node}</code>
  }
  if (mark) {
    node = <mark className="rounded bg-warning/20 px-1 py-0.5 text-inherit">{node}</mark>
  }
  return node
}

/** Copy Icon 的内部工具函数。 */
const CopyIcon: FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-[1em]"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
    />
  </svg>
)

/** Check Icon 的内部工具函数。 */
const CheckIcon: FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-[1em]"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
  </svg>
)

/** Edit Icon 的内部工具函数。 */
const EditIcon: FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-[1em]"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
    />
  </svg>
)

/** Close Icon 的内部工具函数。 */
const CloseIcon: FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-[1em]"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
  </svg>
)

/** Link 的内部工具函数。 */
const Link: FC<LinkProps> = ({
  href = '#',
  target,
  rel,
  to,
  replace,
  onClick,
  variant,
  color,
  type,
  hover,
  disabled,
  ellipsis,
  copyable,
  editable,
  mark,
  code,
  keyboard,
  underline,
  delete: deleted,
  strong,
  italic,
  icon,
  iconPlacement = 'start',
  block,
  className,
  style,
  title,
  children,
  ...rest
}) => {
  const copyConfig = normalizeCopyConfig(copyable)
  const editConfig = normalizeEditConfig(editable)
  const ellipsisConfig = resolveEllipsis(ellipsis)
  const copied = ref(false)
  const uncontrolledEditing = ref(!!editConfig.editing)
  const uncontrolledExpanded = ref(!!ellipsisConfig.defaultExpanded)
  const isTextEllipsed = ref(false)
  const editValue = ref(editConfig.text ?? toText(children))
  const ellipsisTextRef = useRef<HTMLElement>()
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement>()
  const resizeObserverRef = useRef<ResizeObserver>()
  const dynamicHostRef = useRef<HTMLElement>()
  let ellipsisTimer = 0
  let copyFeedbackTimer = 0

  const hasIcon = icon != null
  const linkText = toText(children)
  const displayText = `${linkText}${ellipsisConfig.suffix ?? ''}`
  const anchorRel = target === '_blank' && !rel ? 'noopener noreferrer' : rel
  const hasInlineActions =
    !!ellipsisConfig.expandable ||
    copyConfig.enabled ||
    (editConfig.enabled && editConfig.triggerType.includes('icon'))
  const linkClassName = buildLinkClassName({
    variant,
    color,
    type,
    hover,
    disabled,
    underline,
    deleted,
    strong,
    italic,
    block,
    hasIcon,
    ellipsis: ellipsisConfig,
    className,
  })
  const titleValue = resolveTitleValue(title, ellipsisConfig, displayText)

  const setEditorRef = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
    editorRef.current = element ?? undefined
  }

  const syncEditorAutoSize = () => {
    if (!editConfig.autoSize || !(editorRef.current instanceof HTMLTextAreaElement)) return
    syncTextareaAutoSize(editorRef.current, editConfig.autoSize)
  }

  const getIsEditing = () => editConfig.editing ?? uncontrolledEditing.value

  const getIsExpanded = () => ellipsisConfig.expanded ?? uncontrolledExpanded.value

  const isEllipsisActive = () => ellipsisConfig.enabled && !getIsExpanded()

  const scheduleEditorAutoSize = () => {
    if (typeof window === 'undefined') return
    window.setTimeout(syncEditorAutoSize, 0)
  }

  const emitEllipsisChange = (nextValue: boolean) => {
    if (isTextEllipsed.value === nextValue) return
    isTextEllipsed.value = nextValue
    if (ellipsisConfig.onEllipsis) ellipsisConfig.onEllipsis(nextValue)
  }

  const syncEllipsisState = () => {
    if (!isEllipsisActive()) {
      emitEllipsisChange(false)
      return
    }
    const element = ellipsisTextRef.current
    if (!element) {
      emitEllipsisChange(false)
      return
    }

    const nextEllipsis =
      ellipsisConfig.rows > 1
        ? element.scrollHeight - element.clientHeight > 1
        : element.scrollWidth - element.clientWidth > 1

    emitEllipsisChange(nextEllipsis)
  }

  const scheduleEllipsisMeasure = () => {
    if (typeof window === 'undefined') return
    window.clearTimeout(ellipsisTimer)
    ellipsisTimer = window.setTimeout(syncEllipsisState, 0)
  }

  const renderDynamicRegion = () => {
    if (!dynamicHostRef.current) return
    renderRue(
      editConfig.enabled && getIsEditing() ? renderEditor() : renderContent(),
      dynamicHostRef.current,
    )
  }

  const setEllipsisTextRef = (element: HTMLElement | null) => {
    ellipsisTextRef.current = element ?? undefined

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
      resizeObserverRef.current = undefined
    }

    if (element && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        scheduleEllipsisMeasure()
      })
      observer.observe(element)
      resizeObserverRef.current = observer
    }

    scheduleEllipsisMeasure()
  }

  const startEdit = (event?: MouseEvent) => {
    if (disabled) return
    stopEvent(event)
    editValue.value = editConfig.text ?? linkText
    if (editConfig.onStart) editConfig.onStart()
    if (editConfig.editing === undefined) uncontrolledEditing.value = true
    renderDynamicRegion()
    scheduleEditorAutoSize()
  }

  const cancelEdit = (event?: MouseEvent | KeyboardEvent) => {
    stopEvent(event)
    if (editConfig.onCancel) editConfig.onCancel()
    if (editConfig.editing === undefined) uncontrolledEditing.value = false
    renderDynamicRegion()
  }

  const finishEdit = (event?: MouseEvent | KeyboardEvent) => {
    stopEvent(event)
    if (editConfig.onChange) editConfig.onChange(editValue.value)
    if (editConfig.onEnd) editConfig.onEnd()
    if (editConfig.editing === undefined) uncontrolledEditing.value = false
    renderDynamicRegion()
  }

  const toggleExpanded = (event: MouseEvent) => {
    stopEvent(event)
    const canCollapse = ellipsisConfig.expandable === 'collapsible'
    const expanded = getIsExpanded()
    const nextExpanded = expanded ? (canCollapse ? false : true) : true
    if (nextExpanded === expanded) return
    if (ellipsisConfig.onExpand) ellipsisConfig.onExpand(event, { expanded: nextExpanded })
    if (ellipsisConfig.expanded === undefined) uncontrolledExpanded.value = nextExpanded
    renderDynamicRegion()
    scheduleEllipsisMeasure()
  }

  const handleBaseClick = (event: MouseEvent) => {
    if (disabled) {
      stopEvent(event)
      return
    }
    if (editConfig.enabled && editConfig.triggerType.includes('text')) {
      startEdit(event)
      return
    }
    if (onClick) onClick(event)
  }

  const handleRouterClick = (event: MouseEvent) => {
    handleBaseClick(event)
    if (
      disabled ||
      event.defaultPrevented ||
      target === '_blank' ||
      editConfig.triggerType.includes('text')
    ) {
      return
    }
    RouterLink.__rueOnClick(event, to, replace)
  }

  const handleCopyClick = (event: MouseEvent) => {
    if (disabled) {
      stopEvent(event)
      return
    }

    stopEvent(event)
    readCopyText(copyConfig, children)
      .then(text => writeClipboard(String(text), copyConfig.format))
      .then(() => {
        copied.value = true
        if (copyConfig.onCopy) copyConfig.onCopy(event)
        renderDynamicRegion()
        if (typeof window !== 'undefined') {
          window.clearTimeout(copyFeedbackTimer)
          copyFeedbackTimer = window.setTimeout(() => {
            copied.value = false
            renderDynamicRegion()
          }, 1500)
        }
      })
  }

  onMounted(() => {
    renderDynamicRegion()
    scheduleEllipsisMeasure()
    scheduleEditorAutoSize()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', scheduleEllipsisMeasure)
    }
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.clearTimeout(ellipsisTimer)
      window.clearTimeout(copyFeedbackTimer)
      window.removeEventListener('resize', scheduleEllipsisMeasure)
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
      resizeObserverRef.current = undefined
    }
  })

  watch(
    () => [
      linkText,
      ellipsisConfig.rows,
      ellipsisConfig.expandable,
      ellipsisConfig.expanded,
      uncontrolledExpanded.value,
      getIsEditing(),
    ],
    () => {
      scheduleEllipsisMeasure()
      scheduleEditorAutoSize()
    },
    { immediate: true },
  )

  watch(
    () => [editValue.value, editConfig.autoSize],
    () => {
      scheduleEditorAutoSize()
    },
    { immediate: true },
  )

  const renderEditor = () => {
    const editorClassName = editConfig.autoSize
      ? 'textarea textarea-bordered textarea-sm min-h-24 min-w-56 leading-6'
      : 'input input-bordered input-xs min-w-36'

    return (
      <span
        className={mergeClassNames(
          block
            ? 'flex w-full items-start gap-1 align-middle'
            : 'inline-flex max-w-full items-start gap-1 align-middle',
        )}
      >
        {editConfig.autoSize ? (
          <textarea
            ref={setEditorRef}
            data-rue-link-editor="true"
            className={editorClassName}
            value={editValue.value}
            rows={normalizeRowsValue(editConfig.autoSize)}
            maxLength={editConfig.maxLength}
            autoFocus
            onInput={(event: Event) => {
              editValue.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
              syncEditorAutoSize()
            }}
            onKeyDown={(event: KeyboardEvent) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') finishEdit(event)
              if (event.key === 'Escape') cancelEdit(event)
            }}
          />
        ) : (
          <input
            ref={setEditorRef}
            data-rue-link-editor="true"
            className={editorClassName}
            value={editValue.value}
            maxLength={editConfig.maxLength}
            autoFocus
            onInput={(event: Event) => {
              editValue.value = (event.target as HTMLInputElement | null)?.value ?? ''
            }}
            onKeyDown={(event: KeyboardEvent) => {
              if (event.key === 'Enter') finishEdit(event)
              if (event.key === 'Escape') cancelEdit(event)
            }}
          />
        )}
        <button
          type="button"
          data-rue-link-edit-confirm="true"
          className="btn btn-ghost btn-xs"
          aria-label="确认编辑"
          onClick={(event: MouseEvent) => finishEdit(event as any)}
        >
          {editConfig.enterIcon ?? <CheckIcon />}
        </button>
        <button
          type="button"
          data-rue-link-edit-cancel="true"
          className="btn btn-ghost btn-xs"
          aria-label="取消编辑"
          onClick={(event: MouseEvent) => cancelEdit(event as any)}
        >
          <CloseIcon />
        </button>
      </span>
    )
  }

  const renderTextNode = () => {
    const decoratedContent = renderDecoratedContent(children, { mark, code, keyboard })

    if (!ellipsisConfig.enabled) {
      return <span className="min-w-0">{decoratedContent}</span>
    }

    const textClassName =
      ellipsisConfig.rows > 1
        ? 'min-w-0 max-w-full overflow-hidden align-bottom'
        : 'min-w-0 max-w-full truncate align-bottom'
    const textStyle = buildEllipsisStyle(ellipsisConfig.rows)

    if (ellipsisConfig.rows === 1 && ellipsisConfig.suffix) {
      return (
        <span className="inline-flex min-w-0 max-w-full items-baseline align-bottom">
          <span
            ref={setEllipsisTextRef}
            className={textClassName}
            style={mergeStyles(textStyle, { minWidth: 0 })}
            title={titleValue}
          >
            {decoratedContent}
          </span>
          <span className="shrink-0">{ellipsisConfig.suffix}</span>
        </span>
      )
    }

    return (
      <span ref={setEllipsisTextRef} className={textClassName} style={textStyle} title={titleValue}>
        {decoratedContent}
        {ellipsisConfig.suffix ? <span>{ellipsisConfig.suffix}</span> : null}
      </span>
    )
  }

  const renderAnchor = () => {
    const textNode = renderTextNode()
    const iconNode = hasIcon ? (
      <span className="inline-flex shrink-0 items-center" aria-hidden="true">
        {icon}
      </span>
    ) : null
    const anchorChildren =
      iconPlacement === 'end' ? (
        <>
          {textNode}
          {iconNode}
        </>
      ) : (
        <>
          {iconNode}
          {textNode}
        </>
      )

    const anchorStyle = ellipsisConfig.enabled ? mergeStyles(style, { minWidth: 0 }) : style

    if (disabled) {
      return (
        <span
          {...rest}
          role={rest.role ?? 'link'}
          className={linkClassName}
          style={anchorStyle}
          title={!ellipsisConfig.enabled ? titleValue : undefined}
          aria-disabled="true"
          onClick={handleBaseClick}
        >
          {anchorChildren}
        </span>
      )
    }

    if (to) {
      return (
        <a
          {...rest}
          href={resolveRouterHref(to)}
          target={target}
          rel={anchorRel}
          className={linkClassName}
          style={anchorStyle}
          title={!ellipsisConfig.enabled ? titleValue : undefined}
          tabIndex={rest.tabIndex}
          tabindex={rest.tabIndex}
          onClick={handleRouterClick}
        >
          {anchorChildren}
        </a>
      )
    }

    return (
      <a
        {...rest}
        href={href}
        target={target}
        rel={anchorRel}
        className={linkClassName}
        style={anchorStyle}
        title={!ellipsisConfig.enabled ? titleValue : undefined}
        tabIndex={rest.tabIndex}
        tabindex={rest.tabIndex}
        onClick={handleBaseClick}
      >
        {anchorChildren}
      </a>
    )
  }

  const renderContent = () => {
    const anchor = renderAnchor()
    const showExpandButton =
      !!ellipsisConfig.expandable &&
      (!getIsExpanded() || ellipsisConfig.expandable === 'collapsible')

    if (!hasInlineActions && !showExpandButton) {
      return anchor
    }

    return (
      <span
        className={mergeClassNames(
          block
            ? 'flex w-full flex-wrap items-start gap-1 align-baseline'
            : 'inline-flex max-w-full flex-wrap items-start gap-1 align-baseline',
        )}
      >
        {anchor}
        {showExpandButton ? (
          <button
            type="button"
            data-rue-link-expand="true"
            className="link link-hover text-xs no-underline opacity-70"
            aria-label={getIsExpanded() ? '收起全文' : '展开全文'}
            onClick={toggleExpanded}
          >
            {resolveExpandSymbol(ellipsisConfig, getIsExpanded())}
          </button>
        ) : null}
        {copyConfig.enabled ? (
          <button
            type="button"
            data-rue-link-copy="true"
            className="btn btn-ghost btn-xs"
            aria-label={copied.value ? '已复制' : '复制链接文本'}
            title={copyConfig.tooltips ?? (copied.value ? '已复制' : '复制')}
            tabIndex={copyConfig.tabIndex}
            disabled={disabled}
            onClick={handleCopyClick}
          >
            {copied.value ? '✓' : (copyConfig.icon ?? <CopyIcon />)}
          </button>
        ) : null}
        {editConfig.enabled && editConfig.triggerType.includes('icon') ? (
          <button
            type="button"
            data-rue-link-edit="true"
            className="btn btn-ghost btn-xs"
            aria-label="编辑链接文本"
            title={editConfig.tooltip ?? '编辑'}
            tabIndex={editConfig.tabIndex}
            disabled={disabled}
            onClick={(event: MouseEvent) => startEdit(event as any)}
          >
            {editConfig.icon ?? <EditIcon />}
          </button>
        ) : null}
      </span>
    )
  }

  return (
    <span
      className="contents"
      ref={(element: HTMLElement | null) => {
        dynamicHostRef.current = element ?? undefined
        if (element) {
          renderDynamicRegion()
        }
      }}
    />
  )
}

/** 默认导出链接组件。 */
export default Link
