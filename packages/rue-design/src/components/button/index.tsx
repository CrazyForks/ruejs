/*
Button 组件概述
- 提供语义化按钮 API，内部仍映射到 rue 当前的 btn 系列视觉类。
- 默认输出 button；当传入 href 或 as='a' 时输出 a，保留一致的交互和禁用语义。
- 组件仅保留当前推荐 API，不再承载旧版兼容分支。
*/
import type { FC } from '@rue-js/rue'

export type ButtonTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type ButtonColor = 'default' | 'danger' | ButtonTone
export type ButtonType = 'solid' | 'filled' | 'outlined' | 'dashed' | 'text' | 'link'
export type ButtonVariant = ButtonType
export type ButtonVisualVariant = ButtonType
export type ButtonShape = 'default' | 'square' | 'circle' | 'round'
export type ButtonSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'small'
  | 'medium'
  | 'middle'
  | 'large'
export type ButtonHTMLType = 'button' | 'submit' | 'reset'
export type ButtonIconPlacement = 'start' | 'end'

export interface ButtonLoadingConfig {
  delay?: number
  icon?: any
}

export interface ButtonProps {
  as?: 'button' | 'a' | 'div'
  type?: ButtonType
  htmlType?: ButtonHTMLType
  color?: ButtonColor
  shape?: ButtonShape
  size?: ButtonSize
  icon?: any
  iconPlacement?: ButtonIconPlacement
  loading?: boolean | ButtonLoadingConfig
  disabled?: boolean
  danger?: boolean
  active?: boolean
  block?: boolean
  wide?: boolean
  className?: string
  href?: string
  target?: string
  rel?: string
  onClick?: (e: MouseEvent) => void
  children?: any
  [key: string]: any
}

interface NormalizedLoadingConfig {
  active: boolean
  delay: number
  icon?: any
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const hasRenderableContent = (value: any): boolean => {
  if (value === undefined || value === null || value === false || value === '') return false
  if (Array.isArray(value)) return value.some(item => hasRenderableContent(item))
  return true
}

/**
 * 归一化尺寸别名，保留一组更顺手的语义名称，最终仍落到 daisyUI 的尺寸类。
 */
const resolveSizeClass = (size?: ButtonSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'medium':
    case 'middle':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

/** Loading 图标尺寸略小于按钮本体，避免视觉重心过高。 */
const resolveLoadingSizeClass = (size?: ButtonSize) => {
  const resolved = resolveSizeClass(size)
  switch (resolved) {
    case 'xs':
    case 'sm':
      return 'loading-xs'
    case 'lg':
      return 'loading-md'
    case 'xl':
      return 'loading-lg'
    default:
      return 'loading-sm'
  }
}

/**
 * type 直接承载视觉类型；颜色层由 color 单独控制。
 */
const resolveTypePreset = (type?: ButtonType) => {
  switch (type) {
    case 'outlined':
      return { outline: true, dash: false, soft: false, ghost: false, link: false }
    case 'dashed':
      return { outline: false, dash: true, soft: false, ghost: false, link: false }
    case 'filled':
      return { outline: false, dash: false, soft: true, ghost: false, link: false }
    case 'text':
      return { outline: false, dash: false, soft: false, ghost: true, link: false }
    case 'link':
      return { outline: false, dash: false, soft: false, ghost: false, link: true }
    default:
      return { outline: false, dash: false, soft: false, ghost: false, link: false }
  }
}

/** 标准化 loading 配置，支持 boolean 与对象两种写法。 */
const normalizeLoading = (loading?: boolean | ButtonLoadingConfig): NormalizedLoadingConfig => {
  if (!loading) {
    return { active: false, delay: 0 }
  }
  if (typeof loading === 'object') {
    return {
      active: true,
      delay: typeof loading.delay === 'number' && loading.delay > 0 ? loading.delay : 0,
      icon: loading.icon,
    }
  }
  return { active: true, delay: 0 }
}

/** 默认 loading 图标。 */
const DefaultLoadingIcon: FC<{ size?: ButtonSize }> = ({ size }) => {
  return <span className={`loading loading-spinner ${resolveLoadingSizeClass(size)}`.trim()} />
}

const Button: FC<ButtonProps> = ({
  as,
  type,
  htmlType,
  color,
  shape = 'default',
  size,
  icon,
  iconPlacement = 'start',
  loading,
  disabled,
  danger,
  active,
  block,
  wide,
  className,
  href,
  target,
  rel,
  onClick,
  children,
  ...rest
}) => {
  const typePreset = resolveTypePreset(type)
  const mergedColor: ButtonColor = color ?? (danger ? 'danger' : 'default')
  const mergedSize = resolveSizeClass(size)
  const normalizedLoading = normalizeLoading(loading)
  const mergedDisabled = !!disabled || normalizedLoading.active
  const renderAs = as ?? (href ? 'a' : 'button')
  const loadingVisible = normalizedLoading.active
  const iconNode = loadingVisible
    ? normalizedLoading.icon ?? <DefaultLoadingIcon size={size} />
    : icon
  const hasIcon = iconNode != null
  const hasChildren = hasRenderableContent(children)

  let cls = 'btn'
  if (mergedColor !== 'default') {
    cls += ` btn-${mergedColor === 'danger' ? 'error' : mergedColor}`
  }
  if (mergedSize) cls += ` btn-${mergedSize}`
  if (typePreset.outline) cls += ' btn-outline'
  if (typePreset.dash) cls += ' btn-dash'
  if (typePreset.soft) cls += ' btn-soft'
  if (typePreset.ghost) cls += ' btn-ghost'
  if (typePreset.link) cls += ' btn-link'
  if (active) cls += ' btn-active'
  if (block) cls += ' btn-block'
  if (wide) cls += ' btn-wide'
  if (shape === 'square') cls += ' btn-square'
  if (shape === 'circle') cls += ' btn-circle'
  if (shape === 'round') cls += ' rounded-full'
  if (mergedDisabled && renderAs !== 'button') cls += ' btn-disabled'
  if (className) cls += ` ${className}`

  const mergedClassName = mergeClassName(cls, hasIcon && hasChildren ? 'gap-2' : undefined)

  const handleClick = (event: MouseEvent) => {
    if (mergedDisabled) {
      if (typeof (event as any).preventDefault === 'function') {
        ;(event as any).preventDefault()
      }
      if (typeof (event as any).stopPropagation === 'function') {
        ;(event as any).stopPropagation()
      }
      return
    }
    if (onClick) onClick(event)
  }

  if (renderAs === 'a') {
    const anchorRel = target === '_blank' && !rel ? 'noreferrer' : rel
    return (
      <a
        {...rest}
        href={mergedDisabled ? undefined : href}
        target={target}
        rel={anchorRel}
        role={href ? rest.role : rest.role ?? 'button'}
        className={mergedClassName}
        aria-disabled={mergedDisabled ? 'true' : undefined}
        aria-busy={loadingVisible ? 'true' : undefined}
        onClick={handleClick}
      >
        {iconPlacement === 'end' ? (
          <>
            {hasChildren ? <span>{children}</span> : null}
            {hasIcon ? (
              <span className="inline-flex items-center justify-center" aria-hidden={hasChildren ? 'true' : undefined}>
                {iconNode}
              </span>
            ) : null}
          </>
        ) : (
          <>
            {hasIcon ? (
              <span className="inline-flex items-center justify-center" aria-hidden={hasChildren ? 'true' : undefined}>
                {iconNode}
              </span>
            ) : null}
            {hasChildren ? <span>{children}</span> : null}
          </>
        )}
      </a>
    )
  }

  if (renderAs === 'div') {
    return (
      <div
        {...rest}
        role={rest.role ?? 'button'}
        tabIndex={rest.tabIndex ?? (mergedDisabled ? -1 : 0)}
        className={mergedClassName}
        aria-disabled={mergedDisabled ? 'true' : undefined}
        aria-busy={loadingVisible ? 'true' : undefined}
        onClick={handleClick}
      >
        {iconPlacement === 'end' ? (
          <>
            {hasChildren ? <span>{children}</span> : null}
            {hasIcon ? (
              <span className="inline-flex items-center justify-center" aria-hidden={hasChildren ? 'true' : undefined}>
                {iconNode}
              </span>
            ) : null}
          </>
        ) : (
          <>
            {hasIcon ? (
              <span className="inline-flex items-center justify-center" aria-hidden={hasChildren ? 'true' : undefined}>
                {iconNode}
              </span>
            ) : null}
            {hasChildren ? <span>{children}</span> : null}
          </>
        )}
      </div>
    )
  }

  return (
    <button
      {...rest}
      className={mergedClassName}
      disabled={mergedDisabled}
      type={htmlType ?? 'button'}
      aria-busy={loadingVisible ? 'true' : undefined}
      onClick={handleClick}
    >
      {iconPlacement === 'end' ? (
        <>
          {hasChildren ? <span>{children}</span> : null}
          {hasIcon ? (
            <span className="inline-flex items-center justify-center" aria-hidden={hasChildren ? 'true' : undefined}>
              {iconNode}
            </span>
          ) : null}
        </>
      ) : (
        <>
          {hasIcon ? (
            <span className="inline-flex items-center justify-center" aria-hidden={hasChildren ? 'true' : undefined}>
              {iconNode}
            </span>
          ) : null}
          {hasChildren ? <span>{children}</span> : null}
        </>
      )}
    </button>
  )
}

export default Button
