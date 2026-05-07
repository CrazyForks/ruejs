import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'

type StyleValue = string | number | null | undefined

interface StyleObject {
  [key: string]: StyleValue
}

type DiffStyle = string | StyleObject

export interface DiffProps {
  className?: string
  style?: DiffStyle
  tabIndex?: number
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  item1?: any
  item2?: any
  item1Label?: any
  item2Label?: any
  resizerContent?: any
  children?: any
  onChange?: (value: number, event: Event) => void
  [key: string]: any
}

export interface DiffItemProps {
  className?: string
  style?: DiffStyle
  role?: string
  tabIndex?: number
  label?: any
  labelClassName?: string
  children?: any
  [key: string]: any
}

export interface DiffResizerProps {
  className?: string
  style?: DiffStyle
  children?: any
  [key: string]: any
}

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const serializeStyle = (style?: DiffStyle) => {
  if (!style) {
    return ''
  }
  if (typeof style === 'string') {
    return style.trim()
  }

  return Object.entries(style)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key.startsWith('--') ? key : toKebabCase(key)}:${String(value)}`)
    .join('; ')
}

const mergeStyle = (...styles: Array<DiffStyle | undefined>) => {
  return styles
    .map(style => serializeStyle(style))
    .filter(Boolean)
    .join('; ')
}

const diffRootLayoutStyle: StyleObject = {
  display: 'grid',
  justifyContent: 'normal',
  alignItems: 'stretch',
}

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

const toFiniteNumber = (value: any, fallback: number) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

const resolveBounds = (min?: number, max?: number) => {
  const resolvedMin = toFiniteNumber(min, 0)
  const resolvedMax = toFiniteNumber(max, 100)
  if (resolvedMax <= resolvedMin) {
    return { min: resolvedMin, max: resolvedMin + 1 }
  }
  return { min: resolvedMin, max: resolvedMax }
}

const resolveStep = (step?: number) => {
  const resolvedStep = toFiniteNumber(step, 1)
  return resolvedStep > 0 ? resolvedStep : 1
}

const resolveValue = (value: any, min: number, max: number, fallback: number) => {
  return clamp(toFiniteNumber(value, fallback), min, max)
}

const resolvePercent = (value: number, min: number, max: number) => {
  return ((value - min) / (max - min)) * 100
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const renderQuickItemContent = (content: any) => {
  return <div className="relative h-full [&>*]:h-full [&>*]:w-full [&>*]:max-w-none">{content}</div>
}

const hasRenderableChildren = (children: any) => {
  if (children == null) return false
  if (Array.isArray(children)) return children.length > 0
  return true
}

const assignForwardedRef = (forwardedRef: any, element: HTMLElement | null) => {
  if (typeof forwardedRef === 'function') {
    forwardedRef(element)
  } else if (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef) {
    forwardedRef.current = element ?? undefined
  }
}

const Item1: FC<DiffItemProps> = ({
  className,
  style,
  role,
  tabIndex,
  label,
  labelClassName,
  children,
  ...rest
}) => {
  const forwardedRef = rest.ref
  if ('ref' in rest) {
    delete rest.ref
  }
  const resolvedStyle = serializeStyle(style)
  const applyRef = (element: HTMLDivElement | null) => {
    if (element) {
      if (resolvedStyle) {
        element.setAttribute('style', resolvedStyle)
      } else {
        element.removeAttribute('style')
      }
    }
    assignForwardedRef(forwardedRef, element)
  }

  return (
    <div
      {...rest}
      ref={applyRef}
      className={mergeClassName('diff-item-1 relative', className)}
      role={role}
      tabIndex={tabIndex}
    >
      {label != null ? (
        <span
          className={mergeClassName(
            'pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-base-100/80 px-3 py-1 text-xs font-medium text-base-content shadow-sm backdrop-blur',
            labelClassName,
          )}
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  )
}

const Item2: FC<DiffItemProps> = ({
  className,
  style,
  role,
  tabIndex,
  label,
  labelClassName,
  children,
  ...rest
}) => {
  const forwardedRef = rest.ref
  if ('ref' in rest) {
    delete rest.ref
  }
  const resolvedStyle = serializeStyle(style)
  const applyRef = (element: HTMLDivElement | null) => {
    if (element) {
      if (resolvedStyle) {
        element.setAttribute('style', resolvedStyle)
      } else {
        element.removeAttribute('style')
      }
    }
    assignForwardedRef(forwardedRef, element)
  }

  return (
    <div
      {...rest}
      ref={applyRef}
      className={mergeClassName('diff-item-2 relative', className)}
      role={role}
      tabIndex={tabIndex}
    >
      {label != null ? (
        <span
          className={mergeClassName(
            'pointer-events-none absolute right-4 top-4 z-10 rounded-full bg-base-100/80 px-3 py-1 text-xs font-medium text-base-content shadow-sm backdrop-blur',
            labelClassName,
          )}
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  )
}

const Resizer: FC<DiffResizerProps> = ({ className, style, children, ...rest }) => {
  const forwardedRef = rest.ref
  if ('ref' in rest) {
    delete rest.ref
  }
  const resolvedStyle = serializeStyle(style)
  const applyRef = (element: HTMLDivElement | null) => {
    if (element) {
      if (resolvedStyle) {
        element.setAttribute('style', resolvedStyle)
      } else {
        element.removeAttribute('style')
      }
    }
    assignForwardedRef(forwardedRef, element)
  }

  return (
    <div
      {...rest}
      ref={applyRef}
      className={mergeClassName('diff-resizer', className)}
    >
      {children}
    </div>
  )
}

const Diff: FC<DiffProps> = ({
  className,
  style,
  tabIndex,
  value,
  defaultValue,
  min,
  max,
  step,
  disabled,
  item1,
  item2,
  item1Label,
  item2Label,
  resizerContent,
  children,
  onChange,
  ...rest
}) => {
  const forwardedRef = rest.ref
  if ('ref' in rest) {
    delete rest.ref
  }
  const bounds = resolveBounds(min, max)
  const rangeStep = resolveStep(step)
  const uncontrolledValue = ref(resolveValue(defaultValue ?? value ?? 50, bounds.min, bounds.max, 50))
  const controlled = value !== undefined
  const currentValue = controlled
    ? resolveValue(value, bounds.min, bounds.max, uncontrolledValue.value)
    : resolveValue(uncontrolledValue.value, bounds.min, bounds.max, 50)
  const percent = resolvePercent(currentValue, bounds.min, bounds.max)
  const quickMode = !hasRenderableChildren(children) && (item1 !== undefined || item2 !== undefined)
  const rootClassName = quickMode
    ? mergeClassName('diff relative isolate overflow-hidden select-none', className)
    : mergeClassName('diff', className)
  const rootStyle = mergeStyle(style, diffRootLayoutStyle)
  let item1Element: HTMLDivElement | null = null
  let item2Element: HTMLDivElement | null = null
  let resizerElement: HTMLDivElement | null = null
  let resizerContentElement: HTMLSpanElement | null = null
  let inputElement: HTMLInputElement | null = null

  const applyRootRef = (element: HTMLElement | null) => {
    if (element) {
      if (rootStyle) {
        element.setAttribute('style', rootStyle)
      } else {
        element.removeAttribute('style')
      }
    }
    assignForwardedRef(forwardedRef, element)
  }

  const syncQuickModeStyles = (nextValue: number) => {
    const nextPercent = resolvePercent(nextValue, bounds.min, bounds.max)
    if (item1Element) {
      item1Element.setAttribute(
        'style',
        serializeStyle({
          clipPath: `inset(0 ${100 - nextPercent}% 0 0)`,
        }),
      )
    }
    if (item2Element) {
      item2Element.setAttribute(
        'style',
        serializeStyle({
          clipPath: `inset(0 0 0 ${nextPercent}%)`,
        }),
      )
    }
    if (resizerElement) {
      resizerElement.setAttribute(
        'style',
        serializeStyle({
          left: `${nextPercent}%`,
          width: 0,
          minWidth: 0,
          maxWidth: 0,
          clipPath: 'none',
          overflow: 'visible',
          opacity: 1,
          resize: 'none',
          transform: 'translateX(-50%)',
        }),
      )
    }
    if (resizerContentElement) {
      resizerContentElement.style.left = `${nextPercent}%`
    }
    if (inputElement) {
      inputElement.setAttribute('aria-valuenow', String(nextValue))
      inputElement.value = String(nextValue)
    }
  }

  const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    const nextValue = resolveValue(target?.value, bounds.min, bounds.max, currentValue)
    if (!controlled) {
      uncontrolledValue.value = nextValue
    }
    syncQuickModeStyles(nextValue)
    if (onChange) {
      onChange(nextValue, event)
    }
  }

  if (!quickMode) {
    return (
      <figure
        {...rest}
        ref={applyRootRef}
        className={rootClassName}
        tabIndex={tabIndex}
        aria-disabled={disabled ? 'true' : undefined}
      >
        {children}
      </figure>
    )
  }

  const rangeAriaLabel = rest['aria-label'] ?? 'Diff position'

  return (
    <figure
      {...rest}
      ref={applyRootRef}
      className={rootClassName}
        tabIndex={undefined}
      aria-disabled={disabled ? 'true' : undefined}
    >
      <Item1
        className="absolute inset-0 z-10 overflow-hidden"
        role="img"
        ref={(element: HTMLDivElement | null) => {
          item1Element = element
          syncQuickModeStyles(currentValue)
        }}
      >
        {renderQuickItemContent(item1)}
      </Item1>
      <Item2
        className="absolute inset-0 overflow-hidden after:hidden"
        role="img"
        ref={(element: HTMLDivElement | null) => {
          item2Element = element
          syncQuickModeStyles(currentValue)
        }}
      >
        {renderQuickItemContent(item2)}
      </Item2>
      {item1Label != null ? (
        <span className="pointer-events-none absolute left-4 top-4 z-30 rounded-full bg-base-100/80 px-3 py-1 text-xs font-medium text-base-content shadow-sm backdrop-blur">
          {item1Label}
        </span>
      ) : null}
      {item2Label != null ? (
        <span className="pointer-events-none absolute right-4 top-4 z-30 rounded-full bg-base-100/80 px-3 py-1 text-xs font-medium text-base-content shadow-sm backdrop-blur">
          {item2Label}
        </span>
      ) : null}
      <Resizer
        className="pointer-events-none absolute inset-y-0 z-20"
        ref={(element: HTMLDivElement | null) => {
          resizerElement = element
          syncQuickModeStyles(currentValue)
        }}
        style={{
          left: `${percent}%`,
          width: 0,
          minWidth: 0,
          maxWidth: 0,
          clipPath: 'none',
          overflow: 'visible',
          opacity: 1,
          resize: 'none',
          transform: 'translateX(-50%)',
        }}
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-base-100 shadow-sm" />
      </Resizer>
      {resizerContent != null ? (
        <span
          ref={(element: HTMLSpanElement | null) => {
            resizerContentElement = element
            syncQuickModeStyles(currentValue)
          }}
          className="pointer-events-none absolute top-1/2 z-30 inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-base-300 bg-base-100/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-base-content shadow-sm backdrop-blur"
          style={{ left: `${percent}%` }}
        >
          {resizerContent}
        </span>
      ) : null}
      <input
        type="range"
        className="absolute inset-0 z-30 h-full w-full cursor-col-resize opacity-0 disabled:cursor-not-allowed"
        ref={(element: HTMLInputElement | null) => {
          inputElement = element
          syncQuickModeStyles(currentValue)
        }}
        min={String(bounds.min)}
        max={String(bounds.max)}
        step={String(rangeStep)}
        value={String(currentValue)}
        disabled={disabled}
        tabIndex={tabIndex}
        aria-label={rangeAriaLabel}
        aria-valuemin={String(bounds.min)}
        aria-valuemax={String(bounds.max)}
        aria-valuenow={String(currentValue)}
        onInput={handleInput}
        onChange={handleInput}
      />
    </figure>
  )
}

type DiffCompound = FC<DiffProps> & {
  Item1: FC<DiffItemProps>
  Item2: FC<DiffItemProps>
  Resizer: FC<DiffResizerProps>
}

const DiffCompound: DiffCompound = Object.assign(Diff, {
  Item1,
  Item2,
  Resizer,
})

export default DiffCompound
