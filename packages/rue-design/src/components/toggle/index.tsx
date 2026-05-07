/*
Toggle 组件概述
- 保留 Rue 当前的 toggle 视觉类，同时补齐 Switch 常见的受控/非受控、loading、状态文案能力。
- 当传入 checkedChildren / unCheckedChildren 或 children 时，组件会自动包一层语义容器，便于构建设置项一类的场景。
- `value` 与 `defaultValue` 在传入 boolean 时分别作为 `checked` 与 `defaultChecked` 的别名；传入 string / number 时仍保留原生 input 值语义。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'

export type ToggleColor =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'

export type ToggleSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'default' | 'medium'

export type ToggleValue = boolean | string | number

export interface ToggleProps {
  color?: ToggleColor
  size?: ToggleSize
  checked?: boolean
  defaultChecked?: boolean
  value?: ToggleValue
  defaultValue?: ToggleValue
  checkedChildren?: any
  unCheckedChildren?: any
  loading?: boolean
  disabled?: boolean
  className?: string
  rootClassName?: string
  contentClassName?: string
  stateClassName?: string
  style?: any
  rootStyle?: any
  children?: any
  onChange?: (checked: boolean, event: Event) => void
  onCheckedChange?: (checked: boolean, event: Event) => void
  onClick?: (checked: boolean, event: Event) => void
  onNativeChange?: (event: Event) => void
  [key: string]: any
}

const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const resolveSizeClass = (size?: ToggleSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'default':
    case 'medium':
      return 'md'
    default:
      return size
  }
}

const resolveLoadingSizeClass = (size?: ToggleSize) => {
  switch (resolveSizeClass(size)) {
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

const resolveControlledChecked = (checked?: boolean, value?: ToggleValue) => {
  if (typeof checked === 'boolean') return checked
  if (typeof value === 'boolean') return value
  return undefined
}

const resolveDefaultChecked = (
  defaultChecked?: boolean,
  defaultValue?: ToggleValue,
  fallback = false,
) => {
  if (typeof defaultChecked === 'boolean') return defaultChecked
  if (typeof defaultValue === 'boolean') return defaultValue
  return fallback
}

const resolveNativeValue = (value?: ToggleValue) => {
  return typeof value === 'boolean' ? undefined : value
}

const resolveNativeDefaultValue = (defaultValue?: ToggleValue) => {
  return typeof defaultValue === 'boolean' ? undefined : defaultValue
}

const buildInputClassName = (color?: ToggleColor, size?: ToggleSize, className?: string) => {
  let cls = 'toggle'
  if (color) cls += ` toggle-${color}`
  const resolvedSize = resolveSizeClass(size)
  if (resolvedSize) cls += ` toggle-${resolvedSize}`
  if (className) cls += ` ${className}`
  return cls
}

const buildRootClassName = (disabled?: boolean, rootClassName?: string) => {
  let cls = 'inline-flex max-w-full items-start gap-3 align-top text-base-content'
  if (disabled) cls += ' cursor-not-allowed opacity-65'
  else cls += ' cursor-pointer'
  if (rootClassName) cls += ` ${rootClassName}`
  return cls
}

const buildContentClassName = (contentClassName?: string) => {
  return appendClassName('flex min-w-0 flex-col gap-1 pt-0.5', contentClassName)
}

const buildStateClassName = (stateClassName?: string) => {
  return appendClassName('inline-flex items-center gap-2 text-xs text-base-content/60', stateClassName)
}

const Toggle: FC<ToggleProps> = ({
  color,
  size,
  checked,
  defaultChecked,
  value,
  defaultValue,
  checkedChildren,
  unCheckedChildren,
  loading,
  disabled,
  className,
  rootClassName,
  contentClassName,
  stateClassName,
  style,
  rootStyle,
  children,
  onChange,
  onCheckedChange,
  onClick,
  onNativeChange,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>()
  const controlledChecked = resolveControlledChecked(checked, value)
  const uncontrolledChecked = ref(
    resolveDefaultChecked(defaultChecked, defaultValue, controlledChecked ?? false),
  )
  const mergedDisabled = !!disabled || !!loading
  const hasStateSlot = checkedChildren != null || unCheckedChildren != null
  const currentChecked = controlledChecked ?? uncontrolledChecked.value
  const needsWrapper =
    !!loading ||
    children != null ||
    hasStateSlot ||
    !!rootClassName ||
    !!rootStyle ||
    !!contentClassName ||
    !!stateClassName

  const syncInputChecked = (nextChecked: boolean) => {
    if (inputRef.current) {
      inputRef.current.checked = nextChecked
    }
  }

  const syncStateSlot = (nextChecked: boolean) => {
    const root = inputRef.current?.closest('[data-rue-toggle-root="true"]') as HTMLElement | null
    const stateInput = root?.querySelector('[data-rue-toggle-state-input="true"]') as HTMLInputElement | null
    if (stateInput) {
      stateInput.checked = nextChecked
    }
  }

  const handleClick = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    onClick?.(target?.checked === true, event)
  }

  const handleChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    const nextChecked = target?.checked === true
    const visualChecked = controlledChecked === undefined ? nextChecked : controlledChecked

    if (controlledChecked === undefined) {
      uncontrolledChecked.value = nextChecked
    } else {
      syncInputChecked(controlledChecked)
    }

    syncStateSlot(visualChecked)

    onNativeChange?.(event)
    onChange?.(nextChecked, event)
    onCheckedChange?.(nextChecked, event)
  }

  onMounted(() => {
    syncInputChecked(controlledChecked ?? uncontrolledChecked.value)
    syncStateSlot(controlledChecked ?? uncontrolledChecked.value)
  })

  watch(
    () => resolveControlledChecked(checked, value),
    nextControlledChecked => {
      if (typeof nextControlledChecked === 'boolean') {
        uncontrolledChecked.value = nextControlledChecked
        syncInputChecked(nextControlledChecked)
        syncStateSlot(nextControlledChecked)
      }
    },
    { immediate: true },
  )

  const inputNode = (
    <input
      {...rest}
      ref={inputRef}
      type="checkbox"
      checked={controlledChecked}
      defaultChecked={resolveDefaultChecked(defaultChecked, defaultValue, currentChecked)}
      value={resolveNativeValue(value) as any}
      defaultValue={resolveNativeDefaultValue(defaultValue) as any}
      disabled={mergedDisabled}
      style={style}
      autoComplete={rest.autoComplete ?? 'off'}
      className={buildInputClassName(color, size, className)}
      aria-busy={loading ? 'true' : undefined}
      data-rue-toggle-input="true"
      onClick={handleClick}
      onChange={handleChange}
    />
  )

  if (!needsWrapper) {
    return inputNode
  }

  const switchNode = (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      {inputNode}
      {loading ? (
        <span className="pointer-events-none absolute inset-0 inline-flex items-center justify-center text-base-content/70">
          <span className={`loading loading-spinner ${resolveLoadingSizeClass(size)}`.trim()} />
        </span>
      ) : null}
    </span>
  )

  if (children == null && !hasStateSlot) {
    return <span className={appendClassName('inline-flex align-middle', rootClassName)} style={rootStyle}>{switchNode}</span>
  }

  return (
    <label className={buildRootClassName(mergedDisabled, rootClassName)} style={rootStyle} data-rue-toggle-root="true">
      {switchNode}
      <span className={buildContentClassName(contentClassName)}>
        {children != null ? <span className="text-sm font-medium text-base-content">{children}</span> : null}
        {hasStateSlot ? (
          <span className={buildStateClassName(stateClassName)}>
            <span className="swap pointer-events-none min-h-0 min-w-0">
              <input
                type="checkbox"
                checked={currentChecked}
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                data-rue-toggle-state-input="true"
              />
              <span className="swap-on inline-flex items-center gap-2">{checkedChildren}</span>
              <span className="swap-off inline-flex items-center gap-2">{unCheckedChildren}</span>
            </span>
          </span>
        ) : null}
      </span>
    </label>
  )
}

export default Toggle
