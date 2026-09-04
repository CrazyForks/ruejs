/*
Watermark 组件概述
- 使用单个绝对定位覆盖层在容器内部重复平铺水印，不引入额外的 canvas 生命周期或 DOM 观察器。
- 支持文字与图片两种水印源，覆盖常见的 Watermark 核心能力：content/image、font、rotate、width/height、gap、offset、zIndex。
- inherit 通过 CSS 自定义属性把当前水印图案继续传递给后代 Watermark；子级未显式传入 content/image 时，可直接复用上层图案。
*/
import type { FC } from '@rue-js/rue'
import { computed, onMounted, ref, watchEffect } from '@rue-js/rue'

/** WatermarkFont 接口。 */
export interface WatermarkFont {
  /** 组件语义色。 */
  color?: string
  /** fontSize 尺寸。 */
  fontSize?: number | string
  /** fontWeight 配置项。 */
  fontWeight?: 'normal' | 'lighter' | 'bold' | 'bolder' | number
  /** fontStyle 内联样式。 */
  fontStyle?: 'none' | 'normal' | 'italic' | 'oblique'
  /** fontFamily 配置项。 */
  fontFamily?: string
  /** textAlign 配置项。 */
  textAlign?: 'left' | 'right' | 'center' | 'start' | 'end'
}

/** WatermarkProps 组件属性。 */
export interface WatermarkProps {
  /** zIndex 配置项。 */
  zIndex?: number
  /** rotate 配置项。 */
  rotate?: number
  /** width 配置项。 */
  width?: number
  /** height 配置项。 */
  height?: number
  /** image 区域配置。 */
  image?: string
  /** 主体内容。 */
  content?: string | string[]
  /** font 配置项。 */
  font?: WatermarkFont
  /** 根节点附加类名。 */
  className?: string
  /** 根节点附加类名。 */
  rootClassName?: string
  /** overlayClassName 附加类名。 */
  overlayClassName?: string
  /** 根节点内联样式。 */
  style?: any
  /** overlayStyle 内联样式。 */
  overlayStyle?: any
  /** 元素间距。 */
  gap?: [number, number]
  /** offset 配置项。 */
  offset?: [number, number]
  /** opacity 配置项。 */
  opacity?: number
  /** 组件子内容。 */
  children?: any
  /** inherit 配置项。 */
  inherit?: boolean
  /** 允许透传原生属性或扩展字段。 */
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

interface WatermarkPatternResult {
  url: string
  tileWidth: number
  tileHeight: number
}

interface ParsedColor {
  r: number
  g: number
  b: number
  a: number
}

/** DEFAULT_GAP_X 内部常量。 */
const DEFAULT_GAP_X = 100
/** DEFAULT_GAP_Y 内部常量。 */
const DEFAULT_GAP_Y = 100
/** DEFAULT_Z_INDEX 内部常量。 */
const DEFAULT_Z_INDEX = 9
/** DEFAULT_OPACITY 内部常量。 */
const DEFAULT_OPACITY = 1
/** DEFAULT_DARK_TEXT_ALPHA 内部常量。 */
const DEFAULT_DARK_TEXT_ALPHA = 0.2
/** DEFAULT_LIGHT_TEXT_ALPHA 内部常量。 */
const DEFAULT_LIGHT_TEXT_ALPHA = 0.28
/** DEFAULT_DARK_TEXT_COLOR 内部常量。 */
const DEFAULT_DARK_TEXT_COLOR = `rgba(15, 23, 42, ${DEFAULT_DARK_TEXT_ALPHA})`
/** DEFAULT_LIGHT_TEXT_COLOR 内部常量。 */
const DEFAULT_LIGHT_TEXT_COLOR = `rgba(248, 250, 252, ${DEFAULT_LIGHT_TEXT_ALPHA})`
/** DEFAULT_FONT_FAMILY 内部常量。 */
const DEFAULT_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
/** DEFAULT_IMAGE_WIDTH 内部常量。 */
const DEFAULT_IMAGE_WIDTH = 120
/** DEFAULT_IMAGE_HEIGHT 内部常量。 */
const DEFAULT_IMAGE_HEIGHT = 64
/** MIN_MARK_WIDTH 内部常量。 */
const MIN_MARK_WIDTH = 32
/** MIN_MARK_HEIGHT 内部常量。 */
const MIN_MARK_HEIGHT = 24
/** WATERMARK_CACHE_LIMIT 内部常量。 */
const WATERMARK_CACHE_LIMIT = 80
/** watermarkDimensionsCache 内部缓存。 */
const watermarkDimensionsCache = /*#__PURE__*/ new Map<string, MarkDimensions>()
/** watermarkPatternCache 内部缓存。 */
const watermarkPatternCache = /*#__PURE__*/ new Map<string, WatermarkPatternResult>()

/** join Class Name 的内部工具函数。 */
const joinClassName = (...classNames: Array<string | undefined | null | false>) => {
  return classNames.filter(Boolean).join(' ')
}

/** assign Forwarded Ref 的内部工具函数。 */
const assignForwardedRef = (forwardedRef: any, element: HTMLElement | null) => {
  if (typeof forwardedRef === 'function') {
    forwardedRef(element)
  } else if (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef) {
    forwardedRef.current = element ?? undefined
  }
}

/** 转换为 Kebab Case 的内部工具函数。 */
const toKebabCase = (property: string) => {
  if (property.startsWith('--')) return property
  return property.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
}

/** serialize Style Record 的内部工具函数。 */
const serializeStyleRecord = (style: Record<string, any>) => {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${toKebabCase(key)}: ${String(value)}`)
    .join('; ')
}

/** merge Style Input 的内部工具函数。 */
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

/** clamp 的内部工具函数。 */
const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

/** escape Xml 的内部工具函数。 */
const escapeXml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 解析 CSS Alpha 的内部工具函数。 */
const parseCssAlpha = (value?: string) => {
  if (!value) return 1

  const normalizedValue = value.trim()
  if (!normalizedValue || normalizedValue === 'none') return 1

  const numericValue = Number.parseFloat(normalizedValue)
  if (!Number.isFinite(numericValue)) return 1

  return normalizedValue.endsWith('%') ? clamp(numericValue / 100, 0, 1) : clamp(numericValue, 0, 1)
}

/** 解析 CSS RGB Channel 的内部工具函数。 */
const parseCssRgbChannel = (value: string) => {
  const normalizedValue = value.trim()
  if (normalizedValue === 'none') return 0

  const numericValue = Number.parseFloat(normalizedValue)
  if (!Number.isFinite(numericValue)) return 0

  return normalizedValue.endsWith('%')
    ? clamp(Math.round((numericValue / 100) * 255), 0, 255)
    : clamp(Math.round(numericValue), 0, 255)
}

/** 解析 CSS Number 或 Percentage 的内部工具函数。 */
const parseCssNumberOrPercentage = (value: string, percentageBase = 1) => {
  const normalizedValue = value.trim()
  if (normalizedValue === 'none') return 0

  const numericValue = Number.parseFloat(normalizedValue)
  if (!Number.isFinite(numericValue)) return 0

  return normalizedValue.endsWith('%') ? (numericValue / 100) * percentageBase : numericValue
}

/** 解析 CSS Hue 的内部工具函数。 */
const parseCssHue = (value?: string) => {
  if (!value) return 0

  const normalizedValue = value.trim()
  if (!normalizedValue || normalizedValue === 'none') return 0

  const numericValue = Number.parseFloat(normalizedValue)
  if (!Number.isFinite(numericValue)) return 0

  if (normalizedValue.endsWith('rad')) {
    return (numericValue * 180) / Math.PI
  }
  if (normalizedValue.endsWith('grad')) {
    return numericValue * 0.9
  }
  if (normalizedValue.endsWith('turn')) {
    return numericValue * 360
  }

  return numericValue
}

/** 转换 Oklch 为 RGB 的内部工具函数。 */
const convertOklchToRgb = (lightness: number, chroma: number, hue: number, alpha: number) => {
  const hueRadians = (hue * Math.PI) / 180
  const oklabA = chroma * Math.cos(hueRadians)
  const oklabB = chroma * Math.sin(hueRadians)

  const lPrime = lightness + 0.3963377774 * oklabA + 0.2158037573 * oklabB
  const mPrime = lightness - 0.1055613458 * oklabA - 0.0638541728 * oklabB
  const sPrime = lightness - 0.0894841775 * oklabA - 1.291485548 * oklabB

  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3

  const convertLinearChannelToRgb = (channel: number) => {
    const srgbChannel =
      channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
    return clamp(Math.round(srgbChannel * 255), 0, 255)
  }

  return {
    r: convertLinearChannelToRgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: convertLinearChannelToRgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: convertLinearChannelToRgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  }
}

/** 解析 CSS Color 的内部工具函数。 */
const parseCssColor = (value?: string | null): ParsedColor | null => {
  if (!value) return null

  const normalizedValue = value.trim().toLowerCase()
  if (!normalizedValue || normalizedValue === 'transparent') {
    return null
  }

  const rgbMatch = normalizedValue.match(/^rgba?\((.+)\)$/)
  if (rgbMatch) {
    const [channelsPart, slashAlpha] = rgbMatch[1].split(/\s*\/\s*/)
    const usesCommas = channelsPart.includes(',')
    const channelParts = usesCommas
      ? channelsPart.split(',').map(part => part.trim())
      : channelsPart.trim().split(/\s+/)
    const alphaPart = slashAlpha ?? (usesCommas ? channelParts[3] : undefined)

    if (channelParts.length >= 3) {
      return {
        r: parseCssRgbChannel(channelParts[0]),
        g: parseCssRgbChannel(channelParts[1]),
        b: parseCssRgbChannel(channelParts[2]),
        a: parseCssAlpha(alphaPart),
      }
    }
  }

  const oklchMatch = normalizedValue.match(/^oklch\((.+)\)$/)
  if (oklchMatch) {
    const [channelsPart, slashAlpha] = oklchMatch[1].split(/\s*\/\s*/)
    const channelParts = channelsPart.trim().split(/\s+/)

    if (channelParts.length >= 3) {
      const lightness = clamp(parseCssNumberOrPercentage(channelParts[0]), 0, 1)
      const chroma = Math.max(parseCssNumberOrPercentage(channelParts[1], 0.4), 0)
      const hue = parseCssHue(channelParts[2])

      return convertOklchToRgb(lightness, chroma, hue, parseCssAlpha(slashAlpha))
    }
  }

  const hexMatch = normalizedValue.match(/^#([0-9a-f]{3,8})$/)
  if (!hexMatch) {
    return null
  }

  const hex = hexMatch[1]
  if (hex.length === 3 || hex.length === 4) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
      a: hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) / 255 : 1,
    }
  }

  if (hex.length === 6 || hex.length === 8) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
    }
  }

  return null
}

/** 计算相对亮度的内部工具函数。 */
const getRelativeLuminance = ({ r, g, b }: ParsedColor) => {
  const normalizeChannel = (channel: number) => {
    const normalizedChannel = channel / 255
    if (normalizedChannel <= 0.03928) {
      return normalizedChannel / 12.92
    }

    return ((normalizedChannel + 0.055) / 1.055) ** 2.4
  }

  const red = normalizeChannel(r)
  const green = normalizeChannel(g)
  const blue = normalizeChannel(b)
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

/** 格式化 RGB Alpha Color 的内部工具函数。 */
const formatRgbAlphaColor = (color: ParsedColor, alpha: number) => {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

/** 判断是否为暗色外观的内部工具函数。 */
const hasDarkAppearance = (element: HTMLElement, computedStyle: CSSStyleDeclaration) => {
  const appearance =
    element.getAttribute('data-rue-appearance') ?? element.getAttribute('data-theme')
  if (appearance === 'dark' || appearance === 'night' || appearance === 'coffee') {
    return true
  }

  return computedStyle.colorScheme.split(/\s+/).includes('dark')
}

/** 按背景明暗选择 Text Color 的内部工具函数。 */
const resolveTextColorFromBackground = (
  color: ParsedColor,
  themeTextColor?: ParsedColor | null,
) => {
  const isDarkBackground = getRelativeLuminance(color) < 0.35
  if (themeTextColor) {
    return formatRgbAlphaColor(
      themeTextColor,
      isDarkBackground ? DEFAULT_LIGHT_TEXT_ALPHA : DEFAULT_DARK_TEXT_ALPHA,
    )
  }

  return isDarkBackground ? DEFAULT_LIGHT_TEXT_COLOR : DEFAULT_DARK_TEXT_COLOR
}

/** 解析默认 Text Color 的内部工具函数。 */
const resolveDefaultTextColor = (element: HTMLElement | null) => {
  if (!element || typeof window === 'undefined' || !(element instanceof window.Element)) {
    return DEFAULT_DARK_TEXT_COLOR
  }

  let detectedDarkAppearance = false
  let detectedThemeTextColor: ParsedColor | null = null
  let currentElement: HTMLElement | null = element
  while (currentElement) {
    const computedStyle = window.getComputedStyle(currentElement)
    const themeTextColor = parseCssColor(computedStyle.getPropertyValue('--color-base-content'))
    if (themeTextColor && themeTextColor.a > 0.01) {
      detectedThemeTextColor = themeTextColor
    }

    const backgroundColor = parseCssColor(computedStyle.backgroundColor)
    if (backgroundColor && backgroundColor.a > 0.01) {
      return resolveTextColorFromBackground(backgroundColor, detectedThemeTextColor)
    }

    const themeBaseColor = parseCssColor(computedStyle.getPropertyValue('--color-base-100'))
    if (themeBaseColor && themeBaseColor.a > 0.01) {
      return resolveTextColorFromBackground(themeBaseColor, detectedThemeTextColor)
    }

    if (hasDarkAppearance(currentElement, computedStyle)) {
      detectedDarkAppearance = true
    }

    currentElement = currentElement.parentElement
  }

  const textColor = parseCssColor(window.getComputedStyle(element).color)
  if (textColor) {
    return getRelativeLuminance(textColor) > 0.6
      ? formatRgbAlphaColor(textColor, DEFAULT_LIGHT_TEXT_ALPHA)
      : formatRgbAlphaColor(textColor, DEFAULT_DARK_TEXT_ALPHA)
  }

  if (detectedDarkAppearance) {
    if (detectedThemeTextColor) {
      return formatRgbAlphaColor(detectedThemeTextColor, DEFAULT_LIGHT_TEXT_ALPHA)
    }
    return DEFAULT_LIGHT_TEXT_COLOR
  }

  return DEFAULT_DARK_TEXT_COLOR
}

/** 归一化 Font Size 的内部工具函数。 */
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

/** 归一化 Content 的内部工具函数。 */
const normalizeContent = (content?: string | string[]) => {
  if (content == null) {
    return [] as string[]
  }

  const items = Array.isArray(content) ? content : [content]
  return items.flatMap(item => String(item).split(/\r?\n/))
}

/** 判断是否存在 Meaningful Content 的内部工具函数。 */
const hasMeaningfulContent = (lines: string[]) => {
  return lines.some(line => line.trim().length > 0)
}

/** measure Text Block 的内部工具函数。 */
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

/** 解析 Text Anchor 的内部工具函数。 */
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

/** 构建 Font Cache Key 的内部工具函数。 */
const buildFontCacheKey = (font: WatermarkFont) => {
  return [
    font.color ?? '',
    font.fontSize ?? '',
    font.fontWeight ?? '',
    font.fontStyle ?? '',
    font.fontFamily ?? '',
    font.textAlign ?? '',
  ]
}

/** 构建 Dimensions Cache Key 的内部工具函数。 */
const buildDimensionsCacheKey = ({
  image,
  lines,
  font,
  width,
  height,
}: {
  image?: string
  lines: string[]
  font: WatermarkFont
  width?: number
  height?: number
}) => {
  return JSON.stringify([image ?? '', lines, buildFontCacheKey(font), width ?? '', height ?? ''])
}

/** 构建 Pattern Cache Key 的内部工具函数。 */
const buildPatternCacheKey = ({
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
}): string => {
  return JSON.stringify([
    image ?? '',
    lines,
    rotate,
    buildFontCacheKey(font),
    gapX,
    gapY,
    dimensions.markWidth,
    dimensions.markHeight,
    dimensions.lineHeight,
    dimensions.fontSizePx,
    opacity,
  ])
}

/** 读取 Cache Value 的内部工具函数。 */
const readCacheValue = <T,>(cache: Map<string, T>, key: string) => {
  const value = cache.get(key)
  if (value !== undefined) {
    cache.delete(key)
    cache.set(key, value)
  }
  return value
}

/** 写入 Cache Value 的内部工具函数。 */
const writeCacheValue = <T,>(cache: Map<string, T>, key: string, value: T) => {
  cache.delete(key)
  cache.set(key, value)

  while (cache.size > WATERMARK_CACHE_LIMIT) {
    const firstKey = cache.keys().next().value
    if (firstKey === undefined) {
      break
    }
    cache.delete(firstKey)
  }

  return value
}

/** 构建 Overlay Placement 的内部工具函数。 */
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

/** 构建 Pattern Url 的内部工具函数。 */
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
  const color = font.color ?? DEFAULT_DARK_TEXT_COLOR
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

/** Watermark 的内部工具函数。 */
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
  ref: forwardedRef,
  ...rest
}) => {
  const autoTextColor = ref<string | undefined>(undefined)
  let rootElement: HTMLElement | null = null
  let overlayElement: HTMLElement | null = null
  let lastAutoTextColorElement: HTMLElement | null = null
  let lastAutoTextColorSignature = ''

  const getLines = () => normalizeContent(content)
  const getGapX = () => gap?.[0] ?? DEFAULT_GAP_X
  const getGapY = () => gap?.[1] ?? DEFAULT_GAP_Y
  const hasLocalPattern = () => !!image || hasMeaningfulContent(getLines())
  const getResolvedFont = () => {
    if (!image && !font.color && hasMeaningfulContent(getLines()) && autoTextColor.value) {
      return { ...font, color: autoTextColor.value }
    }

    return font
  }

  const getCachedDimensions = (nextResolvedFont: WatermarkFont) => {
    const dimensionsKey = buildDimensionsCacheKey({
      image,
      lines: getLines(),
      font: nextResolvedFont,
      width,
      height,
    })
    const cachedDimensions = readCacheValue(watermarkDimensionsCache, dimensionsKey)
    if (cachedDimensions) {
      return cachedDimensions
    }

    const nextDimensions = measureTextBlock(getLines(), nextResolvedFont, width, height, image)
    return writeCacheValue(watermarkDimensionsCache, dimensionsKey, nextDimensions)
  }

  const getCachedPattern = (nextResolvedFont: WatermarkFont, nextDimensions: MarkDimensions) => {
    const currentLines = getLines()
    const patternLines = currentLines.length ? currentLines : ['']
    const nextOpacity = clamp(opacity, 0, 1)
    const patternKey = buildPatternCacheKey({
      image,
      lines: patternLines,
      rotate,
      font: nextResolvedFont,
      gapX: getGapX(),
      gapY: getGapY(),
      dimensions: nextDimensions,
      opacity: nextOpacity,
    })
    const cachedPattern = readCacheValue(watermarkPatternCache, patternKey)
    if (cachedPattern) {
      return cachedPattern
    }

    const nextPattern = buildPatternUrl({
      image,
      lines: patternLines,
      rotate,
      font: nextResolvedFont,
      gapX: getGapX(),
      gapY: getGapY(),
      dimensions: nextDimensions,
      opacity: nextOpacity,
    })
    return writeCacheValue(watermarkPatternCache, patternKey, nextPattern)
  }

  const getPatternState = () => {
    const nextResolvedFont = getResolvedFont()
    const nextPlacement = buildOverlayPlacement(getGapX(), getGapY(), offset)
    const nextDimensions = getCachedDimensions(nextResolvedFont)
    const nextPattern = hasLocalPattern()
      ? getCachedPattern(nextResolvedFont, nextDimensions)
      : null

    return {
      placement: nextPlacement,
      pattern: nextPattern,
    }
  }

  const createRootStyleText = (
    nextPlacement: OverlayPlacement,
    nextPattern: ReturnType<typeof buildPatternUrl> | null,
  ) => {
    const rootStyleRecord: Record<string, any> = {
      position: style?.position ?? 'relative',
      overflow: style?.overflow ?? 'hidden',
      isolation: style?.isolation ?? 'isolate',
    }

    if (nextPattern) {
      rootStyleRecord['--rue-watermark-image'] = nextPattern.url
      rootStyleRecord['--rue-watermark-size'] =
        `${nextPattern.tileWidth}px ${nextPattern.tileHeight}px`
      rootStyleRecord['--rue-watermark-position'] = nextPlacement.backgroundPosition
      rootStyleRecord['--rue-watermark-left'] = nextPlacement.left
      rootStyleRecord['--rue-watermark-top'] = nextPlacement.top
      rootStyleRecord['--rue-watermark-width'] = nextPlacement.width
      rootStyleRecord['--rue-watermark-height'] = nextPlacement.height
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

    return mergeStyleInput(rootStyleRecord, style)
  }

  const createOverlayStyleText = (
    nextPlacement: OverlayPlacement,
    nextPattern: ReturnType<typeof buildPatternUrl> | null,
  ) => {
    const overlayResolvedStyleRecord: Record<string, any> = {
      position: 'absolute',
      left: nextPattern ? nextPlacement.left : 'var(--rue-watermark-left, 0px)',
      top: nextPattern ? nextPlacement.top : 'var(--rue-watermark-top, 0px)',
      width: nextPattern ? nextPlacement.width : 'var(--rue-watermark-width, 100%)',
      height: nextPattern ? nextPlacement.height : 'var(--rue-watermark-height, 100%)',
      pointerEvents: 'none',
      backgroundRepeat: 'repeat',
      backgroundImage: nextPattern
        ? 'var(--rue-watermark-image, none)'
        : inherit
          ? 'var(--rue-watermark-image, none)'
          : 'none',
      backgroundSize: nextPattern
        ? 'var(--rue-watermark-size, auto)'
        : inherit
          ? 'var(--rue-watermark-size, auto)'
          : 'auto',
      backgroundPosition: nextPattern
        ? 'var(--rue-watermark-position, 0px 0px)'
        : inherit
          ? 'var(--rue-watermark-position, 0px 0px)'
          : '0px 0px',
      zIndex: nextPattern
        ? 'var(--rue-watermark-z-index, 9)'
        : inherit
          ? 'var(--rue-watermark-z-index, 9)'
          : 0,
    }

    return mergeStyleInput(overlayResolvedStyleRecord, overlayStyle)
  }

  const createAutoTextColorSignature = () => {
    const styleSignature =
      typeof style === 'string'
        ? style
        : [
            style?.background,
            style?.backgroundColor,
            style?.color,
            style?.colorScheme,
            style?.['--color-base-100'],
            style?.['--color-base-content'],
          ].join('|')

    return JSON.stringify([getLines(), className ?? '', rootClassName ?? '', styleSignature])
  }

  const patternState = computed(() => getPatternState())
  const rootStyleText = computed(() => {
    const nextPatternState = patternState.get()
    return createRootStyleText(nextPatternState.placement, nextPatternState.pattern)
  })
  const overlayStyleText = computed(() => {
    const nextPatternState = patternState.get()
    return createOverlayStyleText(nextPatternState.placement, nextPatternState.pattern)
  })

  const syncStyleText = (element: HTMLElement | null, styleText: string) => {
    if (!element) return
    if (styleText) {
      element.setAttribute('style', styleText)
    } else {
      element.removeAttribute('style')
    }
  }

  const syncPatternStyles = () => {
    const nextPatternState = getPatternState()
    syncStyleText(
      rootElement,
      createRootStyleText(nextPatternState.placement, nextPatternState.pattern),
    )
    syncStyleText(
      overlayElement,
      createOverlayStyleText(nextPatternState.placement, nextPatternState.pattern),
    )
  }

  const syncAutoTextColor = (force = false) => {
    if (image || font.color || !hasMeaningfulContent(getLines())) {
      return
    }

    const nextSignature = createAutoTextColorSignature()
    if (
      !force &&
      rootElement === lastAutoTextColorElement &&
      nextSignature === lastAutoTextColorSignature
    ) {
      return
    }

    if (rootElement) {
      const nextPatternState = getPatternState()
      syncStyleText(
        rootElement,
        createRootStyleText(nextPatternState.placement, nextPatternState.pattern),
      )
    }

    const nextColor = resolveDefaultTextColor(rootElement)
    lastAutoTextColorElement = rootElement
    lastAutoTextColorSignature = nextSignature

    if (autoTextColor.value !== nextColor) {
      autoTextColor.value = nextColor
      syncPatternStyles()
    }
  }

  const applyRootRef = (element: HTMLElement | null) => {
    if (rootElement === element) {
      return
    }

    rootElement = element
    assignForwardedRef(forwardedRef, element)
    syncAutoTextColor(true)
  }

  const applyOverlayRef = (element: HTMLElement | null) => {
    overlayElement = element
  }

  const scheduleAutoTextColorSync = () => {
    const run = () => syncAutoTextColor(true)
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(run)
      return
    }

    Promise.resolve().then(run)
  }

  watchEffect(() => {
    syncPatternStyles()
  })

  onMounted(() => {
    syncAutoTextColor(true)
    scheduleAutoTextColorSync()
  })

  return (
    <div
      {...rest}
      ref={applyRootRef}
      className={joinClassName('rue-watermark', className, rootClassName)}
      style={rootStyleText.get()}
      data-rue-watermark-root="true"
      data-rue-watermark-inherit={inherit ? 'true' : 'false'}
    >
      <div
        aria-hidden="true"
        ref={applyOverlayRef}
        className={joinClassName('rue-watermark-overlay', overlayClassName)}
        style={overlayStyleText.get()}
        data-rue-watermark-overlay="true"
      />
      {children}
    </div>
  )
}

/** 默认导出水印组件。 */
export default Watermark
