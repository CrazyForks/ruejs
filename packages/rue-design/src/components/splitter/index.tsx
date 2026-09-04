/*
Splitter 组件概述
- 通过 DOM 驱动的方式管理面板尺寸，适配 Rue 当前对子组件 children 的运行时表示。
- Panel 直接输出真实面板节点，根组件在挂载后读取 direct child 面板元信息，统一处理拖拽与尺寸约束。
- 使用 TSX 保持组件源码可读，并让 Vite 插件进入 Rue Vapor 深度编译路径。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, onUpdated, useSetup } from '@rue-js/rue'

/** SplitterOrientation 类型。 */
export type SplitterOrientation = 'horizontal' | 'vertical'
/** SplitterSize 尺寸类型。 */
export type SplitterSize = number | string

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
  /** onDraggerDoubleClick 事件回调。 */
  onDraggerDoubleClick?: (index: number) => void
  /** onResizeStart 事件回调。 */
  onResizeStart?: (sizes: number[]) => void
  /** onResize 事件回调。 */
  onResize?: (sizes: number[]) => void
  /** onResizeEnd 事件回调。 */
  onResizeEnd?: (sizes: number[]) => void
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
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

interface PanelConstraint {
  min: number
  max: number
}

interface PanelConfig {
  min?: SplitterSize
  max?: SplitterSize
  size?: SplitterSize
  defaultSize?: SplitterSize
  resizable: boolean
}

interface DragState {
  index: number
  startPoint: number
  startSizes: number[]
  availableSize: number
}

interface HandleRecord {
  root: HTMLDivElement
}

interface SplitterPanelState {
  element: HTMLDivElement | null
}

interface SplitterRuntimeState {
  rootElement: HTMLDivElement | null
  overlayElement: HTMLDivElement | null
  dragState: DragState | null
  panelElements: HTMLElement[]
  panelConfigs: PanelConfig[]
  sizeState: number[]
  handleRecords: HandleRecord[]
  pendingSizes: number[] | null
  activeHandleIndex: number | null
  pendingSync: boolean
  previewOffset: number
  mountedRootElement: HTMLDivElement | null
  handlePanelConfigChange: (() => void) | null
  handleWindowResize: (() => void) | null
  panelMutationObserver: MutationObserver | null
  layoutRestorePending: boolean
  mutationSyncPending: boolean
  mutationSyncPreferCurrent: boolean
  lastAvailableSize: number
}

/** EPSILON 内部常量。 */
const EPSILON = 0.5
/** HANDLE_SIZE 内部常量。 */
const HANDLE_SIZE = 3
/** 影响 Splitter 布局计算的 Panel 配置属性。 */
const PANEL_CONFIG_ATTRIBUTES = /*#__PURE__*/ new Set([
  'data-rue-splitter-min',
  'data-rue-splitter-max',
  'data-rue-splitter-size',
  'data-rue-splitter-default-size',
  'data-rue-splitter-resizable',
])
const SPLITTER_AVAILABLE_SIZE_BY_PARENT = /*#__PURE__*/ new WeakMap<object, number>()

const isServerRendering = () => {
  const count = (globalThis as Record<string, unknown>).__rue_is_server_rendering__
  return typeof count === 'number' && count > 0
}

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
const buildConstraints = (configs: PanelConfig[], availableSize: number): PanelConstraint[] => {
  return configs.map(config => {
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
  currentSizes?: number[],
) => {
  const constraints = buildConstraints(configs, availableSize)
  const useCurrentSizes =
    !!currentSizes && currentSizes.length === configs.length && sumSizes(currentSizes) > EPSILON
  const fallbackSizes = useCurrentSizes
    ? scaleSizesToTarget(currentSizes!, availableSize)
    : undefined
  const desiredSizes = configs.map((config, index) => {
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
  children,
  ...rest
}) => {
  const panelState = useSetup(
    (): SplitterPanelState => ({
      element: null,
    }),
  )

  const dispatchConfigChange = () => {
    const panel = panelState.element
    if (!panel) return
    const notify = () => {
      if (!panel.isConnected) return
      panel.dispatchEvent(new Event('rue-splitter-panel-config-change', { bubbles: true }))
    }
    queueMicrotask(() => {
      notify()
    })
    setTimeout(notify, 0)
  }

  const assignPanelElement = (element: HTMLDivElement | null) => {
    panelState.element = element
    if (element) dispatchConfigChange()
  }

  onMounted(dispatchConfigChange)
  onUpdated(dispatchConfigChange)

  return (
    <div
      {...rest}
      ref={assignPanelElement}
      className={mergeClassName(
        'rue-splitter-panel relative min-h-0 min-w-0 overflow-hidden bg-base-100',
        className,
      )}
      style={style}
      data-rue-splitter-panel="true"
      data-rue-splitter-min={min != null ? String(min) : undefined}
      data-rue-splitter-max={max != null ? String(max) : undefined}
      data-rue-splitter-size={size != null ? String(size) : undefined}
      data-rue-splitter-default-size={defaultSize != null ? String(defaultSize) : undefined}
      data-rue-splitter-resizable={resizable ? 'true' : 'false'}
    >
      <div className="h-full w-full">{children}</div>
    </div>
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
  onDraggerDoubleClick,
  onResizeStart,
  onResize,
  onResizeEnd,
  children,
  ...rest
}) => {
  const state = useSetup(
    (): SplitterRuntimeState => ({
      rootElement: null,
      overlayElement: null,
      dragState: null,
      panelElements: [],
      panelConfigs: [],
      sizeState: [],
      handleRecords: [],
      pendingSizes: null,
      activeHandleIndex: null,
      pendingSync: false,
      previewOffset: 0,
      mountedRootElement: null,
      handlePanelConfigChange: null,
      handleWindowResize: null,
      panelMutationObserver: null,
      layoutRestorePending: false,
      mutationSyncPending: false,
      mutationSyncPreferCurrent: true,
      lastAvailableSize: 0,
    }),
  )

  const resolvedOrientation = resolveOrientation(orientation, layout, vertical)

  const resolvedStyle = normalizeRootStyle(style)
  const verticalDefaultStyle =
    resolvedOrientation === 'vertical' && resolvedStyle?.height == null
      ? { height: resolvedStyle?.minHeight ?? '320px' }
      : undefined

  const getPanelElements = () => {
    const root = state.rootElement
    if (!root) return [] as HTMLElement[]
    return Array.from(root.children).filter(
      child =>
        child instanceof HTMLElement && child.getAttribute('data-rue-splitter-panel') === 'true',
    ) as HTMLElement[]
  }

  const getAvailableSize = () => {
    const root = state.rootElement
    const measured = getContainerSize(root ?? undefined, resolvedOrientation)
    const parent = root?.parentElement
    if (measured > 0) {
      state.lastAvailableSize = measured
      if (parent) SPLITTER_AVAILABLE_SIZE_BY_PARENT.set(parent, measured)
    }
    return (
      (measured > 0 ? measured : 0) ||
      state.lastAvailableSize ||
      (parent ? SPLITTER_AVAILABLE_SIZE_BY_PARENT.get(parent) : 0) ||
      0
    )
  }

  const emitResize = (sizes: number[]) => {
    if (onResize) {
      onResize(serializeSizes(sizes))
    }
    scheduleLayoutRestore()
  }

  const applyPanelSizes = (sizes: number[]) => {
    const panels = state.panelElements

    panels.forEach((panel, index) => {
      const size = sizes[index] ?? 0
      panel.dataset.rueSplitterPanelIndex = String(index)
      const cssSize = `${size}px`
      if (panel.style.flex !== '0 0 auto') panel.style.flex = '0 0 auto'
      if (panel.style.flexBasis !== cssSize) panel.style.flexBasis = cssSize
      if (resolvedOrientation === 'vertical') {
        if (panel.style.height !== cssSize) panel.style.height = cssSize
        if (panel.style.width !== '') panel.style.width = ''
      } else {
        if (panel.style.width !== cssSize) panel.style.width = cssSize
        if (panel.style.height !== '') panel.style.height = ''
      }
    })
  }

  const panelLayoutMatches = (panel: HTMLElement, size: number) => {
    const cssSize = `${size}px`
    if (panel.style.flexBasis !== cssSize) return false
    if (resolvedOrientation === 'vertical') {
      return panel.style.height === cssSize && panel.style.width === ''
    }
    return panel.style.width === cssSize && panel.style.height === ''
  }

  const updateHandleVisuals = () => {
    const handles = state.handleRecords
    const configs = state.panelConfigs
    const sizes = state.sizeState
    const availableSize = getAvailableSize()

    handles.forEach((handle, index) => {
      const config = configs[index]
      const nextConfig = configs[index + 1]
      const boundary = sumSizes(sizes.slice(0, index + 1))
      const isActive = state.activeHandleIndex === index
      const visualBoundary = lazy && isActive ? boundary + state.previewOffset : boundary
      const handleStart = clamp(
        visualBoundary - HANDLE_SIZE / 2,
        0,
        Math.max(availableSize - HANDLE_SIZE, 0),
      )

      handle.root.dataset.rueSplitterHandleActive = isActive ? 'true' : 'false'
      handle.root.style.transform = ''

      if (resolvedOrientation === 'vertical') {
        handle.root.style.top = `${handleStart}px`
        handle.root.style.left = '0'
        handle.root.style.height = `${HANDLE_SIZE}px`
        handle.root.style.width = '100%'
      } else {
        handle.root.style.left = `${handleStart}px`
        handle.root.style.top = '0'
        handle.root.style.width = `${HANDLE_SIZE}px`
        handle.root.style.height = '100%'
      }

      const disabled = !config.resizable || !nextConfig?.resizable
      handle.root.dataset.rueSplitterHandleDisabled = disabled ? 'true' : 'false'
      if (disabled) {
        handle.root.style.cursor = 'default'
      }
    })
  }

  const clearHandles = () => {
    const overlay = state.overlayElement
    if (overlay) {
      overlay.innerHTML = ''
    }
    state.handleRecords = []
  }

  const commitSizes = (sizes: number[], emitDuringDrag = false) => {
    const availableSize = getAvailableSize()
    const constraints = buildConstraints(state.panelConfigs, availableSize)
    const normalized = normalizeSizes(sizes, constraints, availableSize)

    state.sizeState = normalized

    applyPanelSizes(normalized)
    updateHandleVisuals()

    if (emitDuringDrag) {
      emitResize(normalized)
    }
  }

  const rebuildHandles = () => {
    clearHandles()

    const overlay = state.overlayElement
    const configs = state.panelConfigs
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
          ? 'pointer-events-auto absolute z-10 h-[3px] w-full select-none cursor-row-resize bg-base-300/90 transition-colors hover:bg-primary/70'
          : 'pointer-events-auto absolute z-10 h-full w-[3px] select-none cursor-col-resize bg-base-300/90 transition-colors hover:bg-primary/70'

      root.addEventListener('mousedown', event => {
        startDrag(event as MouseEvent, index)
      })
      root.addEventListener('dblclick', () => {
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
      })
    })

    state.handleRecords = records
    updateHandleVisuals()
  }

  const syncPanelsFromDom = (preferCurrent = true) => {
    state.panelElements = getPanelElements()
    state.panelConfigs = state.panelElements.map(readPanelConfig)

    const configs = state.panelConfigs
    if (!configs.length) {
      state.sizeState = []
      clearHandles()
      return
    }

    const availableSize = getAvailableSize()
    const baseSizes =
      preferCurrent && state.sizeState.length === configs.length ? state.sizeState : undefined
    const nextSizes = buildSizesFromConfigs(configs, availableSize, baseSizes)

    if (!arraysAlmostEqual(state.sizeState, nextSizes)) {
      state.sizeState = nextSizes
    }

    applyPanelSizes(nextSizes)
    rebuildHandles()
  }

  const restoreAppliedLayout = () => {
    const panels = getPanelElements()
    if (!panels.length || panels.length !== state.sizeState.length) return
    if (panels.every((panel, index) => panelLayoutMatches(panel, state.sizeState[index] ?? 0))) {
      return
    }

    state.panelElements = panels
    applyPanelSizes(state.sizeState)
    updateHandleVisuals()
  }

  const scheduleLayoutRestore = () => {
    const panels = getPanelElements()
    if (
      panels.length === state.sizeState.length &&
      panels.every((panel, index) => panelLayoutMatches(panel, state.sizeState[index] ?? 0))
    ) {
      return
    }

    if (state.layoutRestorePending) return
    state.layoutRestorePending = true

    queueMicrotask(() => {
      state.layoutRestorePending = false
      if (!state.rootElement) return
      restoreAppliedLayout()
    })
  }

  const scheduleMutationSync = (preferCurrent: boolean) => {
    state.mutationSyncPreferCurrent = state.mutationSyncPending
      ? state.mutationSyncPreferCurrent && preferCurrent
      : preferCurrent

    if (state.mutationSyncPending) return
    state.mutationSyncPending = true

    queueMicrotask(() => {
      const nextPreferCurrent = state.mutationSyncPreferCurrent
      state.mutationSyncPending = false
      state.mutationSyncPreferCurrent = true

      if (!state.rootElement) return
      if (state.dragState) {
        scheduleLayoutRestore()
        return
      }

      syncPanelsFromDom(nextPreferCurrent)
    })
  }

  const handlePanelMutations = (mutations: MutationRecord[]) => {
    let configChanged = false
    let controlledSizeChanged = false

    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        if (mutation.target !== state.rootElement) return
        const changedPanels = [...mutation.addedNodes, ...mutation.removedNodes].some(
          node =>
            node instanceof HTMLElement && node.getAttribute('data-rue-splitter-panel') === 'true',
        )
        if (changedPanels) {
          configChanged = true
        }
        return
      }

      if (mutation.type !== 'attributes') return

      const target = mutation.target
      if (!(target instanceof HTMLElement)) return
      if (target.getAttribute('data-rue-splitter-panel') !== 'true') return

      if (mutation.attributeName && PANEL_CONFIG_ATTRIBUTES.has(mutation.attributeName)) {
        configChanged = true
        if (mutation.attributeName === 'data-rue-splitter-size') {
          controlledSizeChanged = true
        }
      }
    })

    if (configChanged) {
      scheduleMutationSync(!controlledSizeChanged)
    }
  }

  const scheduleSyncFromRender = () => {
    if (isServerRendering()) return
    if (state.pendingSync) return
    state.pendingSync = true

    queueMicrotask(() => {
      state.pendingSync = false
      if (!state.rootElement || state.dragState) return
      syncPanelsFromDom(false)
    })
  }

  const teardownDragListeners = () => {
    if (typeof window === 'undefined') return
    window.removeEventListener('mousemove', handleWindowMouseMove)
    window.removeEventListener('mouseup', handleWindowMouseUp)
  }

  function handleWindowMouseMove(event: MouseEvent) {
    const currentDragState = state.dragState
    if (!currentDragState) return

    const constraints = buildConstraints(state.panelConfigs, currentDragState.availableSize)
    const delta = measurePoint(event, resolvedOrientation) - currentDragState.startPoint
    const nextSizes = applyDragDelta(
      currentDragState.startSizes,
      constraints,
      currentDragState.index,
      delta,
    )
    const appliedOffset =
      nextSizes[currentDragState.index] - currentDragState.startSizes[currentDragState.index]

    state.pendingSizes = nextSizes
    state.previewOffset = lazy ? appliedOffset : 0

    if (lazy) {
      updateHandleVisuals()
      return
    }

    commitSizes(nextSizes, true)
  }

  function handleWindowMouseUp() {
    const currentDragState = state.dragState
    if (!currentDragState) return
    const currentSizes = state.sizeState
    const configs = state.panelConfigs

    const finalSizes = lazy
      ? (state.pendingSizes ?? currentDragState.startSizes)
      : currentSizes.length === configs.length
        ? currentSizes.slice()
        : currentDragState.startSizes

    if (lazy) {
      commitSizes(finalSizes, true)
    }

    state.dragState = null
    state.pendingSizes = null
    state.activeHandleIndex = null
    state.previewOffset = 0
    updateHandleVisuals()
    teardownDragListeners()

    if (onResizeEnd) {
      onResizeEnd(serializeSizes(finalSizes))
    }
  }

  const startDrag = (event: MouseEvent, index: number) => {
    if (event.button !== 0) return

    state.panelElements = getPanelElements()
    state.panelConfigs = state.panelElements.map(readPanelConfig)

    const configs = state.panelConfigs
    if (!configs[index] || !configs[index + 1]) return
    if (!configs[index].resizable || !configs[index + 1].resizable) return

    event.preventDefault()
    const availableSize = getAvailableSize()
    const startSizes =
      state.sizeState.length === configs.length
        ? state.sizeState.slice()
        : buildSizesFromConfigs(configs, availableSize)

    state.dragState = {
      index,
      startPoint: measurePoint(event, resolvedOrientation),
      startSizes,
      availableSize,
    }
    state.pendingSizes = null
    state.activeHandleIndex = index
    state.previewOffset = 0
    updateHandleVisuals()

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleWindowMouseMove)
      window.addEventListener('mouseup', handleWindowMouseUp)
    }

    if (onResizeStart) {
      onResizeStart(serializeSizes(startSizes))
    }
  }

  const assignRootElement = (element: HTMLDivElement | null) => {
    state.rootElement = element
  }

  const assignOverlayElement = (element: HTMLDivElement | null) => {
    state.overlayElement = element
  }

  onMounted(() => {
    if (isServerRendering()) return
    state.mountedRootElement = state.rootElement
    syncPanelsFromDom(false)

    state.handlePanelConfigChange = () => {
      if (state.dragState) return
      syncPanelsFromDom(true)
    }

    state.mountedRootElement?.addEventListener(
      'rue-splitter-panel-config-change',
      state.handlePanelConfigChange,
    )

    if (typeof MutationObserver !== 'undefined' && state.mountedRootElement) {
      state.panelMutationObserver = new MutationObserver(handlePanelMutations)
      state.panelMutationObserver.observe(state.mountedRootElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: Array.from(PANEL_CONFIG_ATTRIBUTES),
      })
    }

    state.handleWindowResize = () => {
      if (state.dragState) return
      syncPanelsFromDom(true)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', state.handleWindowResize)
    }
  })

  onUnmounted(() => {
    teardownDragListeners()
    state.panelMutationObserver?.disconnect()
    state.panelMutationObserver = null
    if (state.handlePanelConfigChange) {
      state.mountedRootElement?.removeEventListener(
        'rue-splitter-panel-config-change',
        state.handlePanelConfigChange,
      )
    }
    if (typeof window !== 'undefined' && state.handleWindowResize) {
      window.removeEventListener('resize', state.handleWindowResize)
    }
    clearHandles()
  })

  scheduleSyncFromRender()

  return (
    <div
      {...rest}
      ref={assignRootElement}
      className={mergeClassName(
        mergeClassName(
          mergeClassName(
            'rue-splitter relative flex min-h-0 min-w-0 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm',
            resolvedOrientation === 'vertical' ? 'flex-col' : undefined,
          ),
          'items-stretch',
        ),
        className,
      )}
      style={{
        ...verticalDefaultStyle,
        ...resolvedStyle,
        flexDirection: resolvedOrientation === 'vertical' ? 'column' : 'row',
      }}
      data-rue-splitter-root="true"
      data-rue-splitter-orientation={resolvedOrientation}
      data-rue-splitter-lazy={lazy ? 'true' : 'false'}
    >
      {children}
      <div
        ref={assignOverlayElement}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
    </div>
  )
}

type SplitterCompound = FC<SplitterProps> & {
  Panel: FC<SplitterPanelProps>
}

const Splitter = /*#__PURE__*/ Object.assign(SplitterRoot, {
  Panel: SplitterPanelRoot,
}) as SplitterCompound

/** 默认导出分割面板组件。 */
export default Splitter
