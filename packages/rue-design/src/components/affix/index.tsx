/*
Affix 模块概述
- 汇总固钉组件的公开类型、渲染入口和局部工具逻辑。
- 导出注释用于 API 文档生成，内部注释标明状态归一化、样式映射与 DOM 交互边界。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, ref, useRef, watch } from '@rue-js/rue'

/** AffixTarget 类型。 */
export type AffixTarget = HTMLElement | Window | null | undefined

/** AffixClassNames 局部类名配置。 */
export interface AffixClassNames {
  /** 根节点区域配置。 */
  root?: string
  /** fixed 配置项。 */
  fixed?: string
}

/** AffixStyles 局部样式配置。 */
export interface AffixStyles {
  /** 根节点区域配置。 */
  root?: Record<string, any>
  /** fixed 配置项。 */
  fixed?: Record<string, any>
}

/** AffixProps 组件属性。 */
export interface AffixProps {
  /** offsetTop 配置项。 */
  offsetTop?: number
  /** offsetBottom 配置项。 */
  offsetBottom?: number
  /** 根节点内联样式。 */
  style?: Record<string, any>
  /** 值或状态变化时触发的回调。 */
  onChange?: (affixed?: boolean) => void
  /** 链接或定位目标。 */
  target?: () => AffixTarget
  /** 根节点附加类名。 */
  className?: string
  /** 根节点附加类名。 */
  rootClassName?: string
  /** 组件子内容。 */
  children?: any
  /** 按局部区域覆盖的类名集合。 */
  classNames?: AffixClassNames
  /** 按局部区域覆盖的内联样式集合。 */
  styles?: AffixStyles
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** TRIGGER_EVENTS 内部常量。 */
const TRIGGER_EVENTS: Array<keyof WindowEventMap> = [
  'resize',
  'scroll',
  'touchstart',
  'touchmove',
  'touchend',
  'pageshow',
  'load',
]

/** RESET_ROOT_STYLE 内部常量。 */
const RESET_ROOT_STYLE = {
  width: '',
  height: '',
}

/** RESET_FIXED_STYLE 内部常量。 */
const RESET_FIXED_STYLE = {
  position: '',
  top: '',
  bottom: '',
  left: '',
  width: '',
  height: '',
}

/** append Class Name 的内部工具函数。 */
const appendClassName = (base?: string, className?: string) => {
  if (base && className) return `${base} ${className}`
  return base ?? className ?? ''
}

/** 解析 Window 的内部工具函数。 */
const resolveWindow = (target?: AffixTarget) => {
  if (typeof window === 'undefined') return undefined
  if (target && 'ownerDocument' in target) {
    return target.ownerDocument?.defaultView ?? window
  }
  return window
}

/** 判断 Window Target 的内部工具函数。 */
const isWindowTarget = (target: AffixTarget, currentWindow: Window) => {
  return target === currentWindow
}

/** 判断 Element Target 的内部工具函数。 */
const isElementTarget = (target: AffixTarget, currentWindow: Window): target is HTMLElement => {
  return !!target && !isWindowTarget(target, currentWindow) && 'getBoundingClientRect' in target
}

/** 构建 Viewport Rect 的内部工具函数。 */
const buildViewportRect = (currentWindow: Window) => {
  const width =
    currentWindow.innerWidth ||
    currentWindow.document.documentElement.clientWidth ||
    currentWindow.document.body.clientWidth ||
    0
  const height =
    currentWindow.innerHeight ||
    currentWindow.document.documentElement.clientHeight ||
    currentWindow.document.body.clientHeight ||
    0

  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

/** 读取 Target Rect 的内部工具函数。 */
const getTargetRect = (target: AffixTarget, currentWindow: Window) => {
  if (isElementTarget(target, currentWindow)) {
    return target.getBoundingClientRect()
  }
  return buildViewportRect(currentWindow)
}

/** 读取 Fixed Top 的内部工具函数。 */
const getFixedTop = (placeholderRect: DOMRect, targetRect: DOMRect, offsetTop?: number) => {
  if (
    offsetTop !== undefined &&
    Math.round(targetRect.top) > Math.round(placeholderRect.top) - offsetTop
  ) {
    return offsetTop + targetRect.top
  }
  return undefined
}

/** 读取 Fixed Bottom 的内部工具函数。 */
const getFixedBottom = (
  placeholderRect: DOMRect,
  targetRect: DOMRect,
  currentWindow: Window,
  offsetBottom?: number,
) => {
  if (
    offsetBottom !== undefined &&
    Math.round(targetRect.bottom) < Math.round(placeholderRect.bottom) + offsetBottom
  ) {
    return offsetBottom + (currentWindow.innerHeight - targetRect.bottom)
  }
  return undefined
}

/** Affix 的内部工具函数。 */
const Affix: FC<AffixProps> = ({
  offsetTop,
  offsetBottom,
  style,
  onChange,
  target,
  className,
  rootClassName,
  children,
  classNames,
  styles,
  ...rest
}) => {
  const affixed = ref(false)
  let currentAffixed = false
  const affixStyle = ref<Record<string, any> | undefined>(undefined)
  const placeholderStyle = ref<Record<string, any> | undefined>(undefined)
  const placeholderRef = useRef<HTMLDivElement>()
  const targetRef = useRef<AffixTarget>()
  const cleanupRef = useRef<(() => void) | undefined>(undefined)
  const frameRef = useRef<number | undefined>(undefined)
  const mountTimerRef = useRef<number | undefined>(undefined)
  const resizeObserverRef = useRef<ResizeObserver | undefined>(undefined)
  const resolvedOffsetTop = offsetBottom === undefined && offsetTop === undefined ? 0 : offsetTop

  const resolveTarget = () => target?.() ?? resolveWindow()

  const clearFrame = () => {
    const currentWindow = resolveWindow(targetRef.current)
    if (!currentWindow || frameRef.current == null) return
    currentWindow.cancelAnimationFrame(frameRef.current)
    frameRef.current = undefined
  }

  const clearMountTimer = () => {
    const currentWindow = resolveWindow(targetRef.current)
    if (!currentWindow || mountTimerRef.current == null) return
    currentWindow.clearTimeout(mountTimerRef.current)
    mountTimerRef.current = undefined
  }

  const disconnectResizeObserver = () => {
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = undefined
  }

  const updateState = (
    nextAffixStyle?: Record<string, any>,
    nextPlaceholderStyle?: Record<string, any>,
  ) => {
    const nextAffixed = !!nextAffixStyle
    if (currentAffixed !== nextAffixed) {
      currentAffixed = nextAffixed
      onChange?.(nextAffixed)
    }
    const root = placeholderRef.current
    const fixed = root?.querySelector('[data-rue-affix-fixed]') as HTMLElement | null
    root?.setAttribute('data-rue-affixed', nextAffixed ? 'true' : 'false')
    fixed?.setAttribute('data-rue-affix-fixed', nextAffixed ? 'true' : 'false')
    if (root) {
      root.style.width = nextPlaceholderStyle?.width ?? ''
      root.style.height = nextPlaceholderStyle?.height ?? ''
    }
    if (fixed) {
      fixed.style.position = nextAffixStyle?.position ?? ''
      fixed.style.top = nextAffixStyle?.top ?? ''
      fixed.style.bottom = nextAffixStyle?.bottom ?? ''
      fixed.style.left = nextAffixStyle?.left ?? ''
      fixed.style.width = nextAffixStyle?.width ?? ''
      fixed.style.height = nextAffixStyle?.height ?? ''
    }
  }

  const measure = () => {
    if (typeof window === 'undefined') return

    const placeholderElement = placeholderRef.current
    if (!placeholderElement) return

    const nextTarget = resolveTarget()
    const currentWindow = resolveWindow(nextTarget)

    if (!nextTarget || !currentWindow) {
      updateState(undefined, undefined)
      return
    }

    const placeholderRect = placeholderElement.getBoundingClientRect()
    if (
      placeholderRect.top === 0 &&
      placeholderRect.left === 0 &&
      placeholderRect.width === 0 &&
      placeholderRect.height === 0
    ) {
      updateState(undefined, undefined)
      return
    }

    const targetRect = getTargetRect(nextTarget, currentWindow)
    const fixedTop = getFixedTop(placeholderRect, targetRect, resolvedOffsetTop)
    const fixedBottom =
      fixedTop === undefined
        ? getFixedBottom(placeholderRect, targetRect, currentWindow, offsetBottom)
        : undefined

    if (fixedTop === undefined && fixedBottom === undefined) {
      updateState(undefined, undefined)
      return
    }

    updateState(
      {
        position: 'fixed',
        top: fixedTop != null ? `${fixedTop}px` : undefined,
        bottom: fixedBottom != null ? `${fixedBottom}px` : undefined,
        left: `${placeholderRect.left}px`,
        width: `${placeholderRect.width}px`,
        height: `${placeholderRect.height}px`,
      },
      {
        width: `${placeholderRect.width}px`,
        height: `${placeholderRect.height}px`,
      },
    )
  }

  const scheduleMeasure = () => {
    const currentWindow = resolveWindow(resolveTarget())
    if (!currentWindow || typeof currentWindow.requestAnimationFrame !== 'function') {
      measure()
      return
    }

    clearFrame()
    frameRef.current = currentWindow.requestAnimationFrame(() => {
      frameRef.current = undefined
      measure()
    })
  }

  const bindResizeObserver = () => {
    disconnectResizeObserver()

    if (typeof ResizeObserver === 'undefined') return

    const placeholderElement = placeholderRef.current
    if (!placeholderElement) return

    const observer = new ResizeObserver(() => {
      scheduleMeasure()
    })
    observer.observe(placeholderElement)

    const nextTarget = resolveTarget()
    const currentWindow = resolveWindow(nextTarget)
    if (currentWindow && isElementTarget(nextTarget, currentWindow)) {
      observer.observe(nextTarget)
    }

    resizeObserverRef.current = observer
  }

  const bindTargetListeners = () => {
    if (typeof window === 'undefined') return

    const nextTarget = resolveTarget()
    const currentWindow = resolveWindow(nextTarget)
    if (!nextTarget || !currentWindow) return
    if (targetRef.current === nextTarget && cleanupRef.current) return

    cleanupRef.current?.()

    const handleTargetChange = () => {
      scheduleMeasure()
    }

    TRIGGER_EVENTS.forEach(eventName => {
      nextTarget.addEventListener(eventName, handleTargetChange)
    })

    if (!isWindowTarget(nextTarget, currentWindow)) {
      currentWindow.addEventListener('resize', handleTargetChange)
      currentWindow.addEventListener('scroll', handleTargetChange, true)
    }

    targetRef.current = nextTarget
    cleanupRef.current = () => {
      TRIGGER_EVENTS.forEach(eventName => {
        nextTarget.removeEventListener(eventName, handleTargetChange)
      })

      if (!isWindowTarget(nextTarget, currentWindow)) {
        currentWindow.removeEventListener('resize', handleTargetChange)
        currentWindow.removeEventListener('scroll', handleTargetChange, true)
      }

      if (targetRef.current === nextTarget) {
        targetRef.current = undefined
      }
      cleanupRef.current = undefined
    }
  }

  const syncBinding = () => {
    bindTargetListeners()
    bindResizeObserver()
    scheduleMeasure()
  }

  const assignPlaceholderRef = (element: HTMLDivElement | null) => {
    placeholderRef.current = element ?? undefined
    if (element) {
      syncBinding()
    }
  }

  onMounted(() => {
    syncBinding()

    const currentWindow = resolveWindow(resolveTarget())
    if (!currentWindow) return

    mountTimerRef.current = currentWindow.setTimeout(() => {
      mountTimerRef.current = undefined
      syncBinding()
    }, 0)
  })

  onUnmounted(() => {
    clearFrame()
    clearMountTimer()
    disconnectResizeObserver()
    cleanupRef.current?.()
  })

  watch(
    () => target,
    () => {
      syncBinding()
    },
  )

  watch(
    () => offsetTop,
    () => {
      scheduleMeasure()
    },
  )

  watch(
    () => offsetBottom,
    () => {
      scheduleMeasure()
    },
  )

  const mergedRootClassName = appendClassName(
    appendClassName('rue-affix', classNames?.root),
    rootClassName,
  )
  const mergedFixedClassName = appendClassName(
    appendClassName('rue-affix-node', classNames?.fixed),
    className,
  )
  const mergedRootStyle = {
    ...RESET_ROOT_STYLE,
    ...styles?.root,
    ...placeholderStyle.value,
  }
  const mergedFixedStyle = {
    ...RESET_FIXED_STYLE,
    ...styles?.fixed,
    ...style,
    ...affixStyle.value,
  }

  return (
    <div
      {...rest}
      ref={assignPlaceholderRef}
      className={mergedRootClassName}
      style={mergedRootStyle}
      data-rue-affix="true"
      data-rue-affixed={affixed.value ? 'true' : 'false'}
    >
      <div
        className={mergedFixedClassName}
        style={mergedFixedStyle}
        data-rue-affix-fixed={affixed.value ? 'true' : 'false'}
      >
        {children}
      </div>
    </div>
  )
}

/** 默认导出固钉组件。 */
export default Affix
