/* RUE_VAPOR_TRANSFORMED */
/*
Label 组件概述
- 保留 Rue 当前 input / select 包装与 floating-label 复合写法。
- 增强为字段级 API：label、description、help、error、required、prefix/suffix、status、size 等可直接组合。
- 默认仍输出轻量 label 壳；只有传入字段说明类 props 时才包一层字段布局。
*/
import type { FC } from '@rue-js/rue'

export type LabelControl = 'input' | 'select' | 'textarea' | 'none'
export type LabelTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
export type LabelColor = 'default' | LabelTone
export type LabelStatus = 'default' | 'success' | 'warning' | 'error'
export type LabelSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'
export type LabelVariant = 'outlined' | 'filled' | 'ghost' | 'borderless'
export type LabelLayout = 'stacked' | 'inline'
export type LabelAlign = 'start' | 'center' | 'end'
export type LabelRootAs = 'label' | 'div'
export type LabelTextTone = LabelTone | 'default' | 'muted'

export interface LabelRootProps {
  as?: LabelRootAs
  control?: LabelControl
  label?: any
  description?: any
  help?: any
  error?: any
  extra?: any
  optional?: any
  required?: boolean
  color?: LabelColor
  status?: LabelStatus
  size?: LabelSize
  variant?: LabelVariant
  ghost?: boolean
  disabled?: boolean
  block?: boolean
  layout?: LabelLayout
  align?: LabelAlign
  labelWidth?: string | number
  prefix?: any
  suffix?: any
  rootClassName?: string
  labelClassName?: string
  descriptionClassName?: string
  helpClassName?: string
  extraClassName?: string
  affixClassName?: string
  className?: string
  children?: any
  [key: string]: any
}

export interface LabelTextProps {
  tone?: LabelTextTone
  muted?: boolean
  strong?: boolean
  required?: boolean
  className?: string
  children?: any
  [key: string]: any
}

export interface LabelCaptionProps {
  required?: boolean
  optional?: any
  extra?: any
  className?: string
  textClassName?: string
  extraClassName?: string
  children?: any
  [key: string]: any
}

export interface LabelHelpProps {
  status?: LabelStatus
  className?: string
  children?: any
  [key: string]: any
}

export interface FloatingLabelProps {
  caption?: any
  text?: any
  description?: any
  help?: any
  error?: any
  extra?: any
  optional?: any
  required?: boolean
  status?: LabelStatus
  disabled?: boolean
  block?: boolean
  layout?: LabelLayout
  align?: LabelAlign
  labelWidth?: string | number
  rootClassName?: string
  captionClassName?: string
  textClassName?: string
  descriptionClassName?: string
  helpClassName?: string
  extraClassName?: string
  className?: string
  children?: any
  [key: string]: any
}

const labelSizeMap = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  small: 'sm',
  middle: 'md',
  medium: 'md',
  large: 'lg',
} as const

const mergeClassName = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

const hasNode = (value: any) => {
  return value !== undefined && value !== null && value !== false
}

const resolveSizeClass = (size?: LabelSize) => {
  return size ? labelSizeMap[size] : undefined
}

const resolveStatusTone = (status?: LabelStatus) => {
  switch (status) {
    case 'success':
    case 'warning':
    case 'error':
      return status
    default:
      return undefined
  }
}

const resolveControlBase = (control: LabelControl) => {
  return control === 'none' ? 'label' : control
}

const resolveVariantClassName = (base: string, variant?: LabelVariant, ghost?: boolean) => {
  const resolvedVariant = ghost ? 'ghost' : variant
  switch (resolvedVariant) {
    case 'filled':
      return 'bg-base-200/70 border-base-300 shadow-none focus-within:bg-base-100'
    case 'ghost':
      return `${base}-ghost`
    case 'borderless':
      return `${base}-ghost bg-transparent border-transparent shadow-none`
    default:
      return undefined
  }
}

const buildControlClassName = ({
  control = 'input',
  color,
  status,
  size,
  variant,
  ghost,
  disabled,
  block,
  className,
}: Pick<
  LabelRootProps,
  'control' | 'color' | 'status' | 'size' | 'variant' | 'ghost' | 'disabled' | 'block' | 'className'
>) => {
  const base = resolveControlBase(control)
  const resolvedSize = resolveSizeClass(size)
  const resolvedTone = color && color !== 'default' ? color : resolveStatusTone(status)
  const variantClassName =
    control === 'none' ? undefined : resolveVariantClassName(base, variant, ghost)

  let cls = base
  if (control !== 'none' && resolvedTone) cls += ` ${base}-${resolvedTone}`
  if (control !== 'none' && resolvedSize) cls += ` ${base}-${resolvedSize}`
  if (variantClassName) cls += ` ${variantClassName}`
  if (disabled) cls += ' opacity-60 cursor-not-allowed'
  if (block) cls += ' w-full'
  if (className) cls += ` ${className}`
  return cls
}

const resolveTextToneClassName = (tone?: LabelTextTone, muted?: boolean) => {
  if (muted || tone === 'muted') return 'opacity-60'
  switch (tone) {
    case 'neutral':
      return 'text-neutral'
    case 'primary':
      return 'text-primary'
    case 'secondary':
      return 'text-secondary'
    case 'accent':
      return 'text-accent'
    case 'info':
      return 'text-info'
    case 'success':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'error':
      return 'text-error'
    default:
      return undefined
  }
}

const buildFieldClassName = (layout?: LabelLayout, block?: boolean, className?: string) => {
  return mergeClassName(
    layout === 'inline'
      ? 'grid gap-2 sm:grid-cols-[var(--label-inline-width, minmax(8rem,12rem))_1fr]'
      : 'grid gap-1',
    block && 'w-full',
    className,
  )
}

const resolveInlineAlignClassName = (align?: LabelAlign) => {
  switch (align) {
    case 'center':
      return 'sm:items-center'
    case 'end':
      return 'sm:items-end'
    default:
      return 'sm:items-start'
  }
}

const resolveInlineWidthStyle = (layout?: LabelLayout, labelWidth?: string | number) => {
  if (layout !== 'inline' || labelWidth === undefined || labelWidth === null || labelWidth === '')
    return undefined
  return {
    '--label-inline-width': typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth,
  } as any
}

const buildHelpClassName = (status?: LabelStatus, className?: string) => {
  const tone = resolveStatusTone(status)
  return mergeClassName(
    'text-xs leading-relaxed',
    tone === 'success' && 'text-success',
    tone === 'warning' && 'text-warning',
    tone === 'error' && 'text-error',
    !tone && 'opacity-70',
    className,
  )
}

const RequiredMark: FC = () => {
  return (
    <span className="text-error" aria-hidden="true">
      *
    </span>
  )
}

const Text: FC<LabelTextProps> = ({
  tone,
  muted,
  strong,
  required,
  className,
  children,
  ...rest
}) => {
  return (
    <span
      {...rest}
      className={mergeClassName(
        'label',
        resolveTextToneClassName(tone, muted),
        strong && 'font-semibold',
        className,
      )}
    >
      {children}
      {required ? <RequiredMark /> : null}
    </span>
  )
}

const Caption: FC<LabelCaptionProps> = ({
  required,
  optional,
  extra,
  className,
  textClassName,
  extraClassName,
  children,
  ...rest
}) => {
  return (
    <div {...rest} className={mergeClassName('label px-0 pb-1', className)}>
      <span className={mergeClassName('inline-flex items-center gap-1 font-medium', textClassName)}>
        {children}
        {required ? <RequiredMark /> : null}
      </span>
      {hasNode(extra) || hasNode(optional) ? (
        <span className={mergeClassName('text-xs opacity-60', extraClassName)}>
          {hasNode(extra) ? extra : optional}
        </span>
      ) : null}
    </div>
  )
}

const Help: FC<LabelHelpProps> = ({ status, className, children, ...rest }) => {
  return (
    <div {...rest} className={buildHelpClassName(status, className)}>
      {children}
    </div>
  )
}

const renderCaption = ({
  label,
  required,
  optional,
  extra,
  labelClassName,
  extraClassName,
}: Pick<
  LabelRootProps,
  'label' | 'required' | 'optional' | 'extra' | 'labelClassName' | 'extraClassName'
>) => {
  if (!hasNode(label) && !required && !hasNode(optional) && !hasNode(extra)) return null
  return (
    <Caption
      required={required}
      optional={optional}
      extra={extra}
      textClassName={labelClassName}
      extraClassName={extraClassName}
    >
      {label}
    </Caption>
  )
}

const renderDescription = (description: any, className?: string) => {
  if (!hasNode(description)) return null
  return (
    <div className={mergeClassName('text-xs leading-relaxed opacity-70', className)}>
      {description}
    </div>
  )
}

const renderHelp = (help: any, error: any, status?: LabelStatus, className?: string) => {
  const content = hasNode(error) ? error : help
  if (!hasNode(content)) return null
  return (
    <Help status={hasNode(error) ? 'error' : status} className={className}>
      {content}
    </Help>
  )
}

const LabelRoot: FC<LabelRootProps> = ({
  as,
  control = 'input',
  label,
  description,
  help,
  error,
  extra,
  optional,
  required,
  color,
  status,
  size,
  variant,
  ghost,
  disabled,
  block,
  layout = 'stacked',
  align,
  labelWidth,
  prefix,
  suffix,
  rootClassName,
  labelClassName,
  descriptionClassName,
  helpClassName,
  extraClassName,
  affixClassName,
  className,
  children,
  ...rest
}) => {
  const resolvedStatus = status ?? (hasNode(error) ? 'error' : undefined)
  const Component = (as ?? 'label') as any
  const controlClassName = buildControlClassName({
    control,
    color,
    status: resolvedStatus,
    size,
    variant,
    ghost,
    disabled,
    block,
    className,
  })
  const hasFieldLayout =
    hasNode(label) ||
    hasNode(description) ||
    hasNode(help) ||
    hasNode(error) ||
    hasNode(extra) ||
    hasNode(optional) ||
    !!rootClassName ||
    layout === 'inline'
  const captionNode = renderCaption({
    label,
    required,
    optional,
    extra,
    labelClassName,
    extraClassName,
  })
  const descriptionNode = renderDescription(description, descriptionClassName)
  const helpNode = renderHelp(help, error, resolvedStatus, helpClassName)
  const fieldClassName = buildFieldClassName(layout, block, rootClassName)
  const fieldStyle = resolveInlineWidthStyle(layout, labelWidth)
  const controlNode = (
    <Component
      {...rest}
      className={controlClassName}
      aria-required={required ? 'true' : undefined}
      aria-invalid={resolvedStatus === 'error' ? 'true' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
    >
      {hasNode(prefix) ? (
        <span className={mergeClassName('label', affixClassName)}>{prefix}</span>
      ) : null}
      {children}
      {hasNode(suffix) ? (
        <span className={mergeClassName('label', affixClassName)}>{suffix}</span>
      ) : null}
    </Component>
  )

  if (!hasFieldLayout) return controlNode

  if (layout === 'inline') {
    return (
      <div
        className={mergeClassName(fieldClassName, resolveInlineAlignClassName(align))}
        style={fieldStyle}
      >
        <div>
          {captionNode}
          {descriptionNode}
        </div>
        <div className="grid gap-1">
          {controlNode}
          {helpNode}
        </div>
      </div>
    )
  }

  return (
    <div className={fieldClassName}>
      {captionNode}
      {descriptionNode}
      {controlNode}
      {helpNode}
    </div>
  )
}

const FloatingText: FC<LabelTextProps> = ({
  tone,
  muted,
  strong,
  required,
  className,
  children,
  ...rest
}) => {
  return (
    <span
      {...rest}
      className={mergeClassName(
        resolveTextToneClassName(tone, muted),
        strong && 'font-semibold',
        className,
      )}
    >
      {children}
      {required ? <RequiredMark /> : null}
    </span>
  )
}

const Floating: FC<FloatingLabelProps> = ({
  caption,
  text,
  description,
  help,
  error,
  extra,
  optional,
  required,
  status,
  disabled,
  block,
  layout = 'stacked',
  align,
  labelWidth,
  rootClassName,
  captionClassName,
  textClassName,
  descriptionClassName,
  helpClassName,
  extraClassName,
  className,
  children,
  ...rest
}) => {
  const resolvedStatus = status ?? (hasNode(error) ? 'error' : undefined)
  const hasFieldLayout =
    hasNode(caption) ||
    hasNode(description) ||
    hasNode(help) ||
    hasNode(error) ||
    hasNode(extra) ||
    hasNode(optional) ||
    !!rootClassName ||
    layout === 'inline'
  const captionNode = renderCaption({
    label: caption,
    required,
    optional,
    extra,
    labelClassName: captionClassName,
    extraClassName,
  })
  const descriptionNode = renderDescription(description, descriptionClassName)
  const helpNode = renderHelp(help, error, resolvedStatus, helpClassName)
  const fieldClassName = buildFieldClassName(layout, block, rootClassName)
  const fieldStyle = resolveInlineWidthStyle(layout, labelWidth)
  const floatingNode = (
    <label
      {...rest}
      className={mergeClassName(
        'floating-label',
        disabled && 'opacity-60 cursor-not-allowed',
        block && 'w-full',
        className,
      )}
      aria-required={required ? 'true' : undefined}
      aria-invalid={resolvedStatus === 'error' ? 'true' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
    >
      {children}
      {hasNode(text) ? (
        <FloatingText required={required} className={textClassName}>
          {text}
        </FloatingText>
      ) : null}
    </label>
  )

  if (!hasFieldLayout) return floatingNode

  if (layout === 'inline') {
    return (
      <div
        className={mergeClassName(fieldClassName, resolveInlineAlignClassName(align))}
        style={fieldStyle}
      >
        <div>
          {captionNode}
          {descriptionNode}
        </div>
        <div className="grid gap-1">
          {floatingNode}
          {helpNode}
        </div>
      </div>
    )
  }

  return (
    <div className={fieldClassName}>
      {captionNode}
      {descriptionNode}
      {floatingNode}
      {helpNode}
    </div>
  )
}

type LabelCompound = FC<LabelRootProps> & {
  Text: FC<LabelTextProps>
  Caption: FC<LabelCaptionProps>
  Help: FC<LabelHelpProps>
  Floating: FC<FloatingLabelProps>
  FloatingText: FC<LabelTextProps>
}

const LabelCompound: LabelCompound = Object.assign(LabelRoot, {
  Text,
  Caption,
  Help,
  Floating,
  FloatingText,
})

export default LabelCompound
