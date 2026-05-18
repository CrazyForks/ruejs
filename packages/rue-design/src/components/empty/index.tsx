import type { FC } from '@rue-js/rue'
import { h } from '@rue-js/rue'

export type EmptySize = 'sm' | 'md' | 'lg' | 'small' | 'default' | 'large'
export type EmptyAlign = 'center' | 'start'
export type EmptyVariant = 'surface' | 'soft' | 'outline'

export interface EmptyClassNames {
  root?: string
  image?: string
  description?: string
  footer?: string
}

export interface EmptyStyles {
  root?: Record<string, any>
  image?: Record<string, any>
  description?: Record<string, any>
  footer?: Record<string, any>
}

export interface EmptyPresentedImageProps {
  className?: string
  style?: any
  size?: EmptySize
}

export interface EmptyProps {
  image?: string | FC<EmptyPresentedImageProps> | any
  description?: any
  imageStyle?: any
  imageAlt?: string
  children?: any
  size?: EmptySize
  align?: EmptyAlign
  variant?: EmptyVariant
  className?: string
  rootClassName?: string
  style?: any
  classNames?: EmptyClassNames
  styles?: EmptyStyles
  role?: string
  [key: string]: any
}

export interface EmptyType extends FC<EmptyProps> {
  PRESENTED_IMAGE_DEFAULT: FC<EmptyPresentedImageProps>
  PRESENTED_IMAGE_SIMPLE: FC<EmptyPresentedImageProps>
}

const DEFAULT_DESCRIPTION = '暂无数据'

const appendClassName = (base?: string, className?: string) => {
  if (!base) return className ?? ''
  return className ? `${base} ${className}` : base
}

const mergeStyles = (...styles: Array<Record<string, any> | undefined>) => {
  return Object.assign({}, ...styles.filter(Boolean))
}

const SVG_NEUTRAL_CLASS = 'text-base-content'
const SVG_ACCENT_CLASS = 'text-primary'

const svgFillMixStyle = (strength: number) => ({
  fill: `color-mix(in oklab, currentColor ${strength}%, transparent)`,
})

const svgStrokeMixStyle = (strength: number) => ({
  stroke: `color-mix(in oklab, currentColor ${strength}%, transparent)`,
})

const hasRenderableContent = (value: any): boolean => {
  if (value === undefined || value === null || value === false || value === '') return false
  if (Array.isArray(value)) return value.some(item => hasRenderableContent(item))
  return true
}

const normalizeSize = (size?: EmptySize): 'sm' | 'md' | 'lg' => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'large':
      return 'lg'
    case 'default':
      return 'md'
    case 'sm':
    case 'lg':
      return size
    default:
      return 'md'
  }
}

const resolveVariantClass = (variant: EmptyVariant) => {
  switch (variant) {
    case 'soft':
      return 'border border-base-300/60 bg-base-200/55 shadow-inner'
    case 'outline':
      return 'border border-dashed border-base-300/75 bg-base-100/45 shadow-none'
    default:
      return 'border border-base-300/70 bg-base-100 shadow-[0_28px_70px_-48px_hsl(var(--bc)/0.24)]'
  }
}

const resolveRootSpacingClass = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return 'rounded-[1.5rem] px-4 py-5'
    case 'lg':
      return 'rounded-[2rem] px-8 py-9'
    default:
      return 'rounded-[1.75rem] px-6 py-7'
  }
}

const resolveContentGapClass = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return 'gap-3'
    case 'lg':
      return 'gap-5'
    default:
      return 'gap-4'
  }
}

const resolveDescriptionClass = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return 'text-sm leading-6'
    case 'lg':
      return 'text-base leading-7'
    default:
      return 'text-sm leading-6 sm:text-[0.95rem]'
  }
}

const resolveFooterClass = (align: EmptyAlign) => {
  return align === 'start'
    ? 'flex flex-wrap items-center justify-start gap-3'
    : 'flex flex-wrap items-center justify-center gap-3'
}

const resolveImageShellWidthClass = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return 'w-[9.5rem]'
    case 'lg':
      return 'w-[16rem]'
    default:
      return 'w-[12rem]'
  }
}

const resolvePresentedImageWidthClass = (size: 'sm' | 'md' | 'lg', kind: 'default' | 'simple') => {
  if (kind === 'simple') {
    switch (size) {
      case 'sm':
        return 'w-[6.5rem]'
      case 'lg':
        return 'w-[9.5rem]'
      default:
        return 'w-[8rem]'
    }
  }

  switch (size) {
    case 'sm':
      return 'w-[9rem]'
    case 'lg':
      return 'w-[14rem]'
    default:
      return 'w-[11rem]'
  }
}

const resolveAltText = (description: any, imageAlt?: string) => {
  if (typeof imageAlt === 'string' && imageAlt.trim()) return imageAlt
  if (typeof description === 'string' || typeof description === 'number') return String(description)
  return 'empty'
}

const DefaultPresentedImage: FC<EmptyPresentedImageProps> = ({ className, style, size }) => {
  const normalizedSize = normalizeSize(size)
  const widthClass = resolvePresentedImageWidthClass(normalizedSize, 'default')

  return (
    <svg
      viewBox="0 0 220 164"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={appendClassName(`${widthClass} h-auto`, className)}
      style={style}
      data-rue-empty-illustration="default"
      aria-hidden="true"
    >
      <rect
        x="18"
        y="38"
        width="184"
        height="98"
        rx="26"
        className={SVG_NEUTRAL_CLASS}
        style={svgFillMixStyle(6)}
      />
      <rect
        x="18.75"
        y="38.75"
        width="182.5"
        height="96.5"
        rx="25.25"
        className={SVG_NEUTRAL_CLASS}
        style={svgStrokeMixStyle(14)}
        strokeWidth="1.5"
      />
      <rect
        x="49"
        y="24"
        width="122"
        height="18"
        rx="9"
        className={SVG_NEUTRAL_CLASS}
        style={svgFillMixStyle(10)}
      />
      <rect
        x="52"
        y="63"
        width="48"
        height="48"
        rx="18"
        className={SVG_ACCENT_CLASS}
        style={svgFillMixStyle(14)}
      />
      <circle cx="82" cy="77.5" r="8" className={SVG_ACCENT_CLASS} style={svgFillMixStyle(36)} />
      <path
        d="M67 96.5c8.4-11.5 15.7-17.2 22-17.2 6.6 0 14.4 6 23.4 18"
        className={SVG_NEUTRAL_CLASS}
        style={svgStrokeMixStyle(16)}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect
        x="116"
        y="70"
        width="56"
        height="10"
        rx="5"
        className={SVG_NEUTRAL_CLASS}
        style={svgFillMixStyle(16)}
      />
      <rect
        x="116"
        y="90"
        width="40"
        height="10"
        rx="5"
        className={SVG_NEUTRAL_CLASS}
        style={svgFillMixStyle(10)}
      />
      <rect
        x="122"
        y="116"
        width="54"
        height="8"
        rx="4"
        className={SVG_ACCENT_CLASS}
        style={svgFillMixStyle(14)}
      />
      <circle cx="180" cy="54" r="10" className={SVG_NEUTRAL_CLASS} style={svgFillMixStyle(10)} />
      <path
        d="M176 54h8M180 50v8"
        className={SVG_ACCENT_CLASS}
        style={svgStrokeMixStyle(66)}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M38 124c12.2-7.3 22.4-11 30.6-11 8.5 0 19.6 4.6 33.4 13.8"
        className={SVG_NEUTRAL_CLASS}
        style={svgStrokeMixStyle(10)}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

const SimplePresentedImage: FC<EmptyPresentedImageProps> = ({ className, style, size }) => {
  const normalizedSize = normalizeSize(size)
  const widthClass = resolvePresentedImageWidthClass(normalizedSize, 'simple')

  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={appendClassName(`${widthClass} h-auto`, className)}
      style={style}
      data-rue-empty-illustration="simple"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="34" className={SVG_NEUTRAL_CLASS} style={svgFillMixStyle(6)} />
      <circle
        cx="60"
        cy="60"
        r="34"
        className={SVG_NEUTRAL_CLASS}
        style={svgStrokeMixStyle(14)}
        strokeWidth="1.5"
      />
      <circle
        cx="60"
        cy="60"
        r="23"
        className={SVG_ACCENT_CLASS}
        style={svgStrokeMixStyle(36)}
        strokeWidth="8"
      />
      <circle cx="60" cy="60" r="6" className={SVG_ACCENT_CLASS} style={svgFillMixStyle(66)} />
      <path
        d="M43 60h34"
        className={SVG_NEUTRAL_CLASS}
        style={svgStrokeMixStyle(16)}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="32" cy="45" r="4" className={SVG_ACCENT_CLASS} style={svgFillMixStyle(36)} />
      <circle cx="90" cy="78" r="4" className={SVG_ACCENT_CLASS} style={svgFillMixStyle(36)} />
    </svg>
  )
}

const Empty = (({
  image,
  description,
  imageStyle,
  imageAlt,
  children,
  size,
  align = 'center',
  variant = 'surface',
  className,
  rootClassName,
  style,
  classNames,
  styles,
  role = 'status',
  ...rest
}: EmptyProps) => {
  const normalizedSize = normalizeSize(size)
  const mergedDescription = description === undefined ? DEFAULT_DESCRIPTION : description
  const mergedImage = image === undefined ? DefaultPresentedImage : image
  const hasImage = hasRenderableContent(mergedImage)
  const hasDescription = hasRenderableContent(mergedDescription)
  const hasFooter = hasRenderableContent(children)

  const rootCls = appendClassName(
    appendClassName(
      `rue-empty relative isolate overflow-hidden ${resolveVariantClass(variant)} ${resolveRootSpacingClass(normalizedSize)}`,
      align === 'start' ? 'text-left' : 'text-center',
    ),
    appendClassName(appendClassName(rootClassName, classNames?.root), className),
  )

  const imageShellCls = appendClassName(
    `${resolveImageShellWidthClass(normalizedSize)} max-w-full shrink-0`,
    classNames?.image,
  )

  const descriptionCls = appendClassName(
    `max-w-[34rem] text-base-content/68 ${resolveDescriptionClass(normalizedSize)}`,
    classNames?.description,
  )

  const footerCls = appendClassName(resolveFooterClass(align), classNames?.footer)
  const rootStyle = mergeStyles(styles?.root, style)
  const imageShellStyle = mergeStyles(styles?.image, imageStyle)
  const descriptionStyle = mergeStyles(styles?.description)
  const footerStyle = mergeStyles(styles?.footer)
  const imageNode =
    typeof mergedImage === 'string' ? (
      <img
        src={mergedImage}
        alt={resolveAltText(mergedDescription, imageAlt)}
        draggable={false}
        className="block h-auto w-full object-contain"
      />
    ) : mergedImage === DefaultPresentedImage || mergedImage === SimplePresentedImage ? (
      h(mergedImage as FC<EmptyPresentedImageProps>, { size: normalizedSize })
    ) : typeof mergedImage === 'function' ? (
      h(mergedImage as FC<any>, {})
    ) : (
      mergedImage
    )

  return h(
    'div',
    {
      ...rest,
      role,
      className: rootCls,
      style: rootStyle,
      'data-rue-empty': 'true',
      'data-rue-empty-align': align,
      'data-rue-empty-size': normalizedSize,
      'data-rue-empty-variant': variant,
    },
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-20 rounded-full bg-primary/10 blur-3xl"
      />

      <div
        className={appendClassName(
          `relative z-[1] flex ${resolveContentGapClass(normalizedSize)} w-full flex-col`,
          align === 'start' ? 'items-start' : 'items-center',
        )}
      >
        {hasImage ? (
          <div data-rue-empty-image="true" className={imageShellCls} style={imageShellStyle}>
            <>{imageNode}</>
          </div>
        ) : null}

        {hasDescription ? (
          <div
            data-rue-empty-description="true"
            className={descriptionCls}
            style={descriptionStyle}
          >
            <>{mergedDescription}</>
          </div>
        ) : null}

        {hasFooter ? (
          <div data-rue-empty-footer="true" className={footerCls} style={footerStyle}>
            <>{children}</>
          </div>
        ) : null}
      </div>
    </>,
  )
}) as EmptyType

Empty.PRESENTED_IMAGE_DEFAULT = DefaultPresentedImage
Empty.PRESENTED_IMAGE_SIMPLE = SimplePresentedImage

export {
  DefaultPresentedImage as PRESENTED_IMAGE_DEFAULT,
  SimplePresentedImage as PRESENTED_IMAGE_SIMPLE,
}
export default Empty
