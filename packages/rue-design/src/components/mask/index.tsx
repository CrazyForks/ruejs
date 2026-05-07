import type { FC } from '@rue-js/rue'

export type MaskShape =
  | 'squircle'
  | 'heart'
  | 'hexagon'
  | 'hexagon-2'
  | 'decagon'
  | 'pentagon'
  | 'diamond'
  | 'square'
  | 'circle'
  | 'star'
  | 'star-2'
  | 'triangle'
  | 'triangle-2'
  | 'triangle-3'
  | 'triangle-4'

export type MaskHalf = '1' | '2' | 'start' | 'end'
export type MaskSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | 'small'
  | 'middle'
  | 'medium'
  | 'large'
export type MaskFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
export type MaskPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
export type MaskTone =
  | 'base'
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export interface MaskProps {
  as?: string
  shape?: MaskShape
  half?: MaskHalf
  size?: MaskSize
  fit?: MaskFit
  position?: MaskPosition
  tone?: MaskTone
  bordered?: boolean
  ring?: boolean
  shadow?: boolean
  interactive?: boolean
  src?: string
  alt?: string
  imageProps?: Record<string, any>
  wrapperClassName?: string
  imageClassName?: string
  content?: any
  contentClassName?: string
  caption?: any
  captionClassName?: string
  className?: string
  children?: any
  [key: string]: any
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const resolveHalf = (half?: MaskHalf) => {
  if (!half) return undefined
  return half === 'start' ? '1' : half === 'end' ? '2' : half
}

const resolveSizeClass = (size?: MaskSize) => {
  switch (size) {
    case 'xs':
      return 'size-12'
    case 'sm':
    case 'small':
      return 'size-16'
    case 'md':
    case 'middle':
    case 'medium':
      return 'size-24'
    case 'lg':
    case 'large':
      return 'size-32'
    case 'xl':
      return 'size-40'
    case '2xl':
      return 'size-52'
    case '3xl':
      return 'size-64'
    default:
      return undefined
  }
}

const resolvePositionClass = (position?: MaskPosition) => {
  switch (position) {
    case 'top':
      return 'object-top'
    case 'bottom':
      return 'object-bottom'
    case 'left':
      return 'object-left'
    case 'right':
      return 'object-right'
    case 'top-left':
      return 'object-left-top'
    case 'top-right':
      return 'object-right-top'
    case 'bottom-left':
      return 'object-left-bottom'
    case 'bottom-right':
      return 'object-right-bottom'
    case 'center':
    default:
      return position ? 'object-center' : undefined
  }
}

const resolveFitClass = (fit?: MaskFit) => {
  switch (fit) {
    case 'contain':
      return 'object-contain'
    case 'fill':
      return 'object-fill'
    case 'none':
      return 'object-none'
    case 'scale-down':
      return 'object-scale-down'
    case 'cover':
    default:
      return fit ? 'object-cover' : undefined
  }
}

const resolveToneClass = (tone?: MaskTone) => {
  switch (tone) {
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
    case 'base':
      return 'bg-base-200 text-base-content'
    default:
      return undefined
  }
}

const resolveRingClass = (tone?: MaskTone) => {
  switch (tone) {
    case 'neutral':
      return 'ring-neutral/35'
    case 'primary':
      return 'ring-primary/35'
    case 'secondary':
      return 'ring-secondary/35'
    case 'accent':
      return 'ring-accent/35'
    case 'info':
      return 'ring-info/35'
    case 'success':
      return 'ring-success/35'
    case 'warning':
      return 'ring-warning/35'
    case 'error':
      return 'ring-error/35'
    default:
      return 'ring-base-300'
  }
}

const buildMaskClassName = ({
  shape,
  half,
  size,
  fit,
  position,
  tone,
  bordered,
  ring,
  shadow,
  interactive,
}: Pick<
  MaskProps,
  | 'shape'
  | 'half'
  | 'size'
  | 'fit'
  | 'position'
  | 'tone'
  | 'bordered'
  | 'ring'
  | 'shadow'
  | 'interactive'
>) => {
  let cls = `mask mask-${shape ?? 'squircle'}`
  const resolvedHalf = resolveHalf(half)
  const sizeClass = resolveSizeClass(size)
  const fitClass = resolveFitClass(fit as MaskFit | undefined)
  const positionClass = resolvePositionClass(position)
  const toneClass = resolveToneClass(tone)

  if (resolvedHalf) cls += ` mask-half-${resolvedHalf}`
  if (sizeClass) cls += ` ${sizeClass}`
  if (fitClass) cls += ` ${fitClass}`
  if (positionClass) cls += ` ${positionClass}`
  if (toneClass) cls += ` ${toneClass}`
  if (bordered) cls += ' ring-1 ring-inset ring-base-300/80'
  if (ring) cls += ` ring-2 ring-offset-2 ring-offset-base-100 ${resolveRingClass(tone)}`
  if (shadow) cls += ' shadow-xl shadow-base-content/10'
  if (interactive) cls += ' transition duration-200 ease-out hover:-translate-y-1 hover:shadow-2xl'

  return cls
}

const Mask: FC<MaskProps> = ({
  as = 'img',
  shape = 'squircle',
  half,
  size,
  fit = 'cover',
  position,
  tone,
  bordered,
  ring,
  shadow,
  interactive,
  src,
  alt,
  imageProps,
  wrapperClassName,
  imageClassName,
  content,
  contentClassName,
  caption,
  captionClassName,
  className,
  children,
  ...rest
}) => {
  const cls = buildMaskClassName({
    shape,
    half,
    size,
    fit,
    position,
    tone,
    bordered,
    ring,
    shadow,
    interactive,
  })
  const contentNode = content ?? children
  const mediaMode =
    !!src &&
    (contentNode != null ||
      caption != null ||
      wrapperClassName != null ||
      imageClassName != null ||
      contentClassName != null ||
      captionClassName != null ||
      as === 'figure')

  if (mediaMode) {
    const Wrapper = (as === 'img' ? 'figure' : as) as any
    const CaptionTag = (Wrapper === 'figure' ? 'figcaption' : 'div') as any

    return (
      <Wrapper
        {...rest}
        className={mergeClassName('relative inline-flex flex-col items-center gap-3', wrapperClassName)}
      >
        <div className="relative inline-flex">
          <img
            {...imageProps}
            src={src}
            alt={alt}
            className={mergeClassName(mergeClassName(cls, className), imageClassName)}
          />
          {contentNode != null ? (
            <div
              className={mergeClassName(
                'absolute inset-0 grid place-items-center p-4 text-center',
                contentClassName,
              )}
            >
              {contentNode}
            </div>
          ) : null}
        </div>
        {caption != null ? (
          <CaptionTag className={mergeClassName('text-center text-sm opacity-70', captionClassName)}>
            {caption}
          </CaptionTag>
        ) : null}
      </Wrapper>
    )
  }

  const Component = as as any

  return (
    <Component {...rest} src={src} alt={alt} className={mergeClassName(cls, className)}>
      {children}
    </Component>
  )
}

export default Mask
