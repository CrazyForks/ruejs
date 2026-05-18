/*
Tour 组件概述
- 提供接近成熟组件库的分步引导能力，覆盖 target 高亮、遮罩、定位、受控/非受控步进与自定义底部操作区。
- 视觉上延续 Rue 现有的 card / badge / btn 语言，不直接照搬 ant-design，而是保留更轻的层次与更强的场景感。
- 实现保持单文件内聚，方便后续继续补强 semantic classNames/styles、交互细节与设计页示例。
*/
import type { FC } from '@rue-js/rue'
import { Teleport, onMounted, onUnmounted, ref, useRef, watch } from '@rue-js/rue'

export type TourPlacement =
  | 'center'
  | 'top'
  | 'topLeft'
  | 'topRight'
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight'
  | 'left'
  | 'leftTop'
  | 'leftBottom'
  | 'right'
  | 'rightTop'
  | 'rightBottom'

export type TourType = 'default' | 'primary'
export type TourArrow = boolean | { pointAtCenter?: boolean }
export type TourTarget = HTMLElement | null | undefined | (() => HTMLElement | null | undefined)
export type TourGetPopupContainer = string | HTMLElement | (() => HTMLElement) | false

export interface TourGap {
  offset?: number | [number, number]
  radius?: number
}

export interface TourMask {
  color?: string
  style?: Record<string, any>
}

export interface TourLocale {
  next?: any
  previous?: any
  finish?: any
  close?: any
}

export interface TourButtonProps {
  children?: any
  onClick?: () => void
  className?: string
  style?: Record<string, any>
  disabled?: boolean
}

export interface TourClassNames {
  root?: string
  mask?: string
  spotlight?: string
  panel?: string
  section?: string
  cover?: string
  body?: string
  meta?: string
  header?: string
  title?: string
  description?: string
  footer?: string
  actions?: string
  buttons?: string
  prevButton?: string
  nextButton?: string
  indicators?: string
  indicator?: string
  close?: string
  arrow?: string
}

export interface TourStyles {
  root?: Record<string, any>
  mask?: Record<string, any>
  spotlight?: Record<string, any>
  panel?: Record<string, any>
  section?: Record<string, any>
  cover?: Record<string, any>
  body?: Record<string, any>
  meta?: Record<string, any>
  header?: Record<string, any>
  title?: Record<string, any>
  description?: Record<string, any>
  footer?: Record<string, any>
  actions?: Record<string, any>
  buttons?: Record<string, any>
  prevButton?: Record<string, any>
  nextButton?: Record<string, any>
  indicators?: Record<string, any>
  indicator?: Record<string, any>
  close?: Record<string, any>
  arrow?: Record<string, any>
}

export interface TourStepProps {
  target?: TourTarget
  title?: any
  description?: any
  cover?: any
  locale?: TourLocale
  placement?: TourPlacement
  mask?: boolean | TourMask
  arrow?: TourArrow
  type?: TourType
  closeIcon?: any
  onClose?: () => void
  scrollIntoViewOptions?: boolean | ScrollIntoViewOptions
  nextButtonProps?: TourButtonProps
  prevButtonProps?: TourButtonProps
  indicatorsRender?: (current: number, total: number) => any
  actionsRender?: (originNode: any, info: { current: number; total: number }) => any
  className?: string
  style?: Record<string, any>
  classNames?: TourClassNames
  styles?: TourStyles
}

export interface TourProps {
  steps?: TourStepProps[]
  open?: boolean
  defaultOpen?: boolean
  current?: number
  defaultCurrent?: number
  placement?: TourPlacement
  mask?: boolean | TourMask
  gap?: TourGap
  arrow?: TourArrow
  type?: TourType
  closeIcon?: any
  disabledInteraction?: boolean
  keyboard?: boolean
  zIndex?: number
  scrollIntoViewOptions?: boolean | ScrollIntoViewOptions
  getPopupContainer?: TourGetPopupContainer
  locale?: TourLocale
  indicatorsRender?: (current: number, total: number) => any
  actionsRender?: (originNode: any, info: { current: number; total: number }) => any
  className?: string
  style?: Record<string, any>
  classNames?: TourClassNames
  styles?: TourStyles
  onChange?: (current: number) => void
  onClose?: () => void
  onFinish?: () => void
  onOpenChange?: (open: boolean) => void
  [key: string]: any
}

interface SpotlightRect {
  left: number
  top: number
  width: number
  height: number
  radius: number
  centerX: number
  centerY: number
  right: number
  bottom: number
}

const defaultLocale: Required<TourLocale> = {
  next: '下一步',
  previous: '上一步',
  finish: '完成',
  close: '关闭引导',
}

const viewportPadding = 16
const panelGap = 18

const mergeClassName = (...values: Array<string | undefined | false | null>) => {
  return values.filter(Boolean).join(' ')
}

const mergeStyle = (...values: Array<Record<string, any> | undefined>) => {
  const merged: Record<string, any> = {}
  values.forEach(value => {
    if (value) Object.assign(merged, value)
  })
  return merged
}

const toPx = (value: number) => `${value}px`

const mergeSemanticClassNames = (
  base?: TourClassNames,
  override?: TourClassNames,
): TourClassNames => {
  const merged: TourClassNames = {}
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(override ?? {})])

  keys.forEach(key => {
    const nextClassName = mergeClassName((base as any)?.[key], (override as any)?.[key])
    if (nextClassName) {
      ;(merged as any)[key] = nextClassName
    }
  })

  return merged
}

const mergeSemanticStyles = (base?: TourStyles, override?: TourStyles): TourStyles => {
  const merged: TourStyles = {}
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(override ?? {})])

  keys.forEach(key => {
    const nextStyle = mergeStyle((base as any)?.[key], (override as any)?.[key])
    if (Object.keys(nextStyle).length > 0) {
      ;(merged as any)[key] = nextStyle
    }
  })

  return merged
}

const clamp = (value: number, min: number, max: number) => {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

const resolveContainer = (container?: TourGetPopupContainer) => {
  if (typeof container === 'function') return container()
  return container
}

const resolveTargetElement = (target?: TourTarget) => {
  if (typeof target === 'function') return target() ?? null
  return target ?? null
}

const resolveOffset = (gap?: TourGap) => {
  const source = gap?.offset ?? 8
  if (Array.isArray(source)) {
    return {
      horizontal: Math.max(0, source[0] ?? 0),
      vertical: Math.max(0, source[1] ?? source[0] ?? 0),
    }
  }

  const value = Math.max(0, source)
  return { horizontal: value, vertical: value }
}

const resolveRadius = (gap?: TourGap) => {
  return Math.max(0, gap?.radius ?? 18)
}

const resolveMaskConfig = (mask?: boolean | TourMask) => {
  if (mask === false) return null
  if (mask && typeof mask === 'object') {
    return {
      color: mask.color ?? 'rgba(15, 23, 42, 0.46)',
      style: mask.style,
    }
  }

  return {
    color: 'rgba(15, 23, 42, 0.46)',
    style: undefined,
  }
}

const resolveArrowEnabled = (arrow?: TourArrow) => {
  return arrow !== false
}

const resolveArrowPointAtCenter = (arrow?: TourArrow) => {
  return typeof arrow === 'object' ? arrow.pointAtCenter !== false : true
}

const normalizePlacement = (placement?: TourPlacement): TourPlacement => {
  return placement ?? 'bottom'
}

const getPlacementSide = (placement: TourPlacement) => {
  if (placement === 'center') return 'center'
  if (placement.startsWith('top')) return 'top'
  if (placement.startsWith('bottom')) return 'bottom'
  if (placement.startsWith('left')) return 'left'
  return 'right'
}

const getInversePlacement = (placement: TourPlacement): TourPlacement => {
  switch (placement) {
    case 'top':
      return 'bottom'
    case 'topLeft':
      return 'bottomLeft'
    case 'topRight':
      return 'bottomRight'
    case 'bottom':
      return 'top'
    case 'bottomLeft':
      return 'topLeft'
    case 'bottomRight':
      return 'topRight'
    case 'left':
      return 'right'
    case 'leftTop':
      return 'rightTop'
    case 'leftBottom':
      return 'rightBottom'
    case 'right':
      return 'left'
    case 'rightTop':
      return 'leftTop'
    case 'rightBottom':
      return 'leftBottom'
    default:
      return 'center'
  }
}

const resolveViewport = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { width: 1440, height: 900 }
  }

  return {
    width: document.documentElement.clientWidth || window.innerWidth || 1440,
    height: document.documentElement.clientHeight || window.innerHeight || 900,
  }
}

export const buildSpotlightRect = (
  element: HTMLElement | null,
  gap?: TourGap,
): SpotlightRect | null => {
  if (!element) return null

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const viewport = resolveViewport()
  const offset = resolveOffset(gap)
  const radius = resolveRadius(gap)
  const left = clamp(rect.left - offset.horizontal, 4, viewport.width - 4)
  const top = clamp(rect.top - offset.vertical, 4, viewport.height - 4)
  const right = clamp(rect.right + offset.horizontal, 4, viewport.width - 4)
  const bottom = clamp(rect.bottom + offset.vertical, 4, viewport.height - 4)
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)

  return {
    left,
    top,
    width,
    height,
    radius,
    centerX: left + width / 2,
    centerY: top + height / 2,
    right,
    bottom,
  }
}

const buildPanelCoordinates = (
  placement: TourPlacement,
  spotlight: SpotlightRect,
  panelWidth: number,
  panelHeight: number,
) => {
  switch (placement) {
    case 'top':
      return {
        left: spotlight.centerX - panelWidth / 2,
        top: spotlight.top - panelHeight - panelGap,
      }
    case 'topLeft':
      return { left: spotlight.left, top: spotlight.top - panelHeight - panelGap }
    case 'topRight':
      return { left: spotlight.right - panelWidth, top: spotlight.top - panelHeight - panelGap }
    case 'bottom':
      return { left: spotlight.centerX - panelWidth / 2, top: spotlight.bottom + panelGap }
    case 'bottomLeft':
      return { left: spotlight.left, top: spotlight.bottom + panelGap }
    case 'bottomRight':
      return { left: spotlight.right - panelWidth, top: spotlight.bottom + panelGap }
    case 'left':
      return {
        left: spotlight.left - panelWidth - panelGap,
        top: spotlight.centerY - panelHeight / 2,
      }
    case 'leftTop':
      return { left: spotlight.left - panelWidth - panelGap, top: spotlight.top }
    case 'leftBottom':
      return { left: spotlight.left - panelWidth - panelGap, top: spotlight.bottom - panelHeight }
    case 'right':
      return { left: spotlight.right + panelGap, top: spotlight.centerY - panelHeight / 2 }
    case 'rightTop':
      return { left: spotlight.right + panelGap, top: spotlight.top }
    case 'rightBottom':
      return { left: spotlight.right + panelGap, top: spotlight.bottom - panelHeight }
    default:
      return { left: spotlight.centerX - panelWidth / 2, top: spotlight.bottom + panelGap }
  }
}

const shouldFlipPlacement = (
  placement: TourPlacement,
  coordinates: { left: number; top: number },
  panelWidth: number,
  panelHeight: number,
  viewport: { width: number; height: number },
) => {
  switch (getPlacementSide(placement)) {
    case 'top':
      return coordinates.top < viewportPadding
    case 'bottom':
      return coordinates.top + panelHeight > viewport.height - viewportPadding
    case 'left':
      return coordinates.left < viewportPadding
    case 'right':
      return coordinates.left + panelWidth > viewport.width - viewportPadding
    default:
      return false
  }
}

const resolvePanelPlacement = (
  preferredPlacement: TourPlacement,
  spotlight: SpotlightRect | null,
  panelWidth: number,
  panelHeight: number,
) => {
  const viewport = resolveViewport()

  if (!spotlight || preferredPlacement === 'center') {
    return {
      placement: 'center' as TourPlacement,
      left: clamp(
        (viewport.width - panelWidth) / 2,
        viewportPadding,
        viewport.width - panelWidth - viewportPadding,
      ),
      top: clamp(
        (viewport.height - panelHeight) / 2,
        viewportPadding,
        viewport.height - panelHeight - viewportPadding,
      ),
    }
  }

  let actualPlacement: TourPlacement = preferredPlacement
  let coordinates = buildPanelCoordinates(actualPlacement, spotlight, panelWidth, panelHeight)

  if (shouldFlipPlacement(actualPlacement, coordinates, panelWidth, panelHeight, viewport)) {
    actualPlacement = getInversePlacement(actualPlacement)
    coordinates = buildPanelCoordinates(actualPlacement, spotlight, panelWidth, panelHeight)
  }

  return {
    placement: actualPlacement,
    left: clamp(coordinates.left, viewportPadding, viewport.width - panelWidth - viewportPadding),
    top: clamp(coordinates.top, viewportPadding, viewport.height - panelHeight - viewportPadding),
  }
}

const resolveArrowStyle = (
  placement: TourPlacement,
  spotlight: SpotlightRect | null,
  panelLeft: number,
  panelTop: number,
  panelWidth: number,
  panelHeight: number,
  pointAtCenter: boolean,
) => {
  if (!spotlight || placement === 'center') return null

  const horizontalCenter = clamp(spotlight.centerX - panelLeft - 9, 24, panelWidth - 24)
  const verticalCenter = clamp(spotlight.centerY - panelTop - 9, 24, panelHeight - 24)
  const panelInset = pointAtCenter ? undefined : 28

  switch (getPlacementSide(placement)) {
    case 'top':
      return { left: toPx(panelInset ?? horizontalCenter), bottom: '-9px' }
    case 'bottom':
      return { left: toPx(panelInset ?? horizontalCenter), top: '-9px' }
    case 'left':
      return { top: toPx(panelInset ?? verticalCenter), right: '-9px' }
    case 'right':
      return { top: toPx(panelInset ?? verticalCenter), left: '-9px' }
    default:
      return null
  }
}

const DefaultCloseIcon: FC = () => {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

const SparkIcon: FC = () => {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3 1.7 4.2L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.8L12 3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h.01M12 21h.01M19 19h.01" />
    </svg>
  )
}

const Tour: FC<TourProps> = props => {
  const {
    steps = [],
    defaultOpen = false,
    defaultCurrent = 0,
    placement = 'bottom',
    mask = true,
    gap,
    arrow = true,
    type = 'default',
    closeIcon,
    disabledInteraction = false,
    keyboard = true,
    zIndex = 1400,
    scrollIntoViewOptions = { block: 'center', inline: 'center', behavior: 'smooth' },
    getPopupContainer,
    locale,
    indicatorsRender,
    actionsRender,
    className,
    style,
    classNames,
    styles,
    onChange,
    onClose,
    onFinish,
    onOpenChange,
    ...rest
  } = props

  const panelRef = useRef<HTMLDivElement>()
  const rafIdRef = useRef<number>()
  const renderVersion = ref(0)
  const isControlledOpen = typeof props.open === 'boolean'
  const isControlledCurrent = typeof props.current === 'number'
  const uncontrolledOpen = ref(defaultOpen)
  const uncontrolledCurrent = ref(defaultCurrent)
  const lastDefaultOpen = ref(!!defaultOpen)
  const lastDefaultCurrent = ref(Math.max(0, Math.floor(defaultCurrent)))
  const currentOpenRef = ref(isControlledOpen ? !!props.open : defaultOpen)
  const currentIndexRef = ref(
    isControlledCurrent
      ? Math.max(0, Math.floor(props.current as number))
      : Math.max(0, Math.floor(defaultCurrent)),
  )
  const panelStyleRef = ref<Record<string, any>>({ visibility: 'hidden', opacity: 0 })
  const arrowStyleRef = ref<Record<string, any> | null>(null)
  const spotlightRef = ref<SpotlightRect | null>(null)
  const placementRef = ref<TourPlacement>(normalizePlacement(placement))

  const mergedLocale: Required<TourLocale> = {
    ...defaultLocale,
    ...locale,
  }

  const getTotal = () => steps.length
  const normalizeCurrentValue = (nextCurrent: number) => {
    const total = getTotal()
    if (total <= 0) return 0
    return clamp(Math.floor(nextCurrent), 0, total - 1)
  }
  const getMergedOpen = () => (isControlledOpen ? !!props.open : currentOpenRef.value)
  const getMergedCurrent = () => {
    return normalizeCurrentValue(
      isControlledCurrent ? (props.current as number) : currentIndexRef.value,
    )
  }
  const getCurrentStep = () => steps[getMergedCurrent()]
  const requestRender = () => {
    renderVersion.value += 1
  }

  const requestOpenChange = (nextOpen: boolean) => {
    currentOpenRef.value = nextOpen
    if (!isControlledOpen) {
      uncontrolledOpen.value = nextOpen
    }
    requestRender()
    if (onOpenChange) onOpenChange(nextOpen)
  }

  const requestCurrentChange = (nextCurrent: number) => {
    const total = getTotal()
    if (total <= 0) return
    const normalized = clamp(nextCurrent, 0, total - 1)
    currentIndexRef.value = normalized
    if (!isControlledCurrent) {
      uncontrolledCurrent.value = normalized
    }
    requestRender()
    if (onChange) onChange(normalized)
  }

  const scheduleLayoutSync = () => {
    if (typeof window === 'undefined') return
    if (rafIdRef.current != null) {
      window.cancelAnimationFrame(rafIdRef.current)
    }
    rafIdRef.current = window.requestAnimationFrame(() => {
      const panelElement =
        panelRef.current ??
        (document.querySelector('[data-rue-tour-panel="true"]') as HTMLDivElement | null)
      const step = getCurrentStep()
      const mergedOpen = getMergedOpen()

      if (!mergedOpen || !panelElement || !step) {
        panelStyleRef.value = { visibility: 'hidden', opacity: 0 }
        spotlightRef.value = null
        arrowStyleRef.value = null
        requestRender()
        return
      }

      const targetElement = resolveTargetElement(step.target)
      const spotlight = buildSpotlightRect(targetElement, gap)
      const panelRect = panelElement.getBoundingClientRect()
      const nextPlacement = normalizePlacement(step.placement ?? placement)
      const resolvedPanel = resolvePanelPlacement(
        nextPlacement,
        spotlight,
        Math.max(panelRect.width, 320),
        Math.max(panelRect.height, 1),
      )
      const arrowEnabled = resolveArrowEnabled(step.arrow ?? arrow)
      const pointAtCenter = resolveArrowPointAtCenter(step.arrow ?? arrow)

      spotlightRef.value = spotlight
      placementRef.value = resolvedPanel.placement
      panelStyleRef.value = {
        left: toPx(resolvedPanel.left),
        top: toPx(resolvedPanel.top),
        opacity: 1,
        visibility: 'visible',
      }
      arrowStyleRef.value = arrowEnabled
        ? resolveArrowStyle(
            resolvedPanel.placement,
            spotlight,
            resolvedPanel.left,
            resolvedPanel.top,
            panelRect.width,
            panelRect.height,
            pointAtCenter,
          )
        : null
      requestRender()
    })
  }

  const syncScrollIntoView = () => {
    const step = getCurrentStep()
    const mergedOpen = getMergedOpen()
    if (!mergedOpen || !step || typeof window === 'undefined') return

    const targetElement = resolveTargetElement(step.target)
    const behavior = step.scrollIntoViewOptions ?? scrollIntoViewOptions
    if (!targetElement || behavior === false || typeof targetElement.scrollIntoView !== 'function')
      return

    window.requestAnimationFrame(() => {
      targetElement.scrollIntoView(
        behavior === true ? { block: 'center', inline: 'center', behavior: 'smooth' } : behavior,
      )
    })
  }

  const handleClose = () => {
    const step = getCurrentStep()
    step?.onClose?.()
    requestOpenChange(false)
    if (onClose) onClose()
  }

  const handleMaskClick = () => {
    handleClose()
  }

  const handleNext = () => {
    const step = getCurrentStep()
    if (!step) return
    step.nextButtonProps?.onClick?.()
    const currentIndex = getMergedCurrent()
    if (currentIndex >= getTotal() - 1) {
      if (onFinish) onFinish()
      requestOpenChange(false)
      return
    }
    requestCurrentChange(currentIndex + 1)
  }

  const handlePrev = () => {
    const step = getCurrentStep()
    if (!step) return
    step.prevButtonProps?.onClick?.()
    requestCurrentChange(getMergedCurrent() - 1)
  }

  onMounted(() => {
    if (typeof window === 'undefined') return

    const handleWindowKeydown = (event: KeyboardEvent) => {
      if (!getMergedOpen() || !keyboard) return
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleNext()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handlePrev()
      }
    }

    const handleWindowChange = () => {
      scheduleLayoutSync()
    }

    window.addEventListener('resize', handleWindowChange)
    window.addEventListener('scroll', handleWindowChange, true)
    window.addEventListener('keydown', handleWindowKeydown)

    syncScrollIntoView()
    scheduleLayoutSync()

    onUnmounted(() => {
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
      window.removeEventListener('keydown', handleWindowKeydown)
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current)
      }
    })
  })

  watch(
    () => props.open,
    nextOpen => {
      if (typeof nextOpen === 'boolean') {
        currentOpenRef.value = nextOpen
      }
    },
    { immediate: true },
  )

  watch(
    () => props.current,
    nextCurrent => {
      if (typeof nextCurrent === 'number') {
        currentIndexRef.value = normalizeCurrentValue(nextCurrent)
      }
    },
    { immediate: true },
  )

  watch(
    () => steps.length,
    () => {
      currentIndexRef.value = normalizeCurrentValue(currentIndexRef.value)
    },
    { immediate: true },
  )

  watch(
    () => [
      getMergedOpen(),
      getMergedCurrent(),
      steps.length,
      placement,
      gap?.radius ?? -1,
      Array.isArray(gap?.offset)
        ? `${gap?.offset[0] ?? 0}:${gap?.offset[1] ?? 0}`
        : (gap?.offset ?? -1),
    ],
    () => {
      syncScrollIntoView()
      scheduleLayoutSync()
    },
    { immediate: true },
  )

  watch(
    () => defaultOpen,
    nextValue => {
      const normalizedDefaultOpen = !!nextValue
      if (!isControlledOpen && normalizedDefaultOpen !== lastDefaultOpen.value) {
        lastDefaultOpen.value = normalizedDefaultOpen
        uncontrolledOpen.value = normalizedDefaultOpen
        currentOpenRef.value = normalizedDefaultOpen
      }
    },
  )

  watch(
    () => defaultCurrent,
    (nextValue: number) => {
      const normalizedDefaultCurrent = Math.max(0, Math.floor(nextValue))
      if (!isControlledCurrent && normalizedDefaultCurrent !== lastDefaultCurrent.value) {
        lastDefaultCurrent.value = normalizedDefaultCurrent
        uncontrolledCurrent.value = normalizedDefaultCurrent
        currentIndexRef.value = normalizeCurrentValue(normalizedDefaultCurrent)
      }
    },
  )

  const total = steps.length
  const currentIndex = (() => {
    void renderVersion.value
    return normalizeCurrentValue(
      isControlledCurrent ? (props.current as number) : currentIndexRef.value,
    )
  })()
  const step = total > 0 ? steps[currentIndex] : undefined
  const mergedOpen = (() => {
    void renderVersion.value
    return isControlledOpen ? !!props.open : currentOpenRef.value
  })()

  if (!mergedOpen || !step || total === 0) return null

  const mergedMask = resolveMaskConfig(step.mask ?? mask)
  const mergedType = step.type ?? type
  const stepLocale: Required<TourLocale> = {
    ...mergedLocale,
    ...step.locale,
  }
  const mergedClassNames = mergeSemanticClassNames(classNames, step.classNames)
  const mergedStyles = mergeSemanticStyles(styles, step.styles)
  const fallbackSpotlight = buildSpotlightRect(resolveTargetElement(step.target), gap)
  const fallbackPanelPlacement = resolvePanelPlacement(
    normalizePlacement(step.placement ?? placement),
    fallbackSpotlight,
    368,
    225,
  )
  const effectivePanelStyle =
    panelStyleRef.value.visibility === 'visible'
      ? panelStyleRef.value
      : {
          left: toPx(fallbackPanelPlacement.left),
          top: toPx(fallbackPanelPlacement.top),
          opacity: 1,
          visibility: 'visible',
        }
  const panelPlacement =
    panelStyleRef.value.visibility === 'visible'
      ? placementRef.value
      : fallbackPanelPlacement.placement
  const measuredSpotlight = spotlightRef.value
  const resolvedSpotlight =
    measuredSpotlight && measuredSpotlight.width > 0 && measuredSpotlight.height > 0
      ? measuredSpotlight
      : fallbackSpotlight
  const hasSpotlight = !!resolvedSpotlight
  const indicatorRenderer = step.indicatorsRender ?? indicatorsRender
  const footerActionsRenderer = step.actionsRender ?? actionsRender
  const resolvedCloseIcon = step.closeIcon ?? closeIcon ?? <DefaultCloseIcon />
  const rootNode = (
    <div
      {...rest}
      className={mergeClassName(
        'pointer-events-none fixed inset-0',
        mergedClassNames.root,
        className,
      )}
      style={mergeStyle(mergedStyles.root, style, { zIndex })}
      data-rue-tour="true"
      data-rue-tour-placement={panelPlacement}
      data-rue-tour-version={String(renderVersion.value)}
      data-rue-tour-current={String(
        isControlledCurrent ? (props.current as number) : currentIndexRef.value,
      )}
      data-rue-tour-total={String(total)}
      data-rue-tour-open={String(isControlledOpen ? !!props.open : currentOpenRef.value)}
    >
      {mergedMask ? (
        <>
          {hasSpotlight ? (
            <>
              <div
                aria-hidden="true"
                className={mergeClassName(
                  'pointer-events-auto fixed inset-x-0 top-0',
                  mergedClassNames.mask,
                )}
                style={mergeStyle(mergedStyles.mask, mergedMask.style, {
                  height: toPx(resolvedSpotlight.top),
                  background: mergedMask.color,
                })}
                onClick={handleMaskClick}
                data-rue-tour-mask="true"
                data-rue-tour-mask-part="top"
              />
              <div
                aria-hidden="true"
                className={mergeClassName('pointer-events-auto fixed', mergedClassNames.mask)}
                style={mergeStyle(mergedStyles.mask, mergedMask.style, {
                  left: '0px',
                  top: toPx(resolvedSpotlight.top),
                  width: toPx(resolvedSpotlight.left),
                  height: toPx(resolvedSpotlight.height),
                  background: mergedMask.color,
                })}
                onClick={handleMaskClick}
                data-rue-tour-mask="true"
                data-rue-tour-mask-part="left"
              />
              <div
                aria-hidden="true"
                className={mergeClassName('pointer-events-auto fixed', mergedClassNames.mask)}
                style={mergeStyle(mergedStyles.mask, mergedMask.style, {
                  left: toPx(resolvedSpotlight.right),
                  top: toPx(resolvedSpotlight.top),
                  width: `calc(100vw - ${resolvedSpotlight.right}px)`,
                  height: toPx(resolvedSpotlight.height),
                  background: mergedMask.color,
                })}
                onClick={handleMaskClick}
                data-rue-tour-mask="true"
                data-rue-tour-mask-part="right"
              />
              <div
                aria-hidden="true"
                className={mergeClassName(
                  'pointer-events-auto fixed inset-x-0 bottom-0',
                  mergedClassNames.mask,
                )}
                style={mergeStyle(mergedStyles.mask, mergedMask.style, {
                  top: toPx(resolvedSpotlight.bottom),
                  background: mergedMask.color,
                })}
                onClick={handleMaskClick}
                data-rue-tour-mask="true"
                data-rue-tour-mask-part="bottom"
              />
              <div
                aria-hidden="true"
                className={mergeClassName(
                  'pointer-events-none fixed border border-primary/25 bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_20px_60px_-36px_rgba(59,130,246,0.75)] backdrop-blur-[1px]',
                  mergedClassNames.spotlight,
                )}
                style={mergeStyle(mergedStyles.spotlight, {
                  left: toPx(resolvedSpotlight.left),
                  top: toPx(resolvedSpotlight.top),
                  width: toPx(resolvedSpotlight.width),
                  height: toPx(resolvedSpotlight.height),
                  borderRadius: toPx(resolvedSpotlight.radius),
                })}
                data-rue-tour-spotlight="true"
              />
              {disabledInteraction ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-auto fixed"
                  style={{
                    left: toPx(resolvedSpotlight.left),
                    top: toPx(resolvedSpotlight.top),
                    width: toPx(resolvedSpotlight.width),
                    height: toPx(resolvedSpotlight.height),
                    borderRadius: toPx(resolvedSpotlight.radius),
                  }}
                  data-rue-tour-blocker="true"
                />
              ) : null}
            </>
          ) : (
            <div
              aria-hidden="true"
              className={mergeClassName('pointer-events-auto fixed inset-0', mergedClassNames.mask)}
              style={mergeStyle(mergedStyles.mask, mergedMask.style, {
                background: mergedMask.color,
              })}
              onClick={handleMaskClick}
              data-rue-tour-mask="true"
              data-rue-tour-mask-part="full"
            />
          )}
        </>
      ) : null}

      <div
        ref={(element: HTMLDivElement | null) => {
          panelRef.current = element ?? undefined
          if (element) {
            scheduleLayoutSync()
          }
        }}
        role="dialog"
        aria-modal={mergedMask ? 'true' : 'false'}
        className={mergeClassName(
          'pointer-events-auto fixed w-[min(92vw,23rem)] rounded-[14px] border px-0 py-0 transition duration-200 ease-out md:w-[23rem]',
          mergedType === 'primary'
            ? 'border-primary/25 bg-[linear-gradient(180deg,rgba(8,47,73,0.98),rgba(8,78,119,0.96))] text-primary-content shadow-[0_28px_90px_-40px_rgba(15,23,42,0.7)] backdrop-blur-xl'
            : 'border-black/[0.06] bg-white text-[#262626] shadow-[0_12px_32px_rgba(0,0,0,0.18),0_3px_10px_rgba(0,0,0,0.12)]',
          mergedClassNames.panel,
          step.className,
        )}
        style={mergeStyle(mergedStyles.panel, step.style, effectivePanelStyle)}
        data-rue-tour-panel="true"
      >
        {arrowStyleRef.value ? (
          <span
            aria-hidden="true"
            className={mergeClassName(
              'absolute size-[14px] rotate-45 border',
              mergedType === 'primary'
                ? 'border-primary/20 bg-sky-900 shadow-[8px_8px_18px_-14px_rgba(15,23,42,0.75)]'
                : 'border-black/[0.06] bg-white shadow-[8px_8px_18px_-14px_rgba(0,0,0,0.28)]',
              mergedClassNames.arrow,
            )}
            style={mergeStyle(mergedStyles.arrow, arrowStyleRef.value)}
            data-rue-tour-arrow="true"
          />
        ) : null}

        <div
          className={mergeClassName('relative px-6 pb-5 pt-5', mergedClassNames.section)}
          style={mergedStyles.section}
          data-rue-tour-section="true"
        >
          <button
            type="button"
            aria-label={String(stepLocale.close)}
            className={mergeClassName(
              'absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full transition',
              mergedType === 'primary'
                ? 'text-primary-content/80 hover:bg-white/10 hover:text-primary-content'
                : 'text-black/35 hover:bg-black/[0.04] hover:text-black/60',
              mergedClassNames.close,
            )}
            style={mergedStyles.close}
            onClick={handleClose}
            data-rue-tour-close="true"
          >
            {resolvedCloseIcon}
          </button>

          {step.cover ? (
            <div
              className={mergeClassName(
                'mb-5 overflow-hidden rounded-[12px]',
                mergedClassNames.cover,
              )}
              style={mergedStyles.cover}
              data-rue-tour-cover="true"
            >
              {step.cover}
            </div>
          ) : null}

          <div
            className={mergeClassName('pr-11', mergedClassNames.body)}
            style={mergedStyles.body}
            data-rue-tour-body="true"
          >
            <div
              className={mergeClassName(
                'mb-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium',
                mergedType === 'primary'
                  ? 'bg-white/10 text-primary-content/70'
                  : 'border border-black/[0.06] bg-[#fafafa] text-[#8c8c8c]',
                mergedClassNames.meta,
              )}
              style={mergedStyles.meta}
              data-rue-tour-meta="true"
            >
              <SparkIcon />
              <span>Tour</span>
              <span
                className={
                  mergedType === 'primary' ? 'text-primary-content/50' : 'text-base-content/40'
                }
              >
                {String(currentIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
            </div>
            <div
              className={mergeClassName('', mergedClassNames.header)}
              style={mergedStyles.header}
              data-rue-tour-header="true"
            >
              {step.title ? (
                <div
                  className={mergeClassName(
                    'text-[1.08rem] font-semibold leading-7 tracking-[0.01em]',
                    mergedClassNames.title,
                  )}
                  style={mergedStyles.title}
                  data-rue-tour-title="true"
                >
                  {step.title}
                </div>
              ) : null}
            </div>
            {step.description ? (
              <div
                className={mergeClassName(
                  'mt-3 text-[15px] leading-7',
                  mergedType === 'primary' ? 'text-primary-content/80' : 'text-[#595959]',
                  mergedClassNames.description,
                )}
                style={mergedStyles.description}
                data-rue-tour-description="true"
              >
                {step.description}
              </div>
            ) : null}
          </div>

          {(() => {
            const originIndicators = indicatorRenderer ? (
              indicatorRenderer(currentIndex, total)
            ) : (
              <div
                className={mergeClassName(
                  'flex flex-wrap items-center gap-2.5',
                  mergedClassNames.indicators,
                )}
                style={mergedStyles.indicators}
                data-rue-tour-indicators="true"
              >
                {Array.from({ length: total }).map((_, index) => (
                  <span
                    key={`indicator-${index}`}
                    className={mergeClassName(
                      'block size-2.5 rounded-full transition-all duration-200',
                      index === currentIndex
                        ? mergedType === 'primary'
                          ? 'bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.18)]'
                          : 'bg-[#1677ff] shadow-[0_0_0_2px_rgba(22,119,255,0.14)]'
                        : mergedType === 'primary'
                          ? 'bg-white/30'
                          : 'bg-black/12',
                      mergedClassNames.indicator,
                    )}
                    style={mergedStyles.indicator}
                    data-rue-tour-indicator={index === currentIndex ? 'active' : 'inactive'}
                    data-rue-tour-indicator-index={String(index)}
                  />
                ))}
              </div>
            )

            const prevDisabled = currentIndex === 0 || step.prevButtonProps?.disabled
            const nextDisabled = !!step.nextButtonProps?.disabled
            const originActions = (
              <div
                className={mergeClassName(
                  'flex flex-wrap items-center justify-between gap-3',
                  mergedClassNames.actions,
                )}
                style={mergedStyles.actions}
                data-rue-tour-actions="true"
              >
                {originIndicators}
                <div
                  className={mergeClassName('flex items-center gap-2.5', mergedClassNames.buttons)}
                  style={mergedStyles.buttons}
                  data-rue-tour-buttons="true"
                >
                  <button
                    type="button"
                    className={mergeClassName(
                      'inline-flex h-10 min-w-[84px] items-center justify-center rounded-[10px] border px-4 text-[14px] font-medium transition disabled:cursor-not-allowed',
                      mergedType === 'primary'
                        ? 'border-white/18 bg-transparent text-primary-content/78 hover:bg-white/10 hover:text-primary-content disabled:border-white/10 disabled:text-white/28'
                        : 'border-black/[0.08] bg-white text-[#595959] hover:border-black/[0.12] hover:bg-[#fafafa] disabled:border-black/[0.06] disabled:bg-[#fafafa] disabled:text-black/25',
                      mergedClassNames.prevButton,
                      step.prevButtonProps?.className,
                    )}
                    style={mergeStyle(mergedStyles.prevButton, step.prevButtonProps?.style)}
                    disabled={prevDisabled}
                    onClick={handlePrev}
                    data-rue-tour-prev="true"
                  >
                    {step.prevButtonProps?.children ?? stepLocale.previous}
                  </button>
                  <button
                    type="button"
                    className={mergeClassName(
                      'inline-flex h-10 min-w-[96px] items-center justify-center rounded-[10px] border px-4 text-[14px] font-medium transition disabled:cursor-not-allowed',
                      mergedType === 'primary'
                        ? 'border-0 bg-white text-sky-900 shadow-[0_2px_0_rgba(255,255,255,0.08)] hover:bg-sky-50 disabled:bg-white/40 disabled:text-sky-950/40'
                        : 'border-[#1677ff] bg-[#1677ff] text-white shadow-[0_2px_0_rgba(5,145,255,0.12)] hover:border-[#4096ff] hover:bg-[#4096ff] disabled:border-[#91caff] disabled:bg-[#91caff]',
                      mergedClassNames.nextButton,
                      step.nextButtonProps?.className,
                    )}
                    style={mergeStyle(mergedStyles.nextButton, step.nextButtonProps?.style)}
                    disabled={nextDisabled}
                    onClick={handleNext}
                    data-rue-tour-next={currentIndex === total - 1 ? 'finish' : 'next'}
                  >
                    {step.nextButtonProps?.children ??
                      (currentIndex === total - 1 ? stepLocale.finish : stepLocale.next)}
                  </button>
                </div>
              </div>
            )

            const footerNode = footerActionsRenderer
              ? footerActionsRenderer(originActions, { current: currentIndex, total })
              : originActions

            return footerNode ? (
              <div
                className={mergeClassName(
                  'mt-5 border-t pt-4',
                  mergedType === 'primary' ? 'border-white/10' : 'border-black/[0.06]',
                  mergedClassNames.footer,
                )}
                style={mergedStyles.footer}
                data-rue-tour-footer="true"
              >
                {footerNode}
              </div>
            ) : null
          })()}
        </div>
      </div>
    </div>
  )

  const resolvedContainer = resolveContainer(getPopupContainer)

  if (resolvedContainer === false || resolvedContainer == null) {
    return rootNode
  }

  return <Teleport to={resolvedContainer}>{rootNode}</Teleport>
}

export default Tour
