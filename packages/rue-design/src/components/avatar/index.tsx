/*
Avatar 组件概述
- 在保留 daisyUI 原子组合能力的前提下，补齐图片、图标、文字、尺寸、形状与失败回退等语义化 API。
- Avatar.Group 支持 children 或 items 两种组织方式，并提供 max 溢出聚合能力。
*/
import type { FC } from '@rue-js/rue'

export type AvatarStatus = 'online' | 'offline' | 'placeholder'
export type AvatarShape = 'circle' | 'square'
export type AvatarImageFit = 'cover' | 'contain'
export type AvatarColor =
  | 'base'
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
export type AvatarSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'small'
  | 'default'
  | 'medium'
  | 'middle'
  | 'large'
  | number

interface AvatarSizeConfig {
  className?: string
  pixels: number
  style?: Record<string, string>
}

export interface AvatarProps {
  status?: AvatarStatus
  className?: string
  bodyClassName?: string
  imgClassName?: string
  children?: any
  src?: any
  srcSet?: string
  alt?: string
  icon?: any
  text?: string
  shape?: AvatarShape
  size?: AvatarSize
  gap?: number
  color?: AvatarColor
  fit?: AvatarImageFit
  draggable?: boolean | 'true' | 'false'
  crossOrigin?: 'anonymous' | 'use-credentials' | ''
  onError?: (event: Event) => boolean | void
  [key: string]: any
}

export interface AvatarGroupItem extends AvatarProps {
  key?: string | number
}

export interface AvatarGroupMaxConfig {
  count?: number
  placeholder?: any
  className?: string
  bodyClassName?: string
}

export interface AvatarGroupProps {
  className?: string
  children?: any
  items?: ReadonlyArray<AvatarGroupItem>
  size?: AvatarSize
  shape?: AvatarShape
  max?: number | AvatarGroupMaxConfig
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const normalizeSize = (size?: AvatarSize): AvatarSize => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'default':
    case 'medium':
    case 'middle':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size ?? 'md'
  }
}

const resolveSizeConfig = (size?: AvatarSize): AvatarSizeConfig => {
  const normalized = normalizeSize(size)
  if (typeof normalized === 'number') {
    return {
      pixels: normalized,
      style: {
        width: `${normalized}px`,
        height: `${normalized}px`,
      },
    }
  }

  switch (normalized) {
    case 'xs':
      return { className: 'h-6 w-6 text-[10px]', pixels: 24 }
    case 'sm':
      return { className: 'h-8 w-8 text-xs', pixels: 32 }
    case 'lg':
      return { className: 'h-12 w-12 text-base', pixels: 48 }
    case 'xl':
      return { className: 'h-16 w-16 text-lg', pixels: 64 }
    default:
      return { className: 'h-10 w-10 text-sm', pixels: 40 }
  }
}

const resolveShapeClass = (shape?: AvatarShape) => {
  return shape === 'square' ? 'rounded-2xl' : 'rounded-full'
}

const resolveFitClass = (fit?: AvatarImageFit) => {
  return fit === 'contain' ? 'object-contain' : 'object-cover'
}

const resolveColorClasses = (color?: AvatarColor, preferPlaceholder?: boolean) => {
  switch (color) {
    case 'base':
      return 'bg-base-200 text-base-content'
    case 'neutral':
      return 'bg-neutral text-neutral-content'
    case 'primary':
      return 'bg-primary text-primary-content'
    case 'secondary':
      return 'bg-secondary text-secondary-content'
    case 'accent':
      return 'bg-accent text-accent-content'
    case 'info':
      return 'bg-info text-info-content'
    case 'success':
      return 'bg-success text-success-content'
    case 'warning':
      return 'bg-warning text-warning-content'
    case 'error':
      return 'bg-error text-error-content'
    default:
      return preferPlaceholder ? 'bg-neutral text-neutral-content' : 'bg-base-300 text-base-content'
  }
}

const toPrimitiveText = (value: any) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return undefined
}

const resolveTextFontSize = (content: string, avatarPixels: number, gap: number) => {
  const safeGap = Math.max(gap, 0)
  const estimated = (avatarPixels - safeGap * 2) / Math.max(content.length * 0.62, 1)
  return Math.max(10, Math.min(avatarPixels * 0.42, estimated))
}

const flattenChildren = (value: any) => {
  const result: any[] = []
  const walk = (item: any) => {
    if (Array.isArray(item)) {
      item.forEach(walk)
      return
    }
    if (item == null || item === false) {
      return
    }
    result.push(item)
  }

  walk(value)
  return result
}

const normalizeMax = (max?: number | AvatarGroupMaxConfig) => {
  if (typeof max === 'number') {
    return { count: max }
  }
  return max
}

const DefaultAvatarIcon: FC = () => {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[55%] w-[55%]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

/**
 * 语义模式负责生成可复用的头像骨架；纯 children 模式则继续兼容旧版 daisyUI 写法。
 */
const Avatar: FC<AvatarProps> = ({
  status,
  className,
  bodyClassName,
  imgClassName,
  children,
  src,
  srcSet,
  alt,
  icon,
  text,
  shape,
  size,
  gap = 4,
  color,
  fit,
  draggable,
  crossOrigin,
  onError,
  ...rest
}) => {
  const primitiveChildText = toPrimitiveText(children)
  const hasSemanticProps =
    src != null ||
    icon != null ||
    text != null ||
    shape != null ||
    size != null ||
    bodyClassName != null ||
    imgClassName != null ||
    alt != null ||
    srcSet != null ||
    color != null ||
    fit != null ||
    draggable !== undefined ||
    crossOrigin !== undefined ||
    onError != null
  const customBodyMode = !hasSemanticProps && primitiveChildText == null && children != null
  const sizeConfig = resolveSizeConfig(size)
  const textContent = text ?? primitiveChildText
  const fallbackContent = icon ?? (textContent ? null : children) ?? <DefaultAvatarIcon />
  const rootClassName = mergeClassName(
    status ? `avatar not-prose avatar-${status}` : 'avatar not-prose',
    className,
  )

  if (customBodyMode) {
    return (
      <div {...rest} className={rootClassName} data-rue-avatar-root="true">
        {children}
      </div>
    )
  }

  const hasStringImage = typeof src === 'string' && src.length > 0
  const hasCustomMediaNode = !hasStringImage && src != null
  const fallbackVisible = !hasStringImage && !hasCustomMediaNode
  const bodyClassNames = mergeClassName(
    mergeClassName(
      `relative inline-flex shrink-0 items-center justify-center overflow-hidden ${resolveShapeClass(shape)} ${resolveColorClasses(color, status === 'placeholder')}`,
      sizeConfig.className,
    ),
    bodyClassName,
  )
  const fallbackTextStyle =
    textContent != null
      ? {
          fontSize: `${resolveTextFontSize(textContent, sizeConfig.pixels, gap)}px`,
          lineHeight: '1',
        }
      : undefined

  const handleImageError = (event: Event) => {
    const shouldContinue = onError ? onError(event) : undefined
    if (shouldContinue === false) {
      return
    }

    const target = ((event as any).currentTarget ?? (event as any).target) as HTMLImageElement | null
    if (!target) {
      return
    }

    target.classList.add('hidden')
    const fallback = target.parentElement?.querySelector('[data-rue-avatar-fallback="true"]') as HTMLElement | null
    if (fallback) {
      fallback.classList.remove('hidden')
      fallback.classList.add('flex')
    }
  }

  return (
    <div {...rest} className={rootClassName} data-rue-avatar-root="true">
      <div className={bodyClassNames} data-rue-avatar-body="true" style={sizeConfig.style}>
        {hasStringImage ? (
          <img
            data-rue-avatar-image="true"
            className={mergeClassName(`h-full w-full ${resolveFitClass(fit)}`, imgClassName)}
            src={src}
            srcSet={srcSet}
            alt={alt ?? textContent ?? 'Avatar'}
            draggable={draggable ?? true}
            crossOrigin={crossOrigin}
            onError={handleImageError}
          />
        ) : null}
        {hasCustomMediaNode ? src : null}
        <span
          className={fallbackVisible ? 'flex h-full w-full items-center justify-center' : 'hidden h-full w-full items-center justify-center'}
          data-rue-avatar-fallback="true"
        >
          {textContent ? (
            <span className="inline-flex max-w-full items-center justify-center px-[0.08em] font-semibold uppercase tracking-[0.02em]" style={fallbackTextStyle}>
              {textContent}
            </span>
          ) : (
            fallbackContent
          )}
        </span>
      </div>
    </div>
  )
}

const Group: FC<AvatarGroupProps> = ({ className, children, items, size, shape, max }) => {
  const maxConfig = normalizeMax(max)
  const maxCount =
    maxConfig && typeof maxConfig.count === 'number' && maxConfig.count >= 0 ? Math.floor(maxConfig.count) : undefined
  const rootClassName = mergeClassName('avatar-group', className)

  if (items && items.length) {
    const hiddenCount = maxCount !== undefined && items.length > maxCount ? items.length - maxCount : 0
    const visibleItems = hiddenCount > 0 && maxCount !== undefined ? items.slice(0, maxCount) : items

    return (
      <div className={rootClassName} data-rue-avatar-group="true">
        {visibleItems.map((item, index) => {
          const { key, ...itemProps } = item
          return <Avatar key={key ?? index} size={item.size ?? size} shape={item.shape ?? shape} {...itemProps} />
        })}
        {hiddenCount > 0 ? (
          <Avatar
            status="placeholder"
            size={size}
            shape={shape}
            className={maxConfig?.className}
            bodyClassName={maxConfig?.bodyClassName}
          >
            {maxConfig?.placeholder ?? `+${hiddenCount}`}
          </Avatar>
        ) : null}
      </div>
    )
  }

  const childNodes = flattenChildren(children)
  const hiddenCount = maxCount !== undefined && childNodes.length > maxCount ? childNodes.length - maxCount : 0
  const visibleChildren = hiddenCount > 0 && maxCount !== undefined ? childNodes.slice(0, maxCount) : childNodes

  return (
    <div className={rootClassName} data-rue-avatar-group="true">
      {visibleChildren}
      {hiddenCount > 0 ? (
        <Avatar
          status="placeholder"
          size={size}
          shape={shape}
          className={maxConfig?.className}
          bodyClassName={maxConfig?.bodyClassName}
        >
          {maxConfig?.placeholder ?? `+${hiddenCount}`}
        </Avatar>
      ) : null}
    </div>
  )
}

type AvatarCompound = FC<AvatarProps> & {
  Group: FC<AvatarGroupProps>
}

const AvatarCompound: AvatarCompound = Object.assign(Avatar, {
  Group,
})

export default AvatarCompound
