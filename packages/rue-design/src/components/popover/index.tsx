/*
Popover 组件概述
- 提供接近成熟组件库的悬浮卡片能力，覆盖 hover / focus / click / contextMenu、受控 / 非受控、语义化 classNames/styles 和箭头配置。
- 与 Tooltip 的轻提示不同，Popover 以可交互卡片为核心，适合承载操作按钮、说明块和结构化信息。
- 实现保持为原生 TSX 源文件，交给 Rue 编译器参与优化，而不是预先写入变换结果。
*/
import type { FC } from '@rue-js/rue'
import { h, onMounted, onUnmounted, ref, watch } from '@rue-js/rue'

export type PopoverPlacement =
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

export type PopoverTrigger = 'hover' | 'focus' | 'click' | 'contextMenu'
export type PopoverArrow = boolean | { pointAtCenter?: boolean }

export interface PopoverClassNames {
  root?: string
  trigger?: string
  overlay?: string
  panel?: string
  arrow?: string
  header?: string
  title?: string
  content?: string
}

export interface PopoverStyles {
  root?: Record<string, any>
  trigger?: Record<string, any>
  overlay?: Record<string, any>
  panel?: Record<string, any>
  arrow?: Record<string, any>
  header?: Record<string, any>
  title?: Record<string, any>
  content?: Record<string, any>
}

export interface PopoverProps {
  as?: string
  title?: any
  content?: any
  overlay?: any
  placement?: PopoverPlacement
  trigger?: PopoverTrigger | PopoverTrigger[]
  open?: boolean
  defaultOpen?: boolean
  disabled?: boolean
  arrow?: PopoverArrow
  destroyOnHidden?: boolean
  mouseEnterDelay?: number
  mouseLeaveDelay?: number
  zIndex?: number
  className?: string
  style?: string | Record<string, any>
  triggerClassName?: string
  triggerStyle?: string | Record<string, any>
  overlayClassName?: string
  overlayStyle?: Record<string, any>
  classNames?: PopoverClassNames
  styles?: PopoverStyles
  onOpenChange?: (open: boolean) => void
  children?: any
  [key: string]: any
}

interface PlacementLayout {
  direction: 'top' | 'bottom' | 'left' | 'right'
  align: 'start' | 'center' | 'end'
}

const mergeClassNames = (...parts: Array<string | undefined | false | null>) => {
  return parts.filter(Boolean).join(' ')
}

const mergeStyles = (...parts: Array<Record<string, any> | undefined>) => {
  const merged: Record<string, any> = {}
  parts.forEach(part => {
    if (part) Object.assign(merged, part)
  })
  return merged
}

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const serializeStyle = (style?: string | Record<string, any>) => {
  if (!style) return ''
  if (typeof style === 'string') return style.trim()
  return Object.entries(style)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key.startsWith('--') ? key : toKebabCase(key)}:${String(value)}`)
    .join('; ')
}

const mergeStyleValue = (
  base?: string | Record<string, any>,
  extra?: string | Record<string, any>,
) => {
  const baseStyle = serializeStyle(base)
  const extraStyle = serializeStyle(extra)
  const merged = [baseStyle, extraStyle].filter(Boolean).join('; ')
  return merged || undefined
}

const normalizeTrigger = (trigger?: PopoverTrigger | PopoverTrigger[]) => {
  const source = Array.isArray(trigger) ? trigger : trigger ? [trigger] : ['hover']
  return Array.from(new Set(source)) as PopoverTrigger[]
}

const callHandler = (handler: ((event: any) => void) | undefined, event: any) => {
  if (typeof handler === 'function') handler(event)
}

const resolveRenderable = (value: any) => {
  return typeof value === 'function' ? value() : value
}

const isRenderable = (value: any) => {
  return value !== undefined && value !== null && value !== false
}

const resolvePlacementLayout = (placement: PopoverPlacement): PlacementLayout => {
  switch (placement) {
    case 'top':
      return { direction: 'top', align: 'center' }
    case 'topLeft':
      return { direction: 'top', align: 'start' }
    case 'topRight':
      return { direction: 'top', align: 'end' }
    case 'bottom':
      return { direction: 'bottom', align: 'center' }
    case 'bottomRight':
      return { direction: 'bottom', align: 'end' }
    case 'left':
      return { direction: 'left', align: 'center' }
    case 'leftTop':
      return { direction: 'left', align: 'start' }
    case 'leftBottom':
      return { direction: 'left', align: 'end' }
    case 'right':
      return { direction: 'right', align: 'center' }
    case 'rightTop':
      return { direction: 'right', align: 'start' }
    case 'rightBottom':
      return { direction: 'right', align: 'end' }
    case 'bottomLeft':
    default:
      return { direction: 'bottom', align: 'start' }
  }
}

const getOverlayPlacementClass = (placement: PopoverPlacement) => {
  switch (placement) {
    case 'top':
      return 'bottom-full left-1/2 mb-3 -translate-x-1/2'
    case 'topLeft':
      return 'bottom-full left-0 mb-3'
    case 'topRight':
      return 'bottom-full right-0 mb-3'
    case 'bottom':
      return 'top-full left-1/2 mt-3 -translate-x-1/2'
    case 'bottomRight':
      return 'top-full right-0 mt-3'
    case 'left':
      return 'right-full top-1/2 me-3 -translate-y-1/2'
    case 'leftTop':
      return 'right-full top-0 me-3'
    case 'leftBottom':
      return 'right-full bottom-0 me-3'
    case 'right':
      return 'left-full top-1/2 ms-3 -translate-y-1/2'
    case 'rightTop':
      return 'left-full top-0 ms-3'
    case 'rightBottom':
      return 'left-full bottom-0 ms-3'
    case 'bottomLeft':
    default:
      return 'top-full left-0 mt-3'
  }
}

const getTransformOriginClass = (placement: PopoverPlacement) => {
  switch (placement) {
    case 'top':
    case 'topLeft':
    case 'topRight':
      return 'origin-bottom'
    case 'left':
    case 'leftTop':
    case 'leftBottom':
      return 'origin-right'
    case 'right':
    case 'rightTop':
    case 'rightBottom':
      return 'origin-left'
    case 'bottom':
    case 'bottomLeft':
    case 'bottomRight':
    default:
      return 'origin-top'
  }
}

const resolveArrowClassName = (placement: PopoverPlacement, pointAtCenter: boolean) => {
  const layout = resolvePlacementLayout(placement)
  if (layout.direction === 'top') {
    return mergeClassNames(
      'bottom-[-6px] border-r border-b',
      pointAtCenter || layout.align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : layout.align === 'end'
          ? 'right-5'
          : 'left-5',
    )
  }

  if (layout.direction === 'bottom') {
    return mergeClassNames(
      'top-[-6px] border-l border-t',
      pointAtCenter || layout.align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : layout.align === 'end'
          ? 'right-5'
          : 'left-5',
    )
  }

  if (layout.direction === 'left') {
    return mergeClassNames(
      'right-[-6px] border-r border-t',
      pointAtCenter || layout.align === 'center'
        ? 'top-1/2 -translate-y-1/2'
        : layout.align === 'end'
          ? 'bottom-5'
          : 'top-5',
    )
  }

  return mergeClassNames(
    'left-[-6px] border-l border-b',
    pointAtCenter || layout.align === 'center'
      ? 'top-1/2 -translate-y-1/2'
      : layout.align === 'end'
        ? 'bottom-5'
        : 'top-5',
  )
}

const renderRoot = (
  Component: any,
  domProps: Record<string, any>,
  className: string,
  style: string | undefined,
  setRootElement: (element: HTMLElement | null) => void,
  handleRootMouseEnter: (event: any) => void,
  handleRootMouseLeave: (event: any) => void,
  handleRootFocus: (event: any) => void,
  handleRootBlur: (event: any) => void,
  triggerNode: any,
  overlayNode: any,
) => {
  if (Component === 'span') {
    return (
      <span
        {...domProps}
        className={className}
        style={style}
        ref={setRootElement}
        onMouseEnter={handleRootMouseEnter}
        onMouseLeave={handleRootMouseLeave}
        onFocus={handleRootFocus}
        onBlur={handleRootBlur}
      >
        {triggerNode}
        {overlayNode}
      </span>
    )
  }

  if (Component === 'section') {
    return (
      <section
        {...domProps}
        className={className}
        style={style}
        ref={setRootElement}
        onMouseEnter={handleRootMouseEnter}
        onMouseLeave={handleRootMouseLeave}
        onFocus={handleRootFocus}
        onBlur={handleRootBlur}
      >
        {triggerNode}
        {overlayNode}
      </section>
    )
  }

  if (Component === 'article') {
    return (
      <article
        {...domProps}
        className={className}
        style={style}
        ref={setRootElement}
        onMouseEnter={handleRootMouseEnter}
        onMouseLeave={handleRootMouseLeave}
        onFocus={handleRootFocus}
        onBlur={handleRootBlur}
      >
        {triggerNode}
        {overlayNode}
      </article>
    )
  }

  if (Component === 'label') {
    return (
      <label
        {...domProps}
        className={className}
        style={style}
        ref={setRootElement}
        onMouseEnter={handleRootMouseEnter}
        onMouseLeave={handleRootMouseLeave}
        onFocus={handleRootFocus}
        onBlur={handleRootBlur}
      >
        {triggerNode}
        {overlayNode}
      </label>
    )
  }

  if (Component === 'div') {
    return (
      <div
        {...domProps}
        className={className}
        style={style}
        ref={setRootElement}
        onMouseEnter={handleRootMouseEnter}
        onMouseLeave={handleRootMouseLeave}
        onFocus={handleRootFocus}
        onBlur={handleRootBlur}
      >
        {triggerNode}
        {overlayNode}
      </div>
    )
  }

  return h(
    Component,
    {
      ...domProps,
      className,
      style,
      ref: setRootElement,
      onMouseEnter: handleRootMouseEnter,
      onMouseLeave: handleRootMouseLeave,
      onFocus: handleRootFocus,
      onBlur: handleRootBlur,
    },
    triggerNode,
    overlayNode,
  )
}

const Root: FC<PopoverProps> = ({
  as = 'div',
  title,
  content,
  overlay,
  placement = 'top',
  trigger,
  open,
  defaultOpen,
  disabled,
  arrow = true,
  destroyOnHidden = false,
  mouseEnterDelay = 0.08,
  mouseLeaveDelay = 0.12,
  zIndex,
  className,
  style,
  triggerClassName,
  triggerStyle,
  overlayClassName,
  overlayStyle,
  classNames,
  styles,
  onOpenChange,
  children,
  ...rest
}) => {
  const Component = as as any
  const uncontrolledOpen = ref(defaultOpen ?? false)
  const currentOpen = ref(open ?? defaultOpen ?? false)
  const currentTriggers = ref(normalizeTrigger(trigger))
  const isControlled = open !== undefined
  let rootElement: HTMLElement | null = null
  let triggerElement: HTMLElement | null = null
  let overlayElement: HTMLElement | null = null
  let openTimer: ReturnType<typeof setTimeout> | null = null
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  const syncPopoverDom = (nextOpen: boolean) => {
    if (triggerElement) {
      triggerElement.setAttribute('aria-expanded', String(nextOpen))
    }
    if (!overlayElement) return
    overlayElement.setAttribute('aria-hidden', nextOpen ? 'false' : 'true')
    overlayElement.classList.toggle('pointer-events-auto', nextOpen)
    overlayElement.classList.toggle('visible', nextOpen)
    overlayElement.classList.toggle('opacity-100', nextOpen)
    overlayElement.classList.toggle('scale-100', nextOpen)
    overlayElement.classList.toggle('pointer-events-none', !nextOpen)
    overlayElement.classList.toggle('invisible', !nextOpen)
    overlayElement.classList.toggle('opacity-0', !nextOpen)
    overlayElement.classList.toggle('scale-95', !nextOpen)
  }

  watch(
    () => open,
    nextOpen => {
      currentOpen.value = typeof nextOpen === 'boolean' ? nextOpen : uncontrolledOpen.value
      syncPopoverDom(currentOpen.value)
    },
    { immediate: true },
  )

  watch(
    () => trigger,
    (nextTrigger: PopoverTrigger | PopoverTrigger[] | undefined) => {
      currentTriggers.value = normalizeTrigger(nextTrigger)
    },
    { immediate: true },
  )

  watch(
    () => defaultOpen,
    nextDefaultOpen => {
      if (!isControlled) {
        uncontrolledOpen.value = !!nextDefaultOpen
        currentOpen.value = !!nextDefaultOpen
        syncPopoverDom(currentOpen.value)
      }
    },
    { immediate: true },
  )

  const clearTimers = () => {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  const getCurrentOpen = () => currentOpen.value

  const updateOpen = (nextOpen: boolean) => {
    if (disabled || !hasOverlay) return
    if (nextOpen === getCurrentOpen()) return
    if (!isControlled) {
      uncontrolledOpen.value = nextOpen
    }
    currentOpen.value = nextOpen
    syncPopoverDom(nextOpen)
    if (typeof onOpenChange === 'function') {
      onOpenChange(nextOpen)
    }
  }

  const scheduleOpen = () => {
    if (!allowHover) return
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    if (mouseEnterDelay <= 0) {
      updateOpen(true)
      return
    }
    if (openTimer) clearTimeout(openTimer)
    openTimer = setTimeout(() => {
      openTimer = null
      updateOpen(true)
    }, mouseEnterDelay * 1000)
  }

  const scheduleClose = () => {
    if (!allowHover) return
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
    if (mouseLeaveDelay <= 0) {
      updateOpen(false)
      return
    }
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = setTimeout(() => {
      closeTimer = null
      updateOpen(false)
    }, mouseLeaveDelay * 1000)
  }

  const handleWindowClick = (event: MouseEvent) => {
    if (!getCurrentOpen()) return
    if (!(allowClick || allowContextMenu)) return
    if (rootElement?.contains(event.target as Node)) return
    updateOpen(false)
  }

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (!getCurrentOpen() || event.key !== 'Escape') return
    updateOpen(false)
  }

  const handleNativeFocusIn = (_event: FocusEvent) => {
    if (!allowFocus) return
    updateOpen(true)
  }

  const handleNativeFocusOut = (event: FocusEvent) => {
    if (!allowFocus) return
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && rootElement?.contains(nextTarget)) return
    updateOpen(false)
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('click', handleWindowClick, true)
    window.addEventListener('keydown', handleWindowKeyDown)
    rootElement?.addEventListener('focusin', handleNativeFocusIn)
    rootElement?.addEventListener('focusout', handleNativeFocusOut)
    syncPopoverDom(currentOpen.value)
  })

  onUnmounted(() => {
    clearTimers()
    rootElement?.removeEventListener('focusin', handleNativeFocusIn)
    rootElement?.removeEventListener('focusout', handleNativeFocusOut)
    if (typeof window === 'undefined') return
    window.removeEventListener('click', handleWindowClick, true)
    window.removeEventListener('keydown', handleWindowKeyDown)
  })

  const resolvedTitle = resolveRenderable(title)
  const resolvedContent = resolveRenderable(content)
  const resolvedOverlay = overlay !== undefined ? resolveRenderable(overlay) : undefined
  const hasStructuredOverlay = isRenderable(resolvedTitle) || isRenderable(resolvedContent)
  const hasOverlay = isRenderable(resolvedOverlay) || hasStructuredOverlay
  const allowHover = currentTriggers.value.includes('hover')
  const allowFocus = currentTriggers.value.includes('focus')
  const allowClick = currentTriggers.value.includes('click')
  const allowContextMenu = currentTriggers.value.includes('contextMenu')
  const showOverlay = hasOverlay && (currentOpen.value || !destroyOnHidden)
  const pointAtCenter = typeof arrow === 'object' && !!arrow.pointAtCenter
  const showArrow = arrow !== false
  const { onMouseEnter, onMouseLeave, onFocus, onBlur, onClick, onContextMenu, ...domProps } = rest

  const rootClassName = mergeClassNames(
    'relative inline-flex max-w-full align-top',
    classNames?.root,
    className,
  )
  const triggerClass = mergeClassNames(
    'inline-flex max-w-full items-stretch',
    classNames?.trigger,
    triggerClassName,
  )
  const overlayClasses = mergeClassNames(
    'absolute z-50 w-max max-w-[min(24rem,calc(100vw-2rem))] transform-gpu transition duration-150 ease-out',
    getOverlayPlacementClass(placement),
    getTransformOriginClass(placement),
    currentOpen.value
      ? 'pointer-events-auto visible opacity-100 scale-100'
      : 'pointer-events-none invisible opacity-0 scale-95',
    classNames?.overlay,
    overlayClassName,
  )
  const panelClassName = mergeClassNames(
    'relative min-w-64 overflow-hidden rounded-[1.15rem] border border-base-300/80 bg-base-100/95 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.55)] backdrop-blur',
    classNames?.panel,
  )
  const arrowClassName = mergeClassNames(
    'absolute block h-3 w-3 rotate-45 border-base-300/80 bg-base-100/95',
    resolveArrowClassName(placement, pointAtCenter),
    classNames?.arrow,
  )
  const headerClassName = mergeClassNames(
    'border-b border-base-300/70 px-4 py-3',
    classNames?.header,
  )
  const titleClassName = mergeClassNames(
    'text-sm font-semibold tracking-[0.01em] text-base-content',
    classNames?.title,
  )
  const contentClassName = mergeClassNames(
    'px-4 py-3 text-sm leading-6 text-base-content/80',
    classNames?.content,
  )

  const rootStyle = mergeStyleValue(style, styles?.root)
  const triggerStyleValue = mergeStyleValue(triggerStyle, styles?.trigger)
  const mergedOverlayStyle = mergeStyles(styles?.overlay, overlayStyle)
  if (typeof zIndex === 'number') {
    mergedOverlayStyle.zIndex = zIndex
  }
  const overlayStyleValue = serializeStyle(mergedOverlayStyle) || undefined
  const panelStyleValue = serializeStyle(styles?.panel) || undefined
  const arrowStyleValue = serializeStyle(styles?.arrow) || undefined
  const headerStyleValue = serializeStyle(styles?.header) || undefined
  const titleStyleValue = serializeStyle(styles?.title) || undefined
  const contentStyleValue = serializeStyle(styles?.content) || undefined

  const overlayNode = !showOverlay ? null : isRenderable(resolvedOverlay) ? (
    resolvedOverlay
  ) : (
    <div className={panelClassName} style={panelStyleValue} role="dialog" aria-modal="false">
      {isRenderable(resolvedTitle) ? (
        <div className={headerClassName} style={headerStyleValue}>
          <div className={titleClassName} style={titleStyleValue}>
            {resolvedTitle}
          </div>
        </div>
      ) : null}
      {isRenderable(resolvedContent) ? (
        <div className={contentClassName} style={contentStyleValue}>
          {resolvedContent}
        </div>
      ) : null}
    </div>
  )

  const setRootElement = (element: HTMLElement | null) => {
    rootElement = element
  }

  const handleRootMouseEnter = (event: any) => {
    callHandler(onMouseEnter, event)
    if (!event?.defaultPrevented) scheduleOpen()
  }

  const handleRootMouseLeave = (event: any) => {
    callHandler(onMouseLeave, event)
    if (!event?.defaultPrevented) scheduleClose()
  }

  const handleRootFocus = (event: any) => {
    callHandler(onFocus, event)
  }

  const handleRootBlur = (event: any) => {
    callHandler(onBlur, event)
  }

  const triggerNode = (
    <div
      className={triggerClass}
      style={triggerStyleValue}
      ref={(element: HTMLElement | null) => {
        triggerElement = element
      }}
      aria-haspopup={hasOverlay ? 'dialog' : undefined}
      aria-expanded={hasOverlay ? String(currentOpen.value) : undefined}
      onClick={(event: any) => {
        callHandler(onClick, event)
        if (!event?.defaultPrevented && allowClick) {
          clearTimers()
          updateOpen(!getCurrentOpen())
        }
      }}
      onContextMenu={(event: any) => {
        callHandler(onContextMenu, event)
        if (!event?.defaultPrevented && allowContextMenu) {
          if (typeof event.preventDefault === 'function') event.preventDefault()
          clearTimers()
          updateOpen(!getCurrentOpen())
        }
      }}
    >
      {children}
    </div>
  )

  const overlayRoot = showOverlay ? (
    <div
      className={overlayClasses}
      style={overlayStyleValue}
      ref={(element: HTMLElement | null) => {
        overlayElement = element
      }}
      aria-hidden={currentOpen.value ? 'false' : 'true'}
    >
      {showArrow ? <span className={arrowClassName} style={arrowStyleValue} /> : null}
      {overlayNode}
    </div>
  ) : null

  return renderRoot(
    Component,
    domProps,
    rootClassName,
    rootStyle,
    setRootElement,
    handleRootMouseEnter,
    handleRootMouseLeave,
    handleRootFocus,
    handleRootBlur,
    triggerNode,
    overlayRoot,
  )
}

export default Root
