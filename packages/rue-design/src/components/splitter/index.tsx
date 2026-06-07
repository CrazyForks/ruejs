/* RUE_VAPOR_TRANSFORMED */
/*
Splitter 组件概述
- 通过 DOM 驱动的方式管理面板尺寸，适配 Rue 当前对子组件 children 的运行时表示。
- Panel 直接输出真实面板节点，根组件在挂载后读取 direct child 面板元信息，统一处理拖拽、折叠与尺寸约束。
- 使用 h(...) 构建节点，避开当前 JSX 变换链对新文件的错误导入路径。
*/
import type { FC } from '@rue-js/rue'
import { h, onMounted, onUnmounted, render as renderRue, useRef } from '@rue-js/rue'

/** SplitterOrientation 类型。 */
export type SplitterOrientation = 'horizontal' | 'vertical'
/** SplitterSize 尺寸类型。 */
export type SplitterSize = number | string
/** SplitterCollapsibleIconMode 类型。 */
export type SplitterCollapsibleIconMode = boolean | 'auto'

/** SplitterCollapsibleConfig 配置对象。 */
export interface SplitterCollapsibleConfig {
  /** start 配置项。 */
  start?: boolean
  /** end 配置项。 */
  end?: boolean
  /** showCollapsibleIcon 图标内容。 */
  showCollapsibleIcon?: SplitterCollapsibleIconMode
}

/** SplitterProps 组件属性。 */
export interface SplitterProps {
  /** orientation 配置项。 */
  orientation?: SplitterOrientation
  /** layout 配置项。 */
  layout?: SplitterOrientation
  /** vertical 配置项。 */
  vertical?: boolean
  /** lazy 配置项。 */
  lazy?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: any
  /** draggerIcon 图标内容。 */
  draggerIcon?: any
  /** collapsibleIcon 图标内容。 */
  collapsibleIcon?: {
    start?: any
    end?: any
  }
  /** onDraggerDoubleClick 事件回调。 */
  onDraggerDoubleClick?: (index: number) => void
  /** onResizeStart 事件回调。 */
  onResizeStart?: (sizes: number[]) => void
  /** onResize 事件回调。 */
  onResize?: (sizes: number[]) => void
  /** onResizeEnd 事件回调。 */
  onResizeEnd?: (sizes: number[]) => void
  /** onCollapse 事件回调。 */
  onCollapse?: (collapsed: boolean[], sizes: number[]) => void
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** SplitterPanelProps 组件属性。 */
export interface SplitterPanelProps {
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: any
  /** min 配置项。 */
  min?: SplitterSize
  /** max 配置项。 */
  max?: SplitterSize
  /** 组件尺寸。 */
  size?: SplitterSize
  /** defaultSize 尺寸。 */
  defaultSize?: SplitterSize
  /** resizable 配置项。 */
  resizable?: boolean
  /** collapsible 配置项。 */
  collapsible?: boolean | SplitterCollapsibleConfig
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

interface PanelConstraint {
  min: number
  max: number
}

interface NormalizedCollapsibleConfig {
  start: boolean
  end: boolean
  show: boolean
}

interface PanelConfig {
  min?: SplitterSize
  max?: SplitterSize
  size?: SplitterSize
  defaultSize?: SplitterSize
  resizable: boolean
  collapsible: NormalizedCollapsibleConfig
}

interface DragState {
  index: number
  startPoint: number
  startSizes: number[]
  availableSize: number
}

interface HandleRecord {
  root: HTMLDivElement
  previousButton?: HTMLButtonElement
  nextButton?: HTMLButtonElement
  draggerHost: HTMLSpanElement
  previousIconHost?: HTMLSpanElement
  nextIconHost?: HTMLSpanElement
}

/** EPSILON 内部常量。 */
const EPSILON = 0.5
/** HANDLE_SIZE 内部常量。 */
const HANDLE_SIZE = 10

/** clamp 的内部工具函数。 */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

/** 归一化 Css Length 的内部工具函数。 */
const normalizeCssLength = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value}px` : value

/** 归一化 Root Style 的内部工具函数。 */
const normalizeRootStyle = (style: any) => {
  if (!style || typeof style !== 'object' || Array.isArray(style)) {
    return undefined
  }

  return {
    ...style,
    width: normalizeCssLength(style.width),
    minWidth: normalizeCssLength(style.minWidth),
    maxWidth: normalizeCssLength(style.maxWidth),
    height: normalizeCssLength(style.height),
    minHeight: normalizeCssLength(style.minHeight),
    maxHeight: normalizeCssLength(style.maxHeight),
  }
}

/** 转换为 Child Array 的内部工具函数。 */
const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  if (children == null || typeof children === 'boolean') {
    return []
  }
  return [children]
}

/** serialize Sizes 的内部工具函数。 */
const serializeSizes = (sizes: number[]) => sizes.map(size => Math.max(0, Math.round(size)))

/** sum Sizes 的内部工具函数。 */
const sumSizes = (sizes: number[]) => sizes.reduce((total, size) => total + size, 0)

/** scale Sizes To Target 的内部工具函数。 */
const scaleSizesToTarget = (sizes: number[], target: number) => {
  const total = sumSizes(sizes)
  if (target <= 0 || total <= EPSILON) return sizes.slice()
  const ratio = target / total
  return sizes.map(size => size * ratio)
}

/** arrays Almost Equal 的内部工具函数。 */
const arraysAlmostEqual = (left: number[], right: number[]) => {
  if (left.length !== right.length) return false
  return left.every((value, index) => Math.abs(value - right[index]) <= EPSILON)
}

/** 解析 Orientation 的内部工具函数。 */
const resolveOrientation = (
  orientation?: SplitterOrientation,
  layout?: SplitterOrientation,
  vertical?: boolean,
): SplitterOrientation => {
  if (orientation) return orientation
  if (layout) return layout
  return vertical ? 'vertical' : 'horizontal'
}

/** parse Size To Pixels 的内部工具函数。 */
const parseSizeToPixels = (value: SplitterSize | undefined, availableSize: number) => {
  if (value == null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value)
  }
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (trimmed.endsWith('%')) {
    const parsed = Number.parseFloat(trimmed.slice(0, -1))
    if (!Number.isFinite(parsed)) return undefined
    return Math.max(0, (parsed / 100) * availableSize)
  }

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, parsed)
}

/** 归一化 Collapsible 的内部工具函数。 */
const normalizeCollapsible = (
  value: SplitterPanelProps['collapsible'],
): NormalizedCollapsibleConfig => {
  if (!value) {
    return { start: false, end: false, show: false }
  }
  if (value === true) {
    return { start: true, end: true, show: true }
  }
  return {
    start: !!value.start,
    end: !!value.end,
    show: value.showCollapsibleIcon !== false,
  }
}

/**
 * 尺寸归一策略：
 * 1. 先应用显式值并夹到 min/max 内；
 * 2. 未指定的面板平分剩余空间；
 * 3. 最后把总和收敛到容器尺寸。
 */
const normalizeSizes = (
  desiredSizes: Array<number | undefined>,
  constraints: PanelConstraint[],
  target: number,
) => {
  if (target <= 0) return desiredSizes.map(() => 0)

  const next = desiredSizes.map((size, index) => {
    if (typeof size !== 'number' || !Number.isFinite(size)) return Number.NaN
    return clamp(size, constraints[index].min, constraints[index].max)
  })
  const unspecifiedIndexes = next
    .map((size, index) => (Number.isNaN(size) ? index : -1))
    .filter(index => index >= 0)
  const fixedTotal = next.reduce((total, size) => (Number.isNaN(size) ? total : total + size), 0)
  const initialShare = unspecifiedIndexes.length
    ? Math.max(target - fixedTotal, 0) / unspecifiedIndexes.length
    : 0

  unspecifiedIndexes.forEach(index => {
    next[index] = clamp(
      initialShare || target / Math.max(next.length, 1),
      constraints[index].min,
      constraints[index].max,
    )
  })

  for (let iteration = 0; iteration < 16; iteration += 1) {
    const total = sumSizes(next)
    const diff = target - total

    if (Math.abs(diff) <= EPSILON) {
      return next
    }

    if (diff > 0) {
      const growableIndexes = next
        .map((size, index) => (constraints[index].max - size > EPSILON ? index : -1))
        .filter(index => index >= 0)

      if (!growableIndexes.length) return next

      const share = diff / growableIndexes.length
      growableIndexes.forEach(index => {
        next[index] = Math.min(next[index] + share, constraints[index].max)
      })
      continue
    }

    const shrinkableIndexes = next
      .map((size, index) => (size - constraints[index].min > EPSILON ? index : -1))
      .filter(index => index >= 0)

    if (!shrinkableIndexes.length) return next

    const totalSlack = shrinkableIndexes.reduce(
      (total, index) => total + (next[index] - constraints[index].min),
      0,
    )

    shrinkableIndexes.forEach(index => {
      const slack = next[index] - constraints[index].min
      const ratio = totalSlack <= EPSILON ? 1 / shrinkableIndexes.length : slack / totalSlack
      next[index] = Math.max(next[index] + diff * ratio, constraints[index].min)
    })
  }

  return next
}

/** 读取 Container Size 的内部工具函数。 */
const getContainerSize = (element: HTMLElement | undefined, orientation: SplitterOrientation) => {
  if (!element) return 0
  const rect = element.getBoundingClientRect()
  if (orientation === 'vertical') {
    return rect.height || element.clientHeight || 0
  }
  return rect.width || element.clientWidth || 0
}

/** measure Point 的内部工具函数。 */
const measurePoint = (event: MouseEvent, orientation: SplitterOrientation) =>
  orientation === 'vertical' ? event.clientY : event.clientX

/** 构建 Constraints 的内部工具函数。 */
const buildConstraints = (
  configs: PanelConfig[],
  availableSize: number,
  collapsed: boolean[],
): PanelConstraint[] => {
  return configs.map((config, index) => {
    if (collapsed[index]) {
      return { min: 0, max: 0 }
    }

    const min = parseSizeToPixels(config.min, availableSize) ?? 0
    const max = parseSizeToPixels(config.max, availableSize) ?? availableSize
    return {
      min: clamp(min, 0, availableSize),
      max: clamp(Math.max(max, min), min, availableSize),
    }
  })
}

/** 构建 Sizes From Configs 的内部工具函数。 */
const buildSizesFromConfigs = (
  configs: PanelConfig[],
  availableSize: number,
  collapsed: boolean[],
  currentSizes?: number[],
) => {
  const constraints = buildConstraints(configs, availableSize, collapsed)
  const useCurrentSizes =
    !!currentSizes && currentSizes.length === configs.length && sumSizes(currentSizes) > EPSILON
  const fallbackSizes = useCurrentSizes
    ? scaleSizesToTarget(currentSizes!, availableSize)
    : undefined
  const desiredSizes = configs.map((config, index) => {
    if (collapsed[index]) return 0

    const controlledSize = parseSizeToPixels(config.size, availableSize)
    if (typeof controlledSize === 'number') return controlledSize

    const defaultSize = parseSizeToPixels(config.defaultSize, availableSize)
    if (typeof defaultSize === 'number') return defaultSize

    if (fallbackSizes) return fallbackSizes[index]

    return undefined
  })

  return normalizeSizes(desiredSizes, constraints, availableSize)
}

/** apply Drag Delta 的内部工具函数。 */
const applyDragDelta = (
  sizes: number[],
  constraints: PanelConstraint[],
  index: number,
  delta: number,
) => {
  const next = sizes.slice()
  const previousSize = sizes[index]
  const nextSize = sizes[index + 1]
  const pairTotal = previousSize + nextSize
  const previousMin = Math.max(constraints[index].min, pairTotal - constraints[index + 1].max)
  const previousMax = Math.min(constraints[index].max, pairTotal - constraints[index + 1].min)
  const resolvedPrevious = clamp(previousSize + delta, previousMin, previousMax)

  next[index] = resolvedPrevious
  next[index + 1] = pairTotal - resolvedPrevious
  return next
}

/** 归一化 Sizes With Locked Index 的内部工具函数。 */
const normalizeSizesWithLockedIndex = (
  desiredSizes: number[],
  constraints: PanelConstraint[],
  target: number,
  lockedIndex: number,
) => {
  if (!constraints[lockedIndex]) return normalizeSizes(desiredSizes, constraints, target)

  const lockedSize = clamp(
    desiredSizes[lockedIndex],
    constraints[lockedIndex].min,
    constraints[lockedIndex].max,
  )
  const next = Array.from({ length: desiredSizes.length }, () => 0)
  const remainingIndexes = desiredSizes
    .map((_, index) => index)
    .filter(index => index !== lockedIndex)
  const remainingConstraints = remainingIndexes.map(index => constraints[index])
  const remainingDesired = remainingIndexes.map(index => desiredSizes[index])
  const remainingTarget = Math.max(target - lockedSize, 0)
  const normalizedRemaining = normalizeSizes(
    remainingDesired,
    remainingConstraints,
    remainingTarget,
  )

  next[lockedIndex] = lockedSize
  remainingIndexes.forEach((index, position) => {
    next[index] = normalizedRemaining[position]
  })

  return next
}

/** 创建 Chevron Svg 的内部工具函数。 */
const createChevronSvg = (direction: 'left' | 'right' | 'up' | 'down') => {
  let path = 'M10 6 6 10l4 4'
  if (direction === 'right') path = 'm6 6 4 4-4 4'
  if (direction === 'up') path = 'm6 10 4-4 4 4'
  if (direction === 'down') path = 'm6 6 4 4 4-4'

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.75')
  svg.setAttribute('class', 'h-3.5 w-3.5')

  const pathNode = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  pathNode.setAttribute('d', path)
  pathNode.setAttribute('stroke-linecap', 'round')
  pathNode.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(pathNode)

  return svg
}

/** 创建 Default Dragger 的内部工具函数。 */
const createDefaultDragger = (orientation: SplitterOrientation) => {
  const host = document.createElement('span')
  host.className =
    orientation === 'vertical'
      ? 'inline-grid h-2 w-3 grid-cols-3 grid-rows-2 place-items-center gap-px leading-none text-base-content/55'
      : 'inline-grid h-3 w-2 grid-cols-2 grid-rows-3 place-items-center gap-px leading-none text-base-content/55'

  for (let index = 0; index < 6; index += 1) {
    const dot = document.createElement('span')
    dot.className = 'h-[3px] w-[3px] rounded-full bg-current opacity-65'
    host.appendChild(dot)
  }

  return host
}

/** mount Content 的内部工具函数。 */
const mountContent = (host: HTMLElement, content: any, fallback: () => Node) => {
  host.innerHTML = ''

  if (content == null || content === false) {
    host.appendChild(fallback())
    return
  }

  if (typeof content === 'string' || typeof content === 'number') {
    host.textContent = String(content)
    return
  }

  if (typeof Node !== 'undefined' && content instanceof Node) {
    host.appendChild(content.cloneNode(true))
    return
  }

  try {
    renderRue(content, host)
  } catch {
    host.appendChild(fallback())
  }
}

/** 解析 Collapse Direction 的内部工具函数。 */
const resolveCollapseDirection = (
  side: 'start' | 'end',
  collapsed: boolean,
  orientation: SplitterOrientation,
) => {
  if (orientation === 'vertical') {
    if (side === 'end') return collapsed ? 'down' : 'up'
    return collapsed ? 'up' : 'down'
  }
  if (side === 'end') return collapsed ? 'right' : 'left'
  return collapsed ? 'left' : 'right'
}

/** read Panel Config 的内部工具函数。 */
const readPanelConfig = (element: HTMLElement): PanelConfig => {
  const readValue = (name: string) => element.getAttribute(name) ?? undefined
  const readBoolean = (name: string, fallback = false) => {
    const value = element.getAttribute(name)
    if (value == null) return fallback
    return value !== 'false'
  }

  return {
    min: readValue('data-rue-splitter-min'),
    max: readValue('data-rue-splitter-max'),
    size: readValue('data-rue-splitter-size'),
    defaultSize: readValue('data-rue-splitter-default-size'),
    resizable: readBoolean('data-rue-splitter-resizable', true),
    collapsible: {
      start: readBoolean('data-rue-splitter-collapsible-start'),
      end: readBoolean('data-rue-splitter-collapsible-end'),
      show: readBoolean('data-rue-splitter-collapsible-show'),
    },
  }
}

/** Splitter Panel Root 的内部工具函数。 */
const SplitterPanelRoot: FC<SplitterPanelProps> = ({
  className,
  style,
  min,
  max,
  size,
  defaultSize,
  resizable = true,
  collapsible,
  children,
  ...rest
}) => {
  const panelRef = useRef<HTMLDivElement>()
  const normalizedCollapsible = normalizeCollapsible(collapsible)

  queueMicrotask(() => {
    const panel = panelRef.current
    if (!panel) return
    panel.dispatchEvent(new Event('rue-splitter-panel-config-change', { bubbles: true }))
  })

  return h(
    'div',
    {
      ...rest,
      ref: panelRef,
      className: mergeClassName(
        'rue-splitter-panel relative min-h-0 min-w-0 overflow-hidden bg-base-100',
        className,
      ),
      style,
      'data-rue-splitter-panel': 'true',
      'data-rue-splitter-min': min != null ? String(min) : undefined,
      'data-rue-splitter-max': max != null ? String(max) : undefined,
      'data-rue-splitter-size': size != null ? String(size) : undefined,
      'data-rue-splitter-default-size': defaultSize != null ? String(defaultSize) : undefined,
      'data-rue-splitter-resizable': resizable ? 'true' : 'false',
      'data-rue-splitter-collapsible-start': normalizedCollapsible.start ? 'true' : undefined,
      'data-rue-splitter-collapsible-end': normalizedCollapsible.end ? 'true' : undefined,
      'data-rue-splitter-collapsible-show': normalizedCollapsible.show ? 'true' : undefined,
    },
    h('div', { className: 'h-full w-full' }, ...toChildArray(children)),
  )
}

/** Splitter 根组件：以渲染后的 DOM 为真实来源管理布局，避免依赖 children 的静态 vnode 结构。 */
const SplitterRoot: FC<SplitterProps> = ({
  orientation,
  layout,
  vertical,
  lazy = false,
  className,
  style,
  draggerIcon,
  collapsibleIcon,
  onDraggerDoubleClick,
  onResizeStart,
  onResize,
  onResizeEnd,
  onCollapse,
  children,
  ...rest
}) => {
  const rootRef = useRef<HTMLDivElement>()
  const overlayRef = useRef<HTMLDivElement>()
  const dragStateRef = useRef<DragState | null>()
  const panelElementsRef = useRef<HTMLElement[]>()
  const panelConfigsRef = useRef<PanelConfig[]>()
  const sizeStateRef = useRef<number[]>()
  const collapsedStateRef = useRef<boolean[]>()
  const expandedSizesRef = useRef<number[]>()
  const handleRecordsRef = useRef<HandleRecord[]>()
  const pendingSizesRef = useRef<number[] | null>()
  const activeHandleIndexRef = useRef<number | null>()
  const pendingSyncRef = useRef(false)
  const previewOffsetRef = useRef(0)
  const resolvedOrientation = resolveOrientation(orientation, layout, vertical)

  if (!panelElementsRef.current) panelElementsRef.current = []
  if (!panelConfigsRef.current) panelConfigsRef.current = []
  if (!sizeStateRef.current) sizeStateRef.current = []
  if (!collapsedStateRef.current) collapsedStateRef.current = []
  if (!expandedSizesRef.current) expandedSizesRef.current = []
  if (!handleRecordsRef.current) handleRecordsRef.current = []

  const resolvedStyle = normalizeRootStyle(style)
  const verticalDefaultStyle =
    resolvedOrientation === 'vertical' && resolvedStyle?.height == null
      ? { height: resolvedStyle?.minHeight ?? '320px' }
      : undefined

  const getPanelElements = () => {
    const root = rootRef.current
    if (!root) return [] as HTMLElement[]
    return Array.from(root.children).filter(
      child =>
        child instanceof HTMLElement && child.getAttribute('data-rue-splitter-panel') === 'true',
    ) as HTMLElement[]
  }

  const ensureCollapsedLength = (panelCount: number) => {
    const collapsed = collapsedStateRef.current!
    if (collapsed.length === panelCount) return collapsed

    const next = Array.from({ length: panelCount }, (_, index) => collapsed[index] ?? false)
    collapsedStateRef.current = next
    expandedSizesRef.current = Array.from(
      { length: panelCount },
      (_, index) => expandedSizesRef.current?.[index] ?? 0,
    )
    return next
  }

  const getAvailableSize = () => getContainerSize(rootRef.current, resolvedOrientation)

  const emitResize = (sizes: number[]) => {
    if (onResize) {
      onResize(serializeSizes(sizes))
    }
  }

  const emitCollapse = (collapsed: boolean[], sizes: number[]) => {
    if (onCollapse) {
      onCollapse(collapsed.slice(), serializeSizes(sizes))
    }
  }

  const applyPanelSizes = (sizes: number[]) => {
    const panels = panelElementsRef.current ?? []
    const collapsed = collapsedStateRef.current ?? []

    panels.forEach((panel, index) => {
      const size = sizes[index] ?? 0
      panel.dataset.rueSplitterPanelIndex = String(index)
      panel.dataset.rueSplitterCollapsed = collapsed[index] ? 'true' : 'false'
      panel.style.flex = '0 0 auto'
      panel.style.flexBasis = `${size}px`
      if (resolvedOrientation === 'vertical') {
        panel.style.height = `${size}px`
        panel.style.width = ''
      } else {
        panel.style.width = `${size}px`
        panel.style.height = ''
      }
    })
  }

  const updateHandleVisuals = () => {
    const handles = handleRecordsRef.current ?? []
    const configs = panelConfigsRef.current ?? []
    const sizes = sizeStateRef.current ?? []
    const collapsed = collapsedStateRef.current ?? []
    const activeHandleIndex = activeHandleIndexRef.current
    const previewOffset = previewOffsetRef.current

    handles.forEach((handle, index) => {
      const config = configs[index]
      const nextConfig = configs[index + 1]
      const boundary = sumSizes(sizes.slice(0, index + 1))
      const previousCollapsed = collapsed[index] === true
      const nextCollapsed = collapsed[index + 1] === true
      const isActive = activeHandleIndex === index
      const translate =
        lazy && isActive
          ? resolvedOrientation === 'vertical'
            ? `translateY(${previewOffset}px)`
            : `translateX(${previewOffset}px)`
          : ''

      handle.root.dataset.rueSplitterHandleActive = isActive ? 'true' : 'false'
      handle.root.style.transform = translate

      if (resolvedOrientation === 'vertical') {
        handle.root.style.top = `${boundary - HANDLE_SIZE / 2}px`
        handle.root.style.left = '0'
        handle.root.style.height = `${HANDLE_SIZE}px`
        handle.root.style.width = '100%'
      } else {
        handle.root.style.left = `${boundary - HANDLE_SIZE / 2}px`
        handle.root.style.top = '0'
        handle.root.style.width = `${HANDLE_SIZE}px`
        handle.root.style.height = '100%'
      }

      if (handle.previousButton && handle.previousIconHost) {
        handle.previousButton.setAttribute(
          'aria-label',
          `${previousCollapsed ? '展开' : '折叠'}面板 ${index + 1}`,
        )
        mountContent(handle.previousIconHost, collapsibleIcon?.end, () =>
          createChevronSvg(resolveCollapseDirection('end', previousCollapsed, resolvedOrientation)),
        )
      }

      if (handle.nextButton && handle.nextIconHost) {
        handle.nextButton.setAttribute(
          'aria-label',
          `${nextCollapsed ? '展开' : '折叠'}面板 ${index + 2}`,
        )
        mountContent(handle.nextIconHost, collapsibleIcon?.start, () =>
          createChevronSvg(resolveCollapseDirection('start', nextCollapsed, resolvedOrientation)),
        )
      }

      mountContent(handle.draggerHost, draggerIcon, () => createDefaultDragger(resolvedOrientation))

      const disabled = !config.resizable || !nextConfig?.resizable
      handle.root.dataset.rueSplitterHandleDisabled = disabled ? 'true' : 'false'
      if (disabled) {
        handle.root.style.cursor = 'default'
      }
    })
  }

  const clearHandles = () => {
    const overlay = overlayRef.current
    if (overlay) {
      overlay.innerHTML = ''
    }
    handleRecordsRef.current = []
  }

  const commitSizes = (sizes: number[], emitDuringDrag = false) => {
    const availableSize = getAvailableSize()
    const collapsed = collapsedStateRef.current ?? []
    const constraints = buildConstraints(panelConfigsRef.current ?? [], availableSize, collapsed)
    const normalized = normalizeSizes(sizes, constraints, availableSize)

    sizeStateRef.current = normalized
    normalized.forEach((size, index) => {
      if (!collapsed[index] && size > EPSILON) {
        expandedSizesRef.current![index] = size
      }
    })

    applyPanelSizes(normalized)
    updateHandleVisuals()

    if (emitDuringDrag) {
      emitResize(normalized)
    }
  }

  const toggleCollapse = (panelIndex: number) => {
    const configs = panelConfigsRef.current ?? []
    if (!configs[panelIndex]) return

    const availableSize = getAvailableSize()
    const nextCollapsed = ensureCollapsedLength(configs.length).slice()
    const nextSizes =
      sizeStateRef.current?.length === configs.length
        ? sizeStateRef.current.slice()
        : buildSizesFromConfigs(configs, availableSize, nextCollapsed)

    if (nextCollapsed[panelIndex]) {
      nextCollapsed[panelIndex] = false
      const restoredSize =
        parseSizeToPixels(configs[panelIndex].size, availableSize) ??
        expandedSizesRef.current?.[panelIndex] ??
        parseSizeToPixels(configs[panelIndex].defaultSize, availableSize) ??
        availableSize / Math.max(configs.length, 1)
      nextSizes[panelIndex] = restoredSize

      collapsedStateRef.current = nextCollapsed
      const constraints = buildConstraints(configs, availableSize, nextCollapsed)
      const normalized = normalizeSizesWithLockedIndex(
        nextSizes,
        constraints,
        availableSize,
        panelIndex,
      )
      sizeStateRef.current = normalized
      applyPanelSizes(normalized)
      updateHandleVisuals()
      emitResize(normalized)
      emitCollapse(nextCollapsed, normalized)
      return
    } else {
      if (nextSizes[panelIndex] > EPSILON) {
        expandedSizesRef.current![panelIndex] = nextSizes[panelIndex]
      }
      nextCollapsed[panelIndex] = true
      nextSizes[panelIndex] = 0
    }

    collapsedStateRef.current = nextCollapsed
    const constraints = buildConstraints(configs, availableSize, nextCollapsed)
    const normalized = normalizeSizes(nextSizes, constraints, availableSize)
    sizeStateRef.current = normalized
    applyPanelSizes(normalized)
    updateHandleVisuals()
    emitResize(normalized)
    emitCollapse(nextCollapsed, normalized)
  }

  const rebuildHandles = () => {
    clearHandles()

    const overlay = overlayRef.current
    const configs = panelConfigsRef.current ?? []
    if (!overlay || configs.length <= 1) return

    const records: HandleRecord[] = []

    configs.slice(0, -1).forEach((config, index) => {
      const nextConfig = configs[index + 1]
      const root = document.createElement('div')
      root.setAttribute('role', 'separator')
      root.setAttribute('aria-orientation', resolvedOrientation)
      root.setAttribute('aria-label', `调整面板 ${index + 1} 与 ${index + 2}`)
      root.setAttribute('data-rue-splitter-handle', String(index))
      root.className =
        resolvedOrientation === 'vertical'
          ? 'pointer-events-auto absolute z-10 h-2.5 w-full select-none cursor-row-resize'
          : 'pointer-events-auto absolute z-10 h-full w-2.5 select-none cursor-col-resize'

      const line = document.createElement('span')
      line.className =
        resolvedOrientation === 'vertical'
          ? 'absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-base-300/90'
          : 'absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-base-300/90'
      root.appendChild(line)

      const bubble = document.createElement('div')
      bubble.className =
        resolvedOrientation === 'vertical'
          ? 'absolute left-1/2 top-1/2 flex min-w-[2.25rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5 rounded-full border border-base-300 bg-base-100/95 px-1 py-0.5 text-base-content/70 shadow-sm'
          : 'absolute left-1/2 top-1/2 flex min-h-[2.25rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full border border-base-300 bg-base-100/95 px-1 py-0.5 text-base-content/70 shadow-sm'
      root.appendChild(bubble)

      let previousButton: HTMLButtonElement | undefined
      let nextButton: HTMLButtonElement | undefined
      let previousIconHost: HTMLSpanElement | undefined
      let nextIconHost: HTMLSpanElement | undefined

      if (config.collapsible.end && config.collapsible.show) {
        previousButton = document.createElement('button')
        previousButton.type = 'button'
        previousButton.className =
          'inline-flex h-4 w-4 items-center justify-center rounded-full text-base-content/60 transition hover:bg-base-200 hover:text-base-content'
        previousIconHost = document.createElement('span')
        previousIconHost.className =
          'inline-flex h-full w-full items-center justify-center leading-none'
        previousButton.appendChild(previousIconHost)
        previousButton.addEventListener('mousedown', event => {
          event.stopPropagation()
        })
        previousButton.addEventListener('click', event => {
          event.stopPropagation()
          toggleCollapse(index)
        })
        bubble.appendChild(previousButton)
      }

      const draggerHost = document.createElement('span')
      draggerHost.className = 'inline-flex h-4 w-4 items-center justify-center leading-none'
      draggerHost.setAttribute('aria-hidden', 'true')
      bubble.appendChild(draggerHost)

      if (nextConfig?.collapsible.start && nextConfig.collapsible.show) {
        nextButton = document.createElement('button')
        nextButton.type = 'button'
        nextButton.className =
          'inline-flex h-4 w-4 items-center justify-center rounded-full text-base-content/60 transition hover:bg-base-200 hover:text-base-content'
        nextIconHost = document.createElement('span')
        nextIconHost.className =
          'inline-flex h-full w-full items-center justify-center leading-none'
        nextButton.appendChild(nextIconHost)
        nextButton.addEventListener('mousedown', event => {
          event.stopPropagation()
        })
        nextButton.addEventListener('click', event => {
          event.stopPropagation()
          toggleCollapse(index + 1)
        })
        bubble.appendChild(nextButton)
      }

      root.addEventListener('mousedown', event => {
        const target = event.target as HTMLElement | null
        if (target?.closest('button')) return
        startDrag(event as MouseEvent, index)
      })
      root.addEventListener('dblclick', event => {
        const target = event.target as HTMLElement | null
        if (target?.closest('button')) return
        if (onDraggerDoubleClick) {
          onDraggerDoubleClick(index)
        }
      })

      const disabled = !config.resizable || !nextConfig?.resizable
      if (disabled) {
        root.dataset.rueSplitterHandleDisabled = 'true'
        root.style.cursor = 'default'
      }

      overlay.appendChild(root)
      records.push({
        root,
        previousButton,
        nextButton,
        draggerHost,
        previousIconHost,
        nextIconHost,
      })
    })

    handleRecordsRef.current = records
    updateHandleVisuals()
  }

  const syncPanelsFromDom = (preferCurrent = true) => {
    panelElementsRef.current = getPanelElements()
    panelConfigsRef.current = panelElementsRef.current.map(readPanelConfig)

    const configs = panelConfigsRef.current
    if (!configs.length) {
      sizeStateRef.current = []
      collapsedStateRef.current = []
      clearHandles()
      return
    }

    const availableSize = getAvailableSize()
    const collapsed = ensureCollapsedLength(configs.length)
    const baseSizes =
      preferCurrent && sizeStateRef.current?.length === configs.length
        ? sizeStateRef.current
        : undefined
    const nextSizes = buildSizesFromConfigs(configs, availableSize, collapsed, baseSizes)

    if (!arraysAlmostEqual(sizeStateRef.current ?? [], nextSizes)) {
      sizeStateRef.current = nextSizes
    }

    nextSizes.forEach((size, index) => {
      if (!collapsed[index] && size > EPSILON) {
        expandedSizesRef.current![index] = size
      }
    })

    applyPanelSizes(nextSizes)
    rebuildHandles()
  }

  const scheduleSyncFromRender = () => {
    if (pendingSyncRef.current) return
    pendingSyncRef.current = true

    queueMicrotask(() => {
      pendingSyncRef.current = false
      if (!rootRef.current || dragStateRef.current) return
      syncPanelsFromDom(false)
    })
  }

  const teardownDragListeners = () => {
    if (typeof window === 'undefined') return
    window.removeEventListener('mousemove', handleWindowMouseMove)
    window.removeEventListener('mouseup', handleWindowMouseUp)
  }

  function handleWindowMouseMove(event: MouseEvent) {
    const dragState = dragStateRef.current
    if (!dragState) return

    const constraints = buildConstraints(
      panelConfigsRef.current ?? [],
      dragState.availableSize,
      collapsedStateRef.current ?? [],
    )
    const delta = measurePoint(event, resolvedOrientation) - dragState.startPoint
    const nextSizes = applyDragDelta(dragState.startSizes, constraints, dragState.index, delta)
    const appliedOffset = nextSizes[dragState.index] - dragState.startSizes[dragState.index]

    pendingSizesRef.current = nextSizes
    previewOffsetRef.current = lazy ? appliedOffset : 0

    if (lazy) {
      updateHandleVisuals()
      return
    }

    commitSizes(nextSizes, true)
  }

  function handleWindowMouseUp() {
    const dragState = dragStateRef.current
    if (!dragState) return
    const currentSizes = sizeStateRef.current ?? []
    const panelConfigs = panelConfigsRef.current

    const finalSizes = lazy
      ? (pendingSizesRef.current ?? dragState.startSizes)
      : currentSizes.length === panelConfigs?.length
        ? currentSizes.slice()
        : dragState.startSizes

    if (lazy) {
      commitSizes(finalSizes, true)
    }

    dragStateRef.current = null
    pendingSizesRef.current = null
    activeHandleIndexRef.current = null
    previewOffsetRef.current = 0
    updateHandleVisuals()
    teardownDragListeners()

    if (onResizeEnd) {
      onResizeEnd(serializeSizes(finalSizes))
    }
  }

  const startDrag = (event: MouseEvent, index: number) => {
    if (event.button !== 0) return

    panelElementsRef.current = getPanelElements()
    panelConfigsRef.current = panelElementsRef.current.map(readPanelConfig)

    const configs = panelConfigsRef.current ?? []
    if (!configs[index] || !configs[index + 1]) return
    if (!configs[index].resizable || !configs[index + 1].resizable) return

    event.preventDefault()
    const availableSize = getAvailableSize()
    const startSizes =
      sizeStateRef.current?.length === configs.length
        ? sizeStateRef.current.slice()
        : buildSizesFromConfigs(configs, availableSize, ensureCollapsedLength(configs.length))

    dragStateRef.current = {
      index,
      startPoint: measurePoint(event, resolvedOrientation),
      startSizes,
      availableSize,
    }
    pendingSizesRef.current = null
    activeHandleIndexRef.current = index
    previewOffsetRef.current = 0
    updateHandleVisuals()

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleWindowMouseMove)
      window.addEventListener('mouseup', handleWindowMouseUp)
    }

    if (onResizeStart) {
      onResizeStart(serializeSizes(startSizes))
    }
  }

  onMounted(() => {
    syncPanelsFromDom(false)

    const handlePanelConfigChange = () => {
      if (dragStateRef.current) return
      syncPanelsFromDom(true)
    }

    rootRef.current?.addEventListener('rue-splitter-panel-config-change', handlePanelConfigChange)

    const handleWindowResize = () => {
      if (dragStateRef.current) return
      syncPanelsFromDom(true)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleWindowResize)
    }

    onUnmounted(() => {
      teardownDragListeners()
      rootRef.current?.removeEventListener(
        'rue-splitter-panel-config-change',
        handlePanelConfigChange,
      )
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleWindowResize)
      }
      clearHandles()
    })
  })

  scheduleSyncFromRender()

  return h(
    'div',
    {
      ...rest,
      ref: rootRef,
      className: mergeClassName(
        mergeClassName(
          mergeClassName(
            'rue-splitter relative flex min-h-0 min-w-0 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm',
            resolvedOrientation === 'vertical' ? 'flex-col' : undefined,
          ),
          'items-stretch',
        ),
        className,
      ),
      style: {
        ...verticalDefaultStyle,
        ...resolvedStyle,
        flexDirection: resolvedOrientation === 'vertical' ? 'column' : 'row',
      },
      'data-rue-splitter-root': 'true',
      'data-rue-splitter-orientation': resolvedOrientation,
      'data-rue-splitter-lazy': lazy ? 'true' : 'false',
    },
    ...toChildArray(children),
    h('div', {
      ref: overlayRef,
      className: 'pointer-events-none absolute inset-0',
      'aria-hidden': 'true',
    }),
  )
}

type SplitterCompound = FC<SplitterProps> & {
  Panel: FC<SplitterPanelProps>
}

const Splitter = Object.assign(SplitterRoot, {
  Panel: SplitterPanelRoot,
}) as SplitterCompound

/** 默认导出分割面板组件。 */
export default Splitter
