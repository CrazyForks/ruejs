/* RUE_VAPOR_TRANSFORMED */
/*
Watermark 组件概述
- 使用单个绝对定位覆盖层在容器内部重复平铺水印，不引入额外的 canvas 生命周期或 DOM 观察器。
- 支持文字与图片两种水印源，覆盖常见的 Watermark 核心能力：content/image、font、rotate、width/height、gap、offset、zIndex。
- inherit 通过 CSS 自定义属性把当前水印图案继续传递给后代 Watermark；子级未显式传入 content/image 时，可直接复用上层图案。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, useRef, watch } from '@rue-js/rue'

export interface WatermarkFont {
  color?: string
  fontSize?: number | string
  fontWeight?: 'normal' | 'lighter' | 'bold' | 'bolder' | number
  fontStyle?: 'none' | 'normal' | 'italic' | 'oblique'
  fontFamily?: string
  textAlign?: 'left' | 'right' | 'center' | 'start' | 'end'
}

export interface WatermarkProps {
  zIndex?: number
  rotate?: number
  width?: number
  height?: number
  image?: string
  content?: string | string[]
  font?: WatermarkFont
  className?: string
  rootClassName?: string
  overlayClassName?: string
  style?: any
  overlayStyle?: any
  gap?: [number, number]
  offset?: [number, number]
  opacity?: number
  children?: any
  inherit?: boolean
  [key: string]: any
}

interface OverlayPlacement {
  left: string
  top: string
  width: string
  height: string
  backgroundPosition: string
}

interface MarkDimensions {
  markWidth: number
  markHeight: number
  lineHeight: number
  fontSizePx: number
}

const DEFAULT_GAP_X = 100
const DEFAULT_GAP_Y = 100
const DEFAULT_Z_INDEX = 9
const DEFAULT_OPACITY = 1
const DEFAULT_TEXT_COLOR = 'rgba(15, 23, 42, 0.14)'
const DEFAULT_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const DEFAULT_IMAGE_WIDTH = 120
const DEFAULT_IMAGE_HEIGHT = 64
const MIN_MARK_WIDTH = 32
const MIN_MARK_HEIGHT = 24

const joinClassName = (...classNames: Array<string | undefined | null | false>) => {
  return classNames.filter(Boolean).join(' ')
}

const assignForwardedRef = (forwardedRef: any, element: HTMLElement | null) => {
  if (typeof forwardedRef === 'function') {
    forwardedRef(element)
  } else if (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef) {
    forwardedRef.current = element ?? undefined
  }
}

const toKebabCase = (property: string) => {
  if (property.startsWith('--')) return property
  return property.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
}

const serializeStyleRecord = (style: Record<string, any>) => {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${toKebabCase(key)}: ${String(value)}`)
    .join('; ')
}

const mergeStyleInput = (
  baseStyle: Record<string, any>,
  extraStyle?: Record<string, any> | string,
) => {
  const serializedBaseStyle = serializeStyleRecord(baseStyle)
  if (!extraStyle) return serializedBaseStyle
  if (typeof extraStyle === 'string') {
    return serializedBaseStyle ? `${serializedBaseStyle}; ${extraStyle}` : extraStyle
  }

  const serializedExtraStyle = serializeStyleRecord(extraStyle)
  if (!serializedBaseStyle) return serializedExtraStyle
  if (!serializedExtraStyle) return serializedBaseStyle
  return `${serializedBaseStyle}; ${serializedExtraStyle}`
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

const escapeXml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const normalizeFontSize = (fontSize?: number | string) => {
  if (typeof fontSize === 'number' && Number.isFinite(fontSize)) {
    return fontSize
  }

  if (typeof fontSize === 'string') {
    const numeric = Number.parseFloat(fontSize)
    if (Number.isFinite(numeric)) {
      if (fontSize.endsWith('rem')) {
        return numeric * 16
      }
      return numeric
    }
  }

  return 16
}

const normalizeContent = (content?: string | string[]) => {
  if (content == null) {
    return [] as string[]
  }

  const items = Array.isArray(content) ? content : [content]
  return items.flatMap(item => String(item).split(/\r?\n/))
}

const hasMeaningfulContent = (lines: string[]) => {
  return lines.some(line => line.trim().length > 0)
}

const measureTextBlock = (
  lines: string[],
  font: WatermarkFont,
  width?: number,
  height?: number,
  image?: string,
): MarkDimensions => {
  const fontSizePx = normalizeFontSize(font.fontSize)
  const lineHeight = Math.max(Math.round(fontSizePx * 1.45), fontSizePx + 6)

  if (image) {
    return {
      markWidth: Math.max(width ?? DEFAULT_IMAGE_WIDTH, MIN_MARK_WIDTH),
      markHeight: Math.max(height ?? DEFAULT_IMAGE_HEIGHT, MIN_MARK_HEIGHT),
      lineHeight,
      fontSizePx,
    }
  }

  if (width != null && height != null) {
    return {
      markWidth: Math.max(width, MIN_MARK_WIDTH),
      markHeight: Math.max(height, MIN_MARK_HEIGHT),
      lineHeight,
      fontSizePx,
    }
  }

  const fontFamily = font.fontFamily ?? DEFAULT_FONT_FAMILY
  const fontWeight = font.fontWeight ?? 'normal'
  const fontStyle = font.fontStyle && font.fontStyle !== 'none' ? font.fontStyle : 'normal'

  let measuredWidth = 0
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (context) {
      context.font = `${fontStyle} ${fontWeight} ${fontSizePx}px ${fontFamily}`
      measuredWidth = Math.ceil(
        lines.reduce((maxWidth, line) => {
          return Math.max(maxWidth, context.measureText(line).width)
        }, 0),
      )
    }
  }

  if (!measuredWidth) {
    measuredWidth = Math.ceil(
      lines.reduce((maxWidth, line) => {
        return Math.max(maxWidth, line.length * fontSizePx * 0.62)
      }, 0),
    )
  }

  const lineCount = Math.max(lines.length, 1)
  const measuredHeight = Math.ceil(fontSizePx + (lineCount - 1) * lineHeight)

  return {
    markWidth: Math.max(width ?? measuredWidth, MIN_MARK_WIDTH),
    markHeight: Math.max(height ?? measuredHeight, MIN_MARK_HEIGHT),
    lineHeight,
    fontSizePx,
  }
}

const resolveTextAnchor = (textAlign?: WatermarkFont['textAlign']) => {
  switch (textAlign) {
    case 'left':
    case 'start':
      return { anchor: 'start', xRatio: 0 }
    case 'right':
    case 'end':
      return { anchor: 'end', xRatio: 1 }
    default:
      return { anchor: 'middle', xRatio: 0.5 }
  }
}

const buildOverlayPlacement = (
  gapX: number,
  gapY: number,
  offset?: [number, number],
): OverlayPlacement => {
  const gapXCenter = gapX / 2
  const gapYCenter = gapY / 2
  const offsetLeft = offset?.[0] ?? gapXCenter
  const offsetTop = offset?.[1] ?? gapYCenter

  let positionLeft = offsetLeft - gapXCenter
  let positionTop = offsetTop - gapYCenter

  let left = '0px'
  let top = '0px'
  let width = '100%'
  let height = '100%'

  if (positionLeft > 0) {
    left = `${positionLeft}px`
    width = `calc(100% - ${positionLeft}px)`
    positionLeft = 0
  }

  if (positionTop > 0) {
    top = `${positionTop}px`
    height = `calc(100% - ${positionTop}px)`
    positionTop = 0
  }

  return {
    left,
    top,
    width,
    height,
    backgroundPosition: `${positionLeft}px ${positionTop}px`,
  }
}

const buildPatternUrl = ({
  image,
  lines,
  rotate,
  font,
  gapX,
  gapY,
  dimensions,
  opacity,
}: {
  image?: string
  lines: string[]
  rotate: number
  font: WatermarkFont
  gapX: number
  gapY: number
  dimensions: MarkDimensions
  opacity: number
}) => {
  const { markWidth, markHeight, lineHeight, fontSizePx } = dimensions
  const tileWidth = markWidth + gapX
  const tileHeight = markHeight + gapY
  const translateX = gapX / 2
  const translateY = gapY / 2
  const rotateCx = translateX + markWidth / 2
  const rotateCy = translateY + markHeight / 2
  const color = font.color ?? DEFAULT_TEXT_COLOR
  const fontWeight = font.fontWeight ?? 'normal'
  const fontStyle = font.fontStyle && font.fontStyle !== 'none' ? font.fontStyle : 'normal'
  const fontFamily = font.fontFamily ?? DEFAULT_FONT_FAMILY
  const { anchor, xRatio } = resolveTextAnchor(font.textAlign)

  let body = ''

  if (image) {
    body = `<image href="${escapeXml(image)}" x="${translateX}" y="${translateY}" width="${markWidth}" height="${markHeight}" preserveAspectRatio="xMidYMid meet" />`
  } else {
    const lineCount = Math.max(lines.length, 1)
    const textBlockHeight = fontSizePx + (lineCount - 1) * lineHeight
    const textTop = translateY + Math.max((markHeight - textBlockHeight) / 2, 0)
    const textX = translateX + markWidth * xRatio

    body = lines
      .map((line, index) => {
        const y = textTop + index * lineHeight
        return `<text x="${textX}" y="${y}" fill="${escapeXml(color)}" font-size="${fontSizePx}" font-weight="${escapeXml(String(fontWeight))}" font-style="${escapeXml(fontStyle)}" font-family="${escapeXml(fontFamily)}" text-anchor="${anchor}" dominant-baseline="hanging">${escapeXml(line)}</text>`
      })
      .join('')
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}"><g opacity="${opacity}" transform="rotate(${rotate} ${rotateCx} ${rotateCy})">${body}</g></svg>`

  return {
    url: `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}")`,
    tileWidth,
    tileHeight,
  }
}

const Watermark: FC<WatermarkProps> = ({
  zIndex,
  rotate = -22,
  width,
  height,
  image,
  content,
  font = {},
  className,
  rootClassName,
  overlayClassName,
  style,
  overlayStyle,
  gap = [DEFAULT_GAP_X, DEFAULT_GAP_Y],
  offset,
  opacity = DEFAULT_OPACITY,
  children,
  inherit = true,
  ...rest
}) => {
  const forwardedRef = rest.ref
  const rootRef = useRef<HTMLElement | null>(null)
  const overlayRef = useRef<HTMLElement | null>(null)
  if ('ref' in rest) {
    delete rest.ref
  }

  const lines = normalizeContent(content)
  const [gapX = DEFAULT_GAP_X, gapY = DEFAULT_GAP_Y] = gap
  const hasLocalPattern = !!image || hasMeaningfulContent(lines)
  const dimensions = measureTextBlock(lines, font, width, height, image)
  const placement = buildOverlayPlacement(gapX, gapY, offset)
  const nextOpacity = clamp(opacity, 0, 1)
  const pattern = hasLocalPattern
    ? buildPatternUrl({
        image,
        lines: lines.length ? lines : [''],
        rotate,
        font,
        gapX,
        gapY,
        dimensions,
        opacity: nextOpacity,
      })
    : null

  const rootStyleRecord: Record<string, any> = {
    position: style?.position ?? 'relative',
    overflow: style?.overflow ?? 'hidden',
    isolation: style?.isolation ?? 'isolate',
  }

  if (pattern) {
    rootStyleRecord['--rue-watermark-image'] = pattern.url
    rootStyleRecord['--rue-watermark-size'] = `${pattern.tileWidth}px ${pattern.tileHeight}px`
    rootStyleRecord['--rue-watermark-position'] = placement.backgroundPosition
    rootStyleRecord['--rue-watermark-left'] = placement.left
    rootStyleRecord['--rue-watermark-top'] = placement.top
    rootStyleRecord['--rue-watermark-width'] = placement.width
    rootStyleRecord['--rue-watermark-height'] = placement.height
    rootStyleRecord['--rue-watermark-z-index'] = String(zIndex ?? DEFAULT_Z_INDEX)
  } else if (!inherit) {
    rootStyleRecord['--rue-watermark-image'] = 'none'
    rootStyleRecord['--rue-watermark-size'] = 'auto'
    rootStyleRecord['--rue-watermark-position'] = '0px 0px'
    rootStyleRecord['--rue-watermark-left'] = '0px'
    rootStyleRecord['--rue-watermark-top'] = '0px'
    rootStyleRecord['--rue-watermark-width'] = '100%'
    rootStyleRecord['--rue-watermark-height'] = '100%'
    rootStyleRecord['--rue-watermark-z-index'] = '0'
  }

  const rootStyleText = mergeStyleInput(rootStyleRecord, style)

  const overlayResolvedStyleRecord: Record<string, any> = {
    position: 'absolute',
    left: pattern ? placement.left : 'var(--rue-watermark-left, 0px)',
    top: pattern ? placement.top : 'var(--rue-watermark-top, 0px)',
    width: pattern ? placement.width : 'var(--rue-watermark-width, 100%)',
    height: pattern ? placement.height : 'var(--rue-watermark-height, 100%)',
    pointerEvents: 'none',
    backgroundRepeat: 'repeat',
    backgroundImage: pattern ? pattern.url : inherit ? 'var(--rue-watermark-image, none)' : 'none',
    backgroundSize: pattern
      ? `${pattern.tileWidth}px ${pattern.tileHeight}px`
      : inherit
        ? 'var(--rue-watermark-size, auto)'
        : 'auto',
    backgroundPosition: pattern
      ? placement.backgroundPosition
      : inherit
        ? 'var(--rue-watermark-position, 0px 0px)'
        : '0px 0px',
    zIndex: pattern ? (zIndex ?? DEFAULT_Z_INDEX) : inherit ? 'var(--rue-watermark-z-index, 9)' : 0,
  }

  const overlayStyleText = mergeStyleInput(overlayResolvedStyleRecord, overlayStyle)

  const syncStyleText = (element: HTMLElement | null | undefined, styleText: string) => {
    if (!element) return
    if (styleText) {
      element.setAttribute('style', styleText)
    } else {
      element.removeAttribute('style')
    }
  }

  const applyRootRef = (element: HTMLElement | null) => {
    rootRef.current = element
    syncStyleText(element, rootStyleText)
    assignForwardedRef(forwardedRef, element)
  }

  const applyOverlayRef = (element: HTMLElement | null) => {
    overlayRef.current = element
    syncStyleText(element, overlayStyleText)
  }

  onMounted(() => {
    syncStyleText(rootRef.current, rootStyleText)
    syncStyleText(overlayRef.current, overlayStyleText)
  })

  watch(
    () => rootStyleText,
    (nextStyle: string) => {
      syncStyleText(rootRef.current, nextStyle)
    },
    { immediate: true },
  )

  watch(
    () => overlayStyleText,
    (nextStyle: string) => {
      syncStyleText(overlayRef.current, nextStyle)
    },
    { immediate: true },
  )

  return (
    <div
      {...rest}
      ref={applyRootRef}
      className={joinClassName('rue-watermark', className, rootClassName)}
      data-rue-watermark-root="true"
      data-rue-watermark-inherit={inherit ? 'true' : 'false'}
    >
      <div
        aria-hidden="true"
        ref={applyOverlayRef}
        className={joinClassName('rue-watermark-overlay', overlayClassName)}
        data-rue-watermark-overlay="true"
      />
      {children}
    </div>
  )
}

export default Watermark
