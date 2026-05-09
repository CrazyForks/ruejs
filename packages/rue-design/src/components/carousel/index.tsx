/* RUE_VAPOR_TRANSFORMED */
/*
Carousel 组件概述
- 视图模型：以索引为单一真相源，统一承载受控、非受控、自动播放、箭头与 dots。
- 布局策略：scrollx 模式保留 daisyUI carousel/item 的宽度与对齐语义，fade 模式切到叠层过渡。
- 兼容目标：继续支持旧版 align/direction/auto/interval/loop/activeIndex/items 写法，同时补齐常用能力。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, ref, useRef, watch } from '@rue-js/rue'

export type CarouselAlign = 'start' | 'center' | 'end'
export type CarouselDirection = 'horizontal' | 'vertical'
export type CarouselEffect = 'scrollx' | 'fade'
export type CarouselDotPlacement = 'top' | 'bottom' | 'start' | 'end'
export type CarouselAutoDirection = 'forward' | 'backward'

export interface CarouselDataItem {
  key?: string | number
  content: any
  className?: string
}

export interface CarouselDotsConfig {
  className?: string
}

export interface CarouselAutoplayConfig {
  dotDuration?: boolean
}

export interface CarouselArrowRenderProps {
  disabled: boolean
  onClick: () => void
  direction: 'prev' | 'next'
}

export interface CarouselRef {
  nativeElement?: HTMLDivElement
  goTo: (slide: number, dontAnimate?: boolean) => void
  next: () => void
  prev: () => void
  autoPlay: (playType?: 'update' | 'leave' | 'blur') => void
  stop: () => void
}

export interface CarouselProps {
  align?: CarouselAlign
  direction?: CarouselDirection
  effect?: CarouselEffect
  fade?: boolean
  auto?: boolean
  autoplay?: boolean | CarouselAutoplayConfig
  interval?: number
  autoplaySpeed?: number
  loop?: boolean
  infinite?: boolean
  autoDirection?: CarouselAutoDirection
  activeIndex?: number
  defaultActiveIndex?: number
  initialSlide?: number
  slickGoTo?: number
  dots?: boolean | CarouselDotsConfig
  arrows?: boolean
  prevArrow?: any | ((props: CarouselArrowRenderProps) => any)
  nextArrow?: any | ((props: CarouselArrowRenderProps) => any)
  dotPlacement?: CarouselDotPlacement
  dotPosition?: CarouselDotPlacement | 'left' | 'right'
  draggable?: boolean
  waitForAnimate?: boolean
  speed?: number
  easing?: string
  pauseOnHover?: boolean
  adaptiveHeight?: boolean
  onIndexChange?: (index: number) => void
  beforeChange?: (current: number, next: number) => void
  afterChange?: (current: number) => void
  apiRef?: any
  className?: string
  style?: string | Record<string, string | number | null | undefined>
  children?: any
  items?: ReadonlyArray<CarouselDataItem>
  [key: string]: any
}

interface CarouselItemProps {
  className?: string
  children?: any
  [key: string]: any
}

type InlineStyle = string | Record<string, string | number | null | undefined>

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const serializeStyle = (style?: InlineStyle) => {
  if (!style) return undefined
  if (typeof style === 'string') {
    const trimmed = style.trim()
    return trimmed || undefined
  }

  const serialized = Object.entries(style)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key.startsWith('--') ? key : toKebabCase(key)}:${String(value)}`)
    .join('; ')

  return serialized || undefined
}

const mergeClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

const flattenChildren = (value: any): any[] => {
  if (value == null || value === false) return []
  if (Array.isArray(value)) {
    return value.flatMap(item => flattenChildren(item))
  }
  return [value]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const normalizeIndex = (value: number, count: number, loop: boolean) => {
  if (count <= 0) return 0
  if (loop) {
    const modulo = value % count
    return modulo >= 0 ? modulo : modulo + count
  }
  return clamp(value, 0, count - 1)
}

const resolveDotPlacement = (
  placement: CarouselDotPlacement | 'left' | 'right' | undefined,
): CarouselDotPlacement => {
  switch (placement) {
    case 'left':
      return 'start'
    case 'right':
      return 'end'
    default:
      return placement ?? 'bottom'
  }
}

const assignForwardedRef = (forwardedRef: any, value: CarouselRef | null) => {
  if (typeof forwardedRef === 'function') {
    forwardedRef(value)
    return
  }
  if (forwardedRef && typeof forwardedRef === 'object') {
    ;(forwardedRef as any).current = value ?? undefined
  }
}

const resolveArrowNode = (
  arrow: any | ((props: CarouselArrowRenderProps) => any) | undefined,
  props: CarouselArrowRenderProps,
  fallback: string,
) => {
  if (typeof arrow === 'function') return arrow(props)
  if (arrow != null) return arrow
  return fallback
}

const getOffsetByAlign = (
  align: CarouselAlign,
  viewportSize: number,
  slideStart: number,
  slideSize: number,
  trackSize: number,
) => {
  let target = slideStart
  if (align === 'center') {
    target = slideStart - (viewportSize - slideSize) / 2
  } else if (align === 'end') {
    target = slideStart - (viewportSize - slideSize)
  }
  const maxOffset = Math.max(trackSize - viewportSize, 0)
  return clamp(target, 0, maxOffset)
}

const clearTransitionStyle = (element: HTMLElement) => {
  element.style.transitionProperty = ''
  element.style.transitionDuration = ''
  element.style.transitionTimingFunction = ''
}

const resetScrollSlideStyle = (slide: HTMLElement) => {
  slide.style.position = ''
  slide.style.inset = ''
  slide.style.opacity = ''
  slide.style.pointerEvents = ''
  slide.style.zIndex = ''
  slide.style.transitionProperty = ''
  slide.style.transitionDuration = ''
  slide.style.transitionTimingFunction = ''
  slide.style.transform = ''
}

/**
 * 走马灯组件：
 * - scrollx 模式保留多宽度、多对齐布局能力
 * - fade 模式补齐常见的叠层切换体验
 * - 支持 ref 暴露 goTo/next/prev/autoPlay 方法
 */
const Carousel: FC<CarouselProps> = ({
  align = 'start',
  direction = 'horizontal',
  effect = 'scrollx',
  fade = false,
  auto = false,
  autoplay = false,
  interval = 3000,
  autoplaySpeed,
  loop = true,
  infinite,
  autoDirection = 'forward',
  activeIndex,
  defaultActiveIndex,
  initialSlide,
  slickGoTo,
  dots = false,
  arrows = false,
  prevArrow,
  nextArrow,
  dotPlacement,
  dotPosition,
  draggable = false,
  waitForAnimate = false,
  speed = 500,
  easing = 'ease',
  pauseOnHover,
  adaptiveHeight = false,
  onIndexChange,
  beforeChange,
  afterChange,
  apiRef,
  className,
  style,
  children,
  items,
  ...rest
}) => {
  const forwardedRef = rest.ref
  const userOnMouseEnter = rest.onMouseEnter
  const userOnMouseLeave = rest.onMouseLeave
  const userOnPointerDown = rest.onPointerDown
  const userOnPointerUp = rest.onPointerUp
  const userOnPointerCancel = rest.onPointerCancel
  const userOnPointerLeave = rest.onPointerLeave
  if ('ref' in rest) delete rest.ref
  if ('onMouseEnter' in rest) delete rest.onMouseEnter
  if ('onMouseLeave' in rest) delete rest.onMouseLeave
  if ('onPointerDown' in rest) delete rest.onPointerDown
  if ('onPointerUp' in rest) delete rest.onPointerUp
  if ('onPointerCancel' in rest) delete rest.onPointerCancel
  if ('onPointerLeave' in rest) delete rest.onPointerLeave

  const mergedEffect: CarouselEffect = fade ? 'fade' : effect
  const mergedLoop = infinite ?? loop
  const mergedAutoplay = typeof autoplay === 'object' ? true : autoplay || auto
  const mergedAutoplaySpeed = autoplaySpeed ?? interval
  const mergedPauseOnHover = pauseOnHover ?? mergedAutoplay
  const mergedDotPlacement = resolveDotPlacement(dotPlacement ?? dotPosition)
  const mergedShowDotDuration =
    mergedAutoplay && typeof autoplay === 'object' && !!autoplay.dotDuration
  const serializedStyle = serializeStyle(style)
  const normalizedChildList = flattenChildren(children)
  const normalizedItems = items ?? []
  const slideCountHint =
    normalizedItems.length > 0 ? normalizedItems.length : normalizedChildList.length
  const mergedControlledIndex = slickGoTo ?? activeIndex
  const initialIndex = normalizeIndex(
    typeof mergedControlledIndex === 'number'
      ? mergedControlledIndex
      : (defaultActiveIndex ?? initialSlide ?? 0),
    slideCountHint || 1,
    mergedLoop,
  )

  const rootRef = useRef<HTMLDivElement>()
  const trackRef = useRef<HTMLDivElement>()
  const autoplayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resizeHandlerRef = useRef<(() => void) | null>(null)
  const loadHandlerRef = useRef<((event: Event) => void) | null>(null)
  const pendingControlledIndexRef = useRef<number | null>(null)
  const animationLockedRef = useRef(false)
  const dragStartRef = useRef<number | null>(null)
  const progressToken = ref(0)
  const hovered = ref(false)
  const currentIndexState = ref(initialIndex)

  const getRenderedSlides = () => {
    const track = trackRef.current
    if (!track) return [] as HTMLElement[]
    return Array.from(track.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    )
  }

  const getResolvedCount = () => {
    const renderedCount = getRenderedSlides().length
    return renderedCount || slideCountHint
  }

  const clearTransitionTimer = () => {
    if (transitionTimerRef.current != null) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
    animationLockedRef.current = false
  }

  const restartDotProgress = () => {
    if (!mergedShowDotDuration) return
    const root = rootRef.current
    if (!root) return
    const progress = root.querySelector<HTMLElement>('[data-rue-carousel-dot-progress="active"]')
    if (!progress) return
    progress.style.transition = 'none'
    progress.style.transform = 'scaleX(0)'
    requestAnimationFrame(() => {
      progress.style.transition = `transform ${mergedAutoplaySpeed}ms linear`
      progress.style.transform = 'scaleX(1)'
    })
  }

  const scheduleAfterChange = (next: number, dontAnimate: boolean) => {
    clearTransitionTimer()
    if (!dontAnimate && speed > 0) {
      animationLockedRef.current = true
    }

    transitionTimerRef.current = setTimeout(
      () => {
        animationLockedRef.current = false
        if (afterChange) afterChange(next)
      },
      dontAnimate || speed <= 0 ? 0 : speed,
    )
  }

  const stopAutoplay = () => {
    if (autoplayTimerRef.current != null) {
      clearInterval(autoplayTimerRef.current)
      autoplayTimerRef.current = null
    }
  }

  const startAutoplay = () => {
    stopAutoplay()
    if (!mergedAutoplay || getResolvedCount() <= 1) return
    if (mergedPauseOnHover && hovered.value) return

    autoplayTimerRef.current = setInterval(() => {
      const delta = autoDirection === 'backward' ? -1 : 1
      commitIndex(currentIndexState.value + delta, {
        source: 'autoplay',
      })
    }, mergedAutoplaySpeed)
  }

  const api: CarouselRef = {
    nativeElement: undefined,
    goTo: (slide, dontAnimate = false) => {
      commitIndex(slide, { source: 'api', dontAnimate })
    },
    next: () => {
      commitIndex(currentIndexState.value + 1, { source: 'api' })
    },
    prev: () => {
      commitIndex(currentIndexState.value - 1, { source: 'api' })
    },
    autoPlay: playType => {
      if (playType === 'leave' || playType === 'blur') {
        stopAutoplay()
        return
      }
      startAutoplay()
    },
    stop: () => {
      stopAutoplay()
    },
  }

  const syncRef = () => {
    api.nativeElement = rootRef.current
    assignForwardedRef(forwardedRef, rootRef.current ? api : null)
    assignForwardedRef(apiRef, rootRef.current ? api : null)
  }

  const syncControls = () => {
    const root = rootRef.current
    if (!root) return

    const resolvedIndex = normalizeIndex(
      currentIndexState.value,
      Math.max(visualCount, 1),
      mergedLoop,
    )
    root.setAttribute('data-rue-carousel-current', String(resolvedIndex))

    const prevButton = root.querySelector<HTMLButtonElement>('[data-rue-carousel-prev="true"]')
    const nextButton = root.querySelector<HTMLButtonElement>('[data-rue-carousel-next="true"]')
    if (prevButton) {
      prevButton.disabled = !mergedLoop && resolvedIndex <= 0
    }
    if (nextButton) {
      nextButton.disabled = !mergedLoop && resolvedIndex >= Math.max(0, visualCount - 1)
    }

    const dotButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-rue-carousel-dot]'),
    )
    dotButtons.forEach((button, index) => {
      const active = index === resolvedIndex
      if (active) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
      button.classList.toggle('w-9', active)
      button.classList.toggle('bg-primary/30', active)
      button.classList.toggle('w-2.5', !active)
      const fill = button.querySelector<HTMLElement>('[data-rue-carousel-dot-fill]')
      if (fill) {
        fill.classList.toggle('scale-100', active)
        fill.classList.toggle('scale-0', !active)
      }
    })
  }

  const syncScrollLayout = (dontAnimate: boolean) => {
    const root = rootRef.current
    const track = trackRef.current
    if (!root || !track) return
    const slides = getRenderedSlides()

    root.style.position = 'relative'
    root.style.overflow = 'hidden'
    root.style.transition = adaptiveHeight ? `height ${speed}ms ${easing}` : ''

    track.style.display = 'flex'
    track.style.flexDirection = direction === 'vertical' ? 'column' : 'row'
    track.style.width = direction === 'vertical' ? '100%' : ''
    track.style.height = direction === 'vertical' ? '100%' : ''
    track.style.position = ''
    track.style.minHeight = ''
    track.style.transitionProperty = 'transform'
    track.style.transitionDuration = dontAnimate ? '0ms' : `${speed}ms`
    track.style.transitionTimingFunction = easing

    slides.forEach(resetScrollSlideStyle)

    if (!slides.length) {
      track.style.transform = ''
      return
    }

    const safeIndex = normalizeIndex(currentIndexState.value, slides.length, mergedLoop)
    if (safeIndex !== currentIndexState.value) {
      currentIndexState.value = safeIndex
      return
    }

    const targetSlide = slides[safeIndex]
    const viewportSize = direction === 'vertical' ? root.clientHeight : root.clientWidth
    const slideStart = direction === 'vertical' ? targetSlide.offsetTop : targetSlide.offsetLeft
    const slideSize = direction === 'vertical' ? targetSlide.offsetHeight : targetSlide.offsetWidth
    const trackSize = direction === 'vertical' ? track.scrollHeight : track.scrollWidth
    const offset = getOffsetByAlign(align, viewportSize, slideStart, slideSize, trackSize)

    track.style.transform =
      direction === 'vertical'
        ? `translate3d(0, -${offset}px, 0)`
        : `translate3d(-${offset}px, 0, 0)`

    if (adaptiveHeight && direction === 'horizontal') {
      root.style.height = `${targetSlide.offsetHeight}px`
    } else if (!adaptiveHeight) {
      root.style.height = ''
    }
  }

  const syncFadeLayout = (dontAnimate: boolean) => {
    const root = rootRef.current
    const track = trackRef.current
    if (!root || !track) return
    const slides = getRenderedSlides()

    root.style.position = 'relative'
    root.style.overflow = 'hidden'
    root.style.transition = `height ${speed}ms ${easing}`

    track.style.display = 'block'
    track.style.width = '100%'
    track.style.height = '100%'
    track.style.position = 'relative'
    track.style.transform = ''
    clearTransitionStyle(track)

    if (!slides.length) return

    const safeIndex = normalizeIndex(currentIndexState.value, slides.length, mergedLoop)
    if (safeIndex !== currentIndexState.value) {
      currentIndexState.value = safeIndex
      return
    }

    const currentSlide = slides[safeIndex]
    const tallest = slides.reduce((max, slide) => Math.max(max, slide.offsetHeight), 0)
    const nextHeight = adaptiveHeight ? currentSlide.offsetHeight : tallest
    if (nextHeight > 0) {
      root.style.height = `${nextHeight}px`
      track.style.minHeight = `${nextHeight}px`
    }

    slides.forEach((slide, index) => {
      slide.style.position = 'absolute'
      slide.style.inset = '0'
      slide.style.width = '100%'
      slide.style.height = '100%'
      slide.style.opacity = index === safeIndex ? '1' : '0'
      slide.style.pointerEvents = index === safeIndex ? 'auto' : 'none'
      slide.style.zIndex = index === safeIndex ? '1' : '0'
      slide.style.transitionProperty = 'opacity'
      slide.style.transitionDuration = dontAnimate ? '0ms' : `${speed}ms`
      slide.style.transitionTimingFunction = easing
      slide.style.transform = 'translate3d(0, 0, 0)'
    })
  }

  const syncLayout = (dontAnimate = false) => {
    syncRef()
    if (mergedEffect === 'fade') {
      syncFadeLayout(dontAnimate)
    } else {
      syncScrollLayout(dontAnimate)
    }
    syncControls()
    requestAnimationFrame(() => {
      restartDotProgress()
    })
  }

  const commitIndex = (
    targetIndex: number,
    options: {
      source?: 'user' | 'api' | 'prop' | 'autoplay'
      dontAnimate?: boolean
    } = {},
  ) => {
    const count = getResolvedCount()
    if (count <= 0) return

    const nextIndex = normalizeIndex(targetIndex, count, mergedLoop)
    const currentIndex = normalizeIndex(currentIndexState.value, count, mergedLoop)
    if (waitForAnimate && animationLockedRef.current && !options.dontAnimate) {
      return
    }

    if (nextIndex === currentIndex) {
      syncLayout(!!options.dontAnimate)
      return
    }

    if (beforeChange) {
      beforeChange(currentIndex, nextIndex)
    }

    currentIndexState.value = nextIndex
    if (options.source !== 'prop') {
      pendingControlledIndexRef.current = nextIndex
    }
    if (onIndexChange) {
      onIndexChange(nextIndex)
    }

    progressToken.value += 1
    syncLayout(!!options.dontAnimate)
    scheduleAfterChange(nextIndex, !!options.dontAnimate)
    startAutoplay()
  }

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return !!target.closest('button, a, input, select, textarea, label')
  }

  const handlePointerEnd = (event: Event) => {
    if (!draggable || dragStartRef.current == null) return
    const point = event instanceof PointerEvent ? event : null
    const end = point
      ? direction === 'vertical'
        ? point.clientY
        : point.clientX
      : dragStartRef.current
    const delta = end - dragStartRef.current
    dragStartRef.current = null

    if (Math.abs(delta) < 40) return
    if (delta < 0) {
      commitIndex(currentIndexState.value + 1, { source: 'user' })
      return
    }
    commitIndex(currentIndexState.value - 1, { source: 'user' })
  }

  const visualCount =
    normalizedItems.length > 0 ? normalizedItems.length : normalizedChildList.length
  const canShowControls = visualCount > 1

  let rootClassName = 'carousel relative overflow-hidden'
  if (align === 'center') rootClassName += ' carousel-center'
  if (align === 'end') rootClassName += ' carousel-end'
  if (direction === 'vertical') rootClassName += ' carousel-vertical'
  else rootClassName += ' carousel-horizontal'
  if (className) rootClassName += ` ${className}`

  const dotsClassName = (() => {
    const base = 'pointer-events-auto z-20 gap-2'
    if (mergedDotPlacement === 'top') {
      return `${base} absolute left-1/2 top-4 flex -translate-x-1/2`
    }
    if (mergedDotPlacement === 'bottom') {
      return `${base} absolute bottom-4 left-1/2 flex -translate-x-1/2`
    }
    if (direction === 'vertical') {
      return mergedDotPlacement === 'start'
        ? `${base} absolute left-1/2 top-4 flex -translate-x-1/2`
        : `${base} absolute bottom-4 left-1/2 flex -translate-x-1/2`
    }
    return mergedDotPlacement === 'start'
      ? `${base} absolute left-4 top-1/2 flex -translate-y-1/2 flex-col`
      : `${base} absolute right-4 top-1/2 flex -translate-y-1/2 flex-col`
  })()

  const renderScrollSlides = () => {
    if (normalizedItems.length > 0) {
      return normalizedItems.map((item, index) => (
        <div
          key={item.key ?? index}
          className={`carousel-item${item.className ? ` ${item.className}` : ''}`}
          data-rue-carousel-slide={String(index)}
        >
          {item.content}
        </div>
      ))
    }
    return children
  }

  const renderFadeSlides = () => {
    if (normalizedItems.length > 0) {
      return normalizedItems.map((item, index) => (
        <div
          key={item.key ?? index}
          className={`carousel-item${item.className ? ` ${item.className}` : ''}`}
          data-rue-carousel-slide={String(index)}
        >
          {item.content}
        </div>
      ))
    }

    return normalizedChildList.map((child, index) => (
      <div key={index} className="w-full h-full" data-rue-carousel-slide={String(index)}>
        {child}
      </div>
    ))
  }

  onMounted(() => {
    syncRef()
    syncLayout(true)
    startAutoplay()

    resizeHandlerRef.current = () => {
      syncLayout(true)
    }
    loadHandlerRef.current = () => {
      syncLayout(true)
    }

    if (typeof window !== 'undefined' && resizeHandlerRef.current) {
      window.addEventListener('resize', resizeHandlerRef.current)
    }
    if (rootRef.current && loadHandlerRef.current) {
      rootRef.current.addEventListener('load', loadHandlerRef.current, true)
    }
  })

  onUnmounted(() => {
    stopAutoplay()
    clearTransitionTimer()
    if (typeof window !== 'undefined' && resizeHandlerRef.current) {
      window.removeEventListener('resize', resizeHandlerRef.current)
    }
    if (rootRef.current && loadHandlerRef.current) {
      rootRef.current.removeEventListener('load', loadHandlerRef.current, true)
    }
    assignForwardedRef(forwardedRef, null)
    assignForwardedRef(apiRef, null)
  })

  watch(
    () => slickGoTo ?? activeIndex,
    next => {
      if (typeof next !== 'number') return
      const count = getResolvedCount() || 1
      const normalized = normalizeIndex(next, count, mergedLoop)
      if (pendingControlledIndexRef.current === normalized) {
        pendingControlledIndexRef.current = null
        currentIndexState.value = normalized
        syncLayout(false)
        return
      }
      commitIndex(normalized, { source: 'prop' })
    },
    { immediate: false },
  )

  watch(
    () => slideCountHint,
    (nextCount: number | undefined) => {
      if (!nextCount) return
      currentIndexState.value = normalizeIndex(currentIndexState.value, nextCount, mergedLoop)
      syncLayout(true)
      startAutoplay()
    },
    { immediate: false },
  )

  return (
    <div
      {...rest}
      ref={(element: HTMLDivElement | null) => {
        rootRef.current = element ?? undefined
        syncRef()
      }}
      className={rootClassName}
      style={serializedStyle}
      data-rue-carousel-current={String(currentIndexState.value)}
      role={rest.role ?? 'region'}
      aria-roledescription={rest['aria-roledescription'] ?? 'carousel'}
      onMouseEnter={(event: MouseEvent) => {
        hovered.value = true
        if (mergedPauseOnHover) stopAutoplay()
        if (typeof userOnMouseEnter === 'function') userOnMouseEnter(event)
      }}
      onMouseLeave={(event: MouseEvent) => {
        hovered.value = false
        if (mergedPauseOnHover) startAutoplay()
        if (typeof userOnMouseLeave === 'function') userOnMouseLeave(event)
      }}
      onPointerDown={(event: PointerEvent) => {
        if (typeof userOnPointerDown === 'function') userOnPointerDown(event)
        if (!draggable || isInteractiveTarget(event.target)) return
        dragStartRef.current = direction === 'vertical' ? event.clientY : event.clientX
      }}
      onPointerUp={(event: PointerEvent) => {
        if (typeof userOnPointerUp === 'function') userOnPointerUp(event)
        handlePointerEnd(event)
      }}
      onPointerCancel={(event: PointerEvent) => {
        if (typeof userOnPointerCancel === 'function') userOnPointerCancel(event)
        dragStartRef.current = null
      }}
      onPointerLeave={(event: PointerEvent) => {
        if (typeof userOnPointerLeave === 'function') userOnPointerLeave(event)
        if (!draggable) return
        handlePointerEnd(event)
      }}
    >
      <div
        ref={(element: HTMLDivElement | null) => {
          trackRef.current = element ?? undefined
        }}
        className={mergeClassName(
          mergedEffect === 'fade' ? 'relative w-full h-full' : 'will-change-transform',
          mergedEffect === 'scrollx' && direction === 'vertical'
            ? 'flex flex-col'
            : mergedEffect === 'scrollx'
              ? 'flex'
              : undefined,
        )}
        data-rue-carousel-track="true"
      >
        {mergedEffect === 'fade' ? renderFadeSlides() : renderScrollSlides()}
      </div>

      {arrows && canShowControls ? (
        <>
          <button
            type="button"
            data-rue-carousel-prev="true"
            className="btn btn-circle btn-sm sm:btn-md absolute left-3 top-1/2 z-20 -translate-y-1/2 bg-base-100/80 backdrop-blur disabled:opacity-40"
            disabled={!mergedLoop && currentIndexState.value <= 0}
            aria-label="Previous slide"
            onClick={() => {
              commitIndex(currentIndexState.value - 1, { source: 'user' })
            }}
          >
            {resolveArrowNode(
              prevArrow,
              {
                disabled: !mergedLoop && currentIndexState.value <= 0,
                onClick: () => commitIndex(currentIndexState.value - 1, { source: 'user' }),
                direction: 'prev',
              },
              '‹',
            )}
          </button>
          <button
            type="button"
            data-rue-carousel-next="true"
            className="btn btn-circle btn-sm sm:btn-md absolute right-3 top-1/2 z-20 -translate-y-1/2 bg-base-100/80 backdrop-blur disabled:opacity-40"
            disabled={!mergedLoop && currentIndexState.value >= Math.max(0, visualCount - 1)}
            aria-label="Next slide"
            onClick={() => {
              commitIndex(currentIndexState.value + 1, { source: 'user' })
            }}
          >
            {resolveArrowNode(
              nextArrow,
              {
                disabled: !mergedLoop && currentIndexState.value >= Math.max(0, visualCount - 1),
                onClick: () => commitIndex(currentIndexState.value + 1, { source: 'user' }),
                direction: 'next',
              },
              '›',
            )}
          </button>
        </>
      ) : null}

      {dots && canShowControls ? (
        <div
          className={mergeClassName(
            dotsClassName,
            typeof dots === 'boolean' ? undefined : dots.className,
          )}
        >
          {Array.from({ length: visualCount }).map((_, index) => {
            const active =
              index === normalizeIndex(currentIndexState.value, visualCount || 1, mergedLoop)
            return (
              <button
                key={index}
                type="button"
                data-rue-carousel-dot={String(index)}
                className={mergeClassName(
                  'relative h-2.5 overflow-hidden rounded-full bg-base-100/60 transition-all duration-300',
                  active ? 'w-9 bg-primary/30' : 'w-2.5 hover:bg-base-100/80',
                )}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  commitIndex(index, { source: 'user' })
                }}
              >
                <span
                  data-rue-carousel-dot-fill="true"
                  className={mergeClassName(
                    'absolute inset-0 rounded-full bg-primary transition-transform duration-300',
                    active ? 'scale-100' : 'scale-0',
                  )}
                />
                {mergedShowDotDuration && active ? (
                  <span
                    key={`${index}-${progressToken.value}`}
                    data-rue-carousel-dot-progress="active"
                    className="absolute inset-0 origin-left rounded-full bg-primary/35"
                    style={{ transform: 'scaleX(0)' }}
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/** 子项组件：在 scrollx 模式下延续 daisyUI carousel-item 语义。 */
const Item: FC<CarouselItemProps> = ({ className, children, ...rest }) => {
  return (
    <div {...rest} className={mergeClassName('carousel-item', className)}>
      {children}
    </div>
  )
}

type CarouselCompound = FC<CarouselProps> & {
  Item: FC<CarouselItemProps>
}

const CarouselCompound: CarouselCompound = Object.assign(Carousel, {
  Item,
})

export default CarouselCompound
