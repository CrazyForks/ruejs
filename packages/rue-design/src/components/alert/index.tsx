/* RUE_VAPOR_TRANSFORMED */
/*
Alert 组件概述
- 在 daisyUI 的 alert 视觉基础上，补齐更完整的 Rue 语义 API。
- 兼容旧版 variant/outline/dash/soft 写法，并吸收 antd 常用的 type、message、description、closable 等能力。
- 组件默认保持轻量结构；只有在出现标题、描述、图标、操作区时才渲染增强布局。
*/
import type { FC } from '@rue-js/rue'

export type AlertTone = 'default' | 'info' | 'success' | 'warning' | 'error'
export type AlertType = Exclude<AlertTone, 'default'>
export type AlertDirection = 'vertical' | 'horizontal'

export interface AlertProps {
  type?: AlertType
  variant?: AlertType
  color?: AlertTone
  outline?: boolean
  dash?: boolean
  soft?: boolean
  direction?: AlertDirection
  title?: any
  message?: any
  description?: any
  showIcon?: boolean
  icon?: any
  banner?: boolean
  closable?: boolean
  closeText?: any
  closeIcon?: any
  action?: any
  onClose?: (event: MouseEvent) => void
  afterClose?: () => void
  role?: string
  className?: string
  children?: any
  [key: string]: any
}

interface GlyphIconProps {
  className?: string
}

const resolveTone = ({
  type,
  variant,
  color,
  banner,
}: Pick<AlertProps, 'type' | 'variant' | 'color' | 'banner'>) => {
  if (type) return type
  if (variant) return variant
  if (color && color !== 'default') return color
  if (banner) return 'warning'
  return undefined
}

const Alert: FC<AlertProps> = ({
  type,
  variant,
  color,
  outline,
  dash,
  soft,
  direction,
  title,
  message,
  description,
  showIcon,
  icon,
  banner,
  closable,
  closeText,
  closeIcon,
  action,
  onClose,
  afterClose,
  role = 'alert',
  className,
  children,
  ...rest
}) => {
  const resolvedTone = resolveTone({ type, variant, color, banner })
  const resolvedTitle = title ?? message
  const hasDescription = description != null
  const hasStructuredText = resolvedTitle != null || hasDescription
  const isClosable = closable ?? (closeText != null || closeIcon != null)
  const shouldShowIcon = showIcon ?? !!(banner || hasStructuredText)
  const contentAlignment = hasStructuredText ? 'items-start' : 'items-center'
  const plainContentClass = hasStructuredText
    ? 'min-w-0 flex-1'
    : 'min-w-0 flex flex-1 items-center gap-2'
  const actionAlignment = hasStructuredText ? 'items-start' : 'items-center'
  const alertRole = role ?? 'alert'
  const defaultIconGlyph =
    resolvedTone === 'success'
      ? '✓'
      : resolvedTone === 'warning'
        ? '!'
        : resolvedTone === 'error'
          ? '×'
          : 'i'

  let cls = 'alert'
  if (resolvedTone) cls += ` alert-${resolvedTone}`
  if (outline) cls += ' alert-outline'
  if (dash) cls += ' alert-dash'
  if (soft) cls += ' alert-soft'
  if (direction) cls += ` alert-${direction}`
  if (hasStructuredText || shouldShowIcon) cls += ` ${contentAlignment} gap-3`
  if (banner) cls += ' rounded-box border border-current/10'
  if (className) cls += ` ${className}`
  const actionGroup = action != null || isClosable
  const handleClose = (event: MouseEvent) => {
    const trigger = event.currentTarget as HTMLElement | null
    const element = trigger?.closest('[role="alert"]') as HTMLElement | null
    if (element) {
      element.setAttribute('hidden', 'true')
      element.remove()
    }
    if (onClose) onClose(event)
    if (afterClose) afterClose()
  }

  return (
    <div role={alertRole} className={cls} {...rest}>
      {shouldShowIcon ? (
        <span
          className="inline-flex size-5 shrink-0 self-center items-center justify-center rounded-full border border-current/15 text-[0.7rem] font-semibold"
          aria-hidden="true"
        >
          {icon ?? defaultIconGlyph}
        </span>
      ) : null}

      {hasStructuredText ? (
        <div className="min-w-0 flex-1">
          {resolvedTitle != null ? (
            <div className="font-semibold leading-6">{resolvedTitle}</div>
          ) : null}
          {hasDescription ? (
            <div className="mt-1 text-sm leading-6 opacity-80">{description}</div>
          ) : null}
          {children != null ? (
            <div className={hasDescription || resolvedTitle != null ? 'mt-3' : ''}>{children}</div>
          ) : null}
        </div>
      ) : (
        <div className={plainContentClass}>{children}</div>
      )}

      {actionGroup ? (
        <div
          className={`flex shrink-0 ${actionAlignment} gap-2${direction === 'vertical' ? ' w-full justify-end sm:w-auto' : ''}`}
        >
          {action}
          {isClosable ? (
            <button
              type="button"
              className={`btn btn-ghost btn-xs shrink-0 text-current/70 hover:text-current${closeText != null ? ' px-2' : ' btn-circle'}`}
              aria-label="Close alert"
              onClick={handleClose}
            >
              {closeText ?? closeIcon ?? '×'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default Alert
