import type { FC } from '@rue-js/rue'

export type HeroTone =
  | 'default'
  | 'base-100'
  | 'base-200'
  | 'base-300'
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type HeroSize = 'sm' | 'md' | 'lg' | 'xl' | 'screen'
export type HeroContentLayout = 'inherit' | 'center' | 'split' | 'split-reverse'
export type HeroAlign = 'start' | 'center' | 'end'
export type HeroTextAlign = 'start' | 'center' | 'end'
export type HeroGap = 'sm' | 'md' | 'lg' | 'xl'
export type HeroTitleSize = 'sm' | 'md' | 'lg' | 'xl'
export type HeroDescriptionSize = 'sm' | 'md' | 'lg'
export type HeroOverlayTone =
  | 'default'
  | 'base-content'
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
export type HeroOverlayOpacity = 'soft' | 'medium' | 'strong' | number

interface HeroInlineStyle {
  [key: string]: string | number | undefined
}

interface HeroPartProps {
  as?: string
  className?: string
  children?: any
  style?: HeroInlineStyle
  [key: string]: any
}

export interface HeroProps extends HeroPartProps {
  tone?: HeroTone
  size?: HeroSize
  fullHeight?: boolean
  backgroundImage?: string
  backgroundPosition?: string
  backgroundSize?: string
  backgroundRepeat?: string
  overlay?: boolean | HeroOverlayProps
}

export interface HeroContentProps extends HeroPartProps {
  layout?: HeroContentLayout
  align?: HeroAlign
  textAlign?: HeroTextAlign
  gap?: HeroGap
}

export interface HeroOverlayProps extends HeroPartProps {
  tone?: HeroOverlayTone
  opacity?: HeroOverlayOpacity
  blur?: boolean
}

export interface HeroTitleProps extends HeroPartProps {
  size?: HeroTitleSize
  balanced?: boolean
}

export interface HeroDescriptionProps extends HeroPartProps {
  size?: HeroDescriptionSize
  muted?: boolean
}

export interface HeroActionsProps extends HeroPartProps {
  align?: HeroAlign
  direction?: 'row' | 'column'
  stackOnMobile?: boolean
}

const heroToneClassMap: Record<Exclude<HeroTone, 'default'>, string> = {
  'base-100': 'bg-base-100 text-base-content',
  'base-200': 'bg-base-200 text-base-content',
  'base-300': 'bg-base-300 text-base-content',
  neutral: 'bg-neutral text-neutral-content',
  primary: 'bg-primary text-primary-content',
  secondary: 'bg-secondary text-secondary-content',
  accent: 'bg-accent text-accent-content',
  info: 'bg-info text-info-content',
  success: 'bg-success text-success-content',
  warning: 'bg-warning text-warning-content',
  error: 'bg-error text-error-content',
}

const heroSizeClassMap: Record<HeroSize, string> = {
  sm: 'min-h-80',
  md: 'min-h-96',
  lg: 'min-h-[30rem]',
  xl: 'min-h-[36rem]',
  screen: 'min-h-screen',
}

const heroContentLayoutClassMap: Record<Exclude<HeroContentLayout, 'inherit'>, string> = {
  center: 'text-center',
  split: 'flex-col gap-10 lg:flex-row',
  'split-reverse': 'flex-col gap-10 lg:flex-row-reverse',
}

const heroAlignClassMap: Record<HeroAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
}

const heroTextAlignClassMap: Record<HeroTextAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
}

const heroGapClassMap: Record<HeroGap, string> = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-10',
  xl: 'gap-14',
}

const heroOverlayToneClassMap: Record<Exclude<HeroOverlayTone, 'default'>, string> = {
  'base-content': 'bg-base-content',
  neutral: 'bg-neutral',
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  accent: 'bg-accent',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
}

const heroTitleSizeClassMap: Record<HeroTitleSize, string> = {
  sm: 'text-3xl md:text-4xl',
  md: 'text-4xl md:text-5xl',
  lg: 'text-5xl md:text-6xl',
  xl: 'text-6xl md:text-7xl',
}

const heroDescriptionSizeClassMap: Record<HeroDescriptionSize, string> = {
  sm: 'text-sm md:text-base',
  md: 'text-base md:text-lg',
  lg: 'text-lg md:text-xl',
}

const joinClassName = (...classNames: Array<string | false | null | undefined>) => {
  return classNames.filter(Boolean).join(' ')
}

const mergeStyle = (base?: HeroInlineStyle, extra?: HeroInlineStyle) => {
  if (!base && !extra) {
    return undefined
  }
  return {
    ...(base ?? {}),
    ...(extra ?? {}),
  }
}

const resolveOverlayProps = (overlay?: boolean | HeroOverlayProps) => {
  if (!overlay) {
    return undefined
  }
  if (overlay === true) {
    return {}
  }
  return overlay
}

const resolveOverlayOpacityStyle = (opacity?: HeroOverlayOpacity) => {
  if (opacity == null) {
    return undefined
  }
  if (typeof opacity === 'number') {
    return { opacity }
  }
  switch (opacity) {
    case 'soft':
      return { opacity: 0.25 }
    case 'strong':
      return { opacity: 0.7 }
    default:
      return { opacity: 0.45 }
  }
}

const resolveHeroBackgroundStyle = ({
  backgroundImage,
  backgroundPosition,
  backgroundSize,
  backgroundRepeat,
}: Pick<HeroProps, 'backgroundImage' | 'backgroundPosition' | 'backgroundSize' | 'backgroundRepeat'>) => {
  if (!backgroundImage) {
    return undefined
  }

  return {
    backgroundImage: `url(${backgroundImage})`,
    backgroundPosition: backgroundPosition ?? 'center',
    backgroundSize: backgroundSize ?? 'cover',
    backgroundRepeat: backgroundRepeat ?? 'no-repeat',
  }
}

const resolveActionsAlignmentClass = (
  align: HeroAlign | undefined,
  direction: 'row' | 'column',
  stackOnMobile: boolean,
) => {
  if (!align) {
    return undefined
  }

  if (stackOnMobile) {
    switch (align) {
      case 'center':
        return 'items-center sm:justify-center'
      case 'end':
        return 'items-end sm:justify-end'
      default:
        return 'items-start sm:justify-start'
    }
  }

  if (direction === 'column') {
    switch (align) {
      case 'center':
        return 'items-center'
      case 'end':
        return 'items-end'
      default:
        return 'items-start'
    }
  }

  switch (align) {
    case 'center':
      return 'justify-center'
    case 'end':
      return 'justify-end'
    default:
      return 'justify-start'
  }
}

const Hero: FC<HeroProps> = ({
  as = 'div',
  className,
  children,
  style,
  tone = 'default',
  size,
  fullHeight,
  backgroundImage,
  backgroundPosition,
  backgroundSize,
  backgroundRepeat,
  overlay,
  ...rest
}) => {
  const Component = as as any
  const backgroundStyle = resolveHeroBackgroundStyle({
    backgroundImage,
    backgroundPosition,
    backgroundSize,
    backgroundRepeat,
  })
  const overlayProps = resolveOverlayProps(overlay)

  return (
    <Component
      {...rest}
      style={mergeStyle(style, backgroundStyle)}
      className={joinClassName(
        'hero',
        tone !== 'default' ? heroToneClassMap[tone] : undefined,
        fullHeight ? heroSizeClassMap.screen : size ? heroSizeClassMap[size] : undefined,
        className,
      )}
    >
      {overlayProps ? <Overlay {...overlayProps} /> : null}
      {children}
    </Component>
  )
}

const Content: FC<HeroContentProps> = ({
  as = 'div',
  className,
  children,
  layout = 'inherit',
  align,
  textAlign,
  gap,
  ...rest
}) => {
  const Component = as as any

  return (
    <Component
      {...rest}
      className={joinClassName(
        'hero-content',
        layout !== 'inherit' ? heroContentLayoutClassMap[layout] : undefined,
        align ? heroAlignClassMap[align] : undefined,
        textAlign ? heroTextAlignClassMap[textAlign] : undefined,
        gap ? heroGapClassMap[gap] : undefined,
        className,
      )}
    >
      {children}
    </Component>
  )
}

const Overlay: FC<HeroOverlayProps> = ({
  as = 'div',
  className,
  children,
  tone = 'default',
  opacity,
  blur,
  style,
  ...rest
}) => {
  const Component = as as any

  return (
    <Component
      {...rest}
      style={mergeStyle(style, resolveOverlayOpacityStyle(opacity))}
      className={joinClassName(
        'hero-overlay',
        tone !== 'default' ? heroOverlayToneClassMap[tone] : undefined,
        blur ? 'backdrop-blur-sm' : undefined,
        className,
      )}
    >
      {children}
    </Component>
  )
}

const Title: FC<HeroTitleProps> = ({
  as = 'h1',
  className,
  children,
  size = 'lg',
  balanced = true,
  ...rest
}) => {
  const Component = as as any

  return (
    <Component
      {...rest}
      className={joinClassName('font-bold tracking-tight', heroTitleSizeClassMap[size], balanced ? 'text-balance' : undefined, className)}
    >
      {children}
    </Component>
  )
}

const Description: FC<HeroDescriptionProps> = ({
  as = 'p',
  className,
  children,
  size = 'md',
  muted = true,
  ...rest
}) => {
  const Component = as as any

  return (
    <Component
      {...rest}
      className={joinClassName(
        'max-w-2xl leading-relaxed',
        heroDescriptionSizeClassMap[size],
        muted ? 'opacity-80' : undefined,
        className,
      )}
    >
      {children}
    </Component>
  )
}

const Actions: FC<HeroActionsProps> = ({
  as = 'div',
  className,
  children,
  align,
  direction = 'row',
  stackOnMobile = false,
  ...rest
}) => {
  const Component = as as any

  return (
    <Component
      {...rest}
      className={joinClassName(
        'flex gap-3',
        stackOnMobile ? 'flex-col sm:flex-row sm:flex-wrap' : direction === 'column' ? 'flex-col' : 'flex-row flex-wrap',
        resolveActionsAlignmentClass(align, direction, stackOnMobile),
        className,
      )}
    >
      {children}
    </Component>
  )
}

type HeroCompound = FC<HeroProps> & {
  Content: FC<HeroContentProps>
  Overlay: FC<HeroOverlayProps>
  Title: FC<HeroTitleProps>
  Description: FC<HeroDescriptionProps>
  Actions: FC<HeroActionsProps>
}

const HeroCompound: HeroCompound = Object.assign(Hero, {
  Content,
  Overlay,
  Title,
  Description,
  Actions,
})

export default HeroCompound