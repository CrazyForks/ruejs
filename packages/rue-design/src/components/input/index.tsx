/* RUE_VAPOR_TRANSFORMED */
/*
Input 组件概述
- 在 Rue 现有 input 视觉基座上补齐更高层的语义 API：prefix/suffix、allowClear、showCount、状态与变体。
- 通过命名空间挂载 Search、Password、TextArea。
- 保留当前 Shell 入口，兼容文档里直接把 input 当作壳层容器使用的写法。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'
import Textarea, { type TextareaProps } from '../textarea'

export type InputTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type InputColor = 'default' | InputTone
export type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'
export type InputStatus = 'warning' | 'error'
export type InputVariant = 'outlined' | 'filled' | 'ghost' | 'borderless'

export interface InputShowCountInfo {
  value: string
  count: number
  maxLength?: number
}

export interface InputShowCountConfig {
  formatter?: (info: InputShowCountInfo) => any
}

export interface InputAllowClearConfig {
  clearIcon?: any
}

export interface InputProps {
  color?: InputColor
  size?: InputSize
  status?: InputStatus
  variant?: InputVariant
  ghost?: boolean
  type?: string
  prefix?: any
  suffix?: any
  addonBefore?: any
  addonAfter?: any
  addonBeforeBare?: boolean
  addonAfterBare?: boolean
  showCount?: boolean | InputShowCountConfig
  allowClear?: boolean | InputAllowClearConfig
  rootClassName?: string
  inputClassName?: string
  countClassName?: string
  clearButtonClassName?: string
  className?: string
  disabled?: boolean
  readOnly?: boolean
  value?: string | number
  defaultValue?: string | number
  onClear?: (event: MouseEvent) => void
  onInput?: (event: Event) => void
  onChange?: (event: Event) => void
  onKeyDown?: (event: KeyboardEvent) => void
  onPressEnter?: (event: KeyboardEvent) => void
  [key: string]: any
}

export interface InputShellProps {
  as?: string
  color?: InputColor
  status?: InputStatus
  size?: InputSize
  variant?: InputVariant
  ghost?: boolean
  className?: string
  children?: any
  [key: string]: any
}

export interface SearchInfo {
  source: 'input' | 'clear'
}

export interface SearchProps extends InputProps {
  enterButton?: boolean | any
  loading?: boolean
  buttonClassName?: string
  onSearch?: (value: string, event: MouseEvent | KeyboardEvent, info: SearchInfo) => void
}

export interface PasswordVisibilityToggle {
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
}

export interface PasswordProps extends Omit<InputProps, 'type'> {
  iconRender?: (visible: boolean) => any
  visibilityToggle?: boolean | PasswordVisibilityToggle
}

const mergeClassName = (...classNames: Array<string | undefined | false | null>) => {
  return classNames.filter(Boolean).join(' ')
}

const resolveInputValue = (value?: string | number) => {
  if (value == null) return ''
  return String(value)
}

const resolveSizeClass = (size?: InputSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'middle':
    case 'medium':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

const resolveStatusTone = (status?: InputStatus) => {
  switch (status) {
    case 'warning':
      return 'warning' as InputTone
    case 'error':
      return 'error' as InputTone
    default:
      return undefined
  }
}

const resolveVariantClassName = (variant?: InputVariant, ghost?: boolean) => {
  const resolvedVariant = ghost ? 'ghost' : variant
  switch (resolvedVariant) {
    case 'filled':
      return 'border-transparent bg-base-200/70 shadow-none focus-within:bg-base-100'
    case 'borderless':
      return 'input-ghost bg-transparent border-transparent shadow-none'
    case 'ghost':
      return 'input-ghost'
    default:
      return undefined
  }
}

const buildClassName = ({
  color,
  status,
  size,
  variant,
  ghost,
  className,
  shell,
}: {
  color?: InputColor
  status?: InputStatus
  size?: InputSize
  variant?: InputVariant
  ghost?: boolean
  className?: string
  shell?: boolean
}) => {
  let cls = 'input'
  const resolvedTone = color && color !== 'default' ? color : resolveStatusTone(status)
  const resolvedSize = resolveSizeClass(size)
  const variantClassName = resolveVariantClassName(variant, ghost)

  if (resolvedTone) cls += ` input-${resolvedTone}`
  if (resolvedSize) cls += ` input-${resolvedSize}`
  if (variantClassName) cls += ` ${variantClassName}`
  if (shell) cls += ' flex items-center gap-2'
  if (className) cls += ` ${className}`
  return cls
}

const renderCountContent = (
  showCount: boolean | InputShowCountConfig | undefined,
  info: InputShowCountInfo,
) => {
  if (showCount && typeof showCount === 'object' && typeof showCount.formatter === 'function') {
    return showCount.formatter(info)
  }
  if (typeof info.maxLength === 'number') {
    return `${info.count} / ${info.maxLength}`
  }
  return String(info.count)
}

const stringifyContent = (content: any) => {
  if (content == null) return ''
  return typeof content === 'string' ? content : String(content)
}

const readMaxLength = (props: Record<string, any>) => {
  if (typeof props.maxLength === 'number') return props.maxLength
  if (typeof props.maxlength === 'number') return props.maxlength
  return undefined
}

const Addon: FC<{ children: any; className?: string }> = ({ children, className }) => {
  return (
    <span
      className={mergeClassName(
        'join-item inline-flex items-center border border-base-300 bg-base-200 px-3 text-sm text-base-content/65',
        className,
      )}
    >
      {children}
    </span>
  )
}

const DefaultClearIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 7 10 10M17 7 7 17" />
    </svg>
  )
}

const DefaultSearchIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
    </svg>
  )
}

const EyeOpenIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const EyeClosedIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.6 5.3A10.2 10.2 0 0 1 12 5.2c6 0 9.5 6 9.5 6a18.2 18.2 0 0 1-3.1 3.9"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.7 6.8C4.1 8.4 2.5 11.2 2.5 11.2s3.5 6 9.5 6c1.8 0 3.4-.5 4.8-1.2"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 9.8A3 3 0 0 0 14.2 14" />
    </svg>
  )
}

const InputRoot: FC<InputProps> = ({
  color,
  size,
  status,
  variant,
  ghost,
  type = 'text',
  prefix,
  suffix,
  addonBefore,
  addonAfter,
  addonBeforeBare,
  addonAfterBare,
  showCount,
  allowClear,
  rootClassName,
  inputClassName,
  countClassName,
  clearButtonClassName,
  className,
  disabled,
  readOnly,
  value,
  defaultValue,
  onClear,
  onInput,
  onChange,
  onKeyDown,
  onPressEnter,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>()
  let countElement: HTMLDivElement | null = null
  let clearButtonElement: HTMLButtonElement | null = null
  const forwardedRef = rest.ref
  const isControlled = value !== undefined
  const hasCount = !!showCount
  const clearable = !!allowClear
  const clearConfig = allowClear && typeof allowClear === 'object' ? allowClear : undefined
  const usesShell = prefix !== undefined || suffix !== undefined || clearable
  const usesAddonGroup = addonBefore !== undefined || addonAfter !== undefined
  const currentValue = ref(resolveInputValue(isControlled ? value : defaultValue))

  if ('ref' in rest) {
    delete rest.ref
  }

  const syncValueState = () => {
    currentValue.value = resolveInputValue(
      isControlled ? value : (inputRef.current?.value ?? defaultValue),
    )
  }

  const syncUncontrolledDefaultValue = () => {
    if (isControlled || defaultValue === undefined || !inputRef.current) return
    if (inputRef.current.value !== '') return
    inputRef.current.value = resolveInputValue(defaultValue)
  }

  const syncCountDisplay = () => {
    if (!countElement || !hasCount) return
    countElement.textContent = stringifyContent(
      renderCountContent(showCount, {
        value: currentValue.value,
        count: currentValue.value.length,
        maxLength: readMaxLength(rest),
      }),
    )
  }

  const syncClearButtonVisibility = () => {
    if (!clearButtonElement) return
    clearButtonElement.classList.toggle(
      'hidden',
      currentValue.value.length <= 0 || !!disabled || !!readOnly,
    )
  }

  const syncAffixes = () => {
    syncCountDisplay()
    syncClearButtonVisibility()
  }

  const assignRefs = (element: HTMLInputElement | null) => {
    inputRef.current = element ?? undefined
    if (typeof forwardedRef === 'function') {
      forwardedRef(element)
      return
    }
    if (forwardedRef && typeof forwardedRef === 'object') {
      ;(forwardedRef as any).current = element ?? undefined
    }
  }

  const triggerNativeChangeEvents = (element: HTMLInputElement) => {
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    currentValue.value = target?.value ?? ''
    syncAffixes()
    if (onInput) onInput(event)
  }

  const handleChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    currentValue.value = target?.value ?? ''
    syncAffixes()
    if (onChange) onChange(event)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (onKeyDown) onKeyDown(event)
    if ((event as any).key === 'Enter' && onPressEnter) {
      onPressEnter(event)
    }
  }

  const handleClear = (event: MouseEvent) => {
    const element = inputRef.current
    if (!element || disabled || readOnly) return

    if (typeof (event as any).preventDefault === 'function') {
      ;(event as any).preventDefault()
    }
    if (typeof (event as any).stopPropagation === 'function') {
      ;(event as any).stopPropagation()
    }

    element.value = ''
    currentValue.value = ''
    syncAffixes()
    element.focus()
    triggerNativeChangeEvents(element)
    if (onClear) onClear(event)
  }

  onMounted(() => {
    syncUncontrolledDefaultValue()
    syncValueState()
    syncAffixes()
  })

  watch(
    () => value,
    () => {
      if (isControlled && inputRef.current) {
        inputRef.current.value = resolveInputValue(value)
      }
      syncValueState()
      syncAffixes()
    },
    { immediate: true },
  )

  const nativeValueProps: Record<string, any> = {}
  if (value !== undefined) {
    nativeValueProps.value = value
  }
  if (defaultValue !== undefined) {
    nativeValueProps.defaultValue = defaultValue
  }
  const nativeReadOnlyProps: Record<string, any> = {}
  if (readOnly !== undefined) {
    nativeReadOnlyProps.readOnly = readOnly
  }
  const ariaInvalid = status === 'error' ? 'true' : rest['aria-invalid']
  if ('aria-invalid' in rest) {
    delete rest['aria-invalid']
  }
  const nativeAriaInvalidProps: Record<string, any> = {}
  if (ariaInvalid !== undefined && ariaInvalid !== null) {
    nativeAriaInvalidProps['aria-invalid'] = ariaInvalid
  }

  const rawInputNode = (
    <input
      {...rest}
      {...nativeValueProps}
      {...nativeReadOnlyProps}
      {...nativeAriaInvalidProps}
      ref={assignRefs}
      type={type}
      disabled={disabled}
      className={buildClassName({
        color,
        status,
        size,
        variant,
        ghost,
        className: mergeClassName(
          className,
          usesAddonGroup ? 'join-item min-w-0 flex-1' : undefined,
        ),
      })}
      onInput={handleInput}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  )

  const shellNode = usesShell ? (
    <label
      className={buildClassName({
        color,
        status,
        size,
        variant,
        ghost,
        shell: true,
        className: mergeClassName(
          className,
          usesAddonGroup ? 'join-item min-w-0 flex-1' : undefined,
        ),
      })}
      aria-disabled={disabled ? 'true' : undefined}
      data-rue-input-shell="true"
    >
      {prefix !== undefined ? (
        <span className="shrink-0 text-sm text-base-content/60">{prefix}</span>
      ) : null}
      <input
        {...rest}
        {...nativeValueProps}
        {...nativeReadOnlyProps}
        {...nativeAriaInvalidProps}
        ref={assignRefs}
        type={type}
        disabled={disabled}
        className={mergeClassName(
          'min-w-0 grow border-0 bg-transparent p-0 text-inherit outline-none placeholder:text-base-content/40',
          inputClassName,
        )}
        onInput={handleInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {clearable && !disabled && !readOnly ? (
        <button
          ref={(element: HTMLButtonElement | null) => {
            clearButtonElement = element
            syncClearButtonVisibility()
          }}
          type="button"
          tabIndex={-1}
          aria-label="Clear text"
          className={mergeClassName(
            'btn btn-ghost btn-xs btn-circle h-7 min-h-0 w-7 shrink-0 p-0 text-base-content/55 hover:text-base-content',
            currentValue.value.length > 0 ? undefined : 'hidden',
            clearButtonClassName,
          )}
          onClick={handleClear}
        >
          {clearConfig?.clearIcon ?? <DefaultClearIcon />}
        </button>
      ) : null}
      {suffix !== undefined ? (
        <span className="shrink-0 text-sm text-base-content/60">{suffix}</span>
      ) : null}
    </label>
  ) : null

  const controlNode = shellNode ?? rawInputNode

  const groupedControlNode = usesAddonGroup ? (
    <div className="join w-full items-stretch">
      {addonBefore !== undefined ? (
        addonBeforeBare ? (
          addonBefore
        ) : (
          <Addon>{addonBefore}</Addon>
        )
      ) : null}
      {controlNode}
      {addonAfter !== undefined ? addonAfterBare ? addonAfter : <Addon>{addonAfter}</Addon> : null}
    </div>
  ) : (
    controlNode
  )

  if (!hasCount && !rootClassName) {
    return groupedControlNode
  }

  return (
    <div
      className={mergeClassName(hasCount ? 'flex flex-col gap-2' : undefined, rootClassName)}
      data-rue-input-root="true"
    >
      {groupedControlNode}
      {hasCount ? (
        <div
          ref={(element: HTMLDivElement | null) => {
            countElement = element
            syncCountDisplay()
          }}
          className={mergeClassName(
            'flex justify-end text-xs leading-5 text-base-content/60',
            countClassName,
          )}
          data-rue-input-count="true"
        >
          {stringifyContent(
            renderCountContent(showCount, {
              value: currentValue.value,
              count: currentValue.value.length,
              maxLength: readMaxLength(rest),
            }),
          )}
        </div>
      ) : null}
    </div>
  )
}

const Shell: FC<InputShellProps> = ({
  as = 'label',
  color,
  status,
  size,
  variant,
  ghost,
  className,
  children,
  ...rest
}) => {
  const Component = as as any
  return (
    <Component
      {...rest}
      className={buildClassName({
        color,
        status,
        size,
        variant,
        ghost,
        shell: true,
        className,
      })}
    >
      {children}
    </Component>
  )
}

const Search: FC<SearchProps> = ({
  enterButton,
  loading,
  buttonClassName,
  onSearch,
  onPressEnter,
  onClear,
  suffix,
  addonAfter,
  disabled,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>()
  const actionContent = enterButton === true ? '搜索' : (enterButton ?? addonAfter)

  const triggerSearch = (event: MouseEvent | KeyboardEvent, source: SearchInfo['source']) => {
    if (disabled || loading) return
    if (onSearch) {
      onSearch(inputRef.current?.value ?? '', event, { source })
    }
  }

  const suffixButton = (
    <button
      type="button"
      aria-label="Search"
      className={mergeClassName('btn btn-ghost join-item', buttonClassName)}
      onClick={(event: MouseEvent) => triggerSearch(event, 'input')}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="loading loading-spinner loading-xs" aria-hidden="true" />
      ) : (
        <DefaultSearchIcon />
      )}
    </button>
  )

  const addonButton =
    actionContent !== undefined ? (
      <button
        type="button"
        className={mergeClassName('btn btn-primary join-item', buttonClassName)}
        onClick={(event: MouseEvent) => triggerSearch(event, 'input')}
        disabled={disabled || loading}
        aria-busy={loading ? 'true' : undefined}
      >
        {loading ? (
          <span className="loading loading-spinner loading-sm" aria-hidden="true" />
        ) : (
          actionContent
        )}
      </button>
    ) : null

  return (
    <InputRoot
      {...rest}
      ref={inputRef}
      type="text"
      disabled={disabled}
      suffix={suffix}
      addonAfter={actionContent === undefined ? suffixButton : addonButton}
      addonAfterBare={true}
      onClear={(event: MouseEvent) => {
        if (onClear) onClear(event)
        if (onSearch) {
          onSearch('', event, { source: 'clear' })
        }
      }}
      onPressEnter={event => {
        if (onPressEnter) onPressEnter(event)
        triggerSearch(event, 'input')
      }}
    />
  )
}

const Password: FC<PasswordProps> = ({ iconRender, visibilityToggle = true, suffix, ...rest }) => {
  const inputRef = useRef<HTMLInputElement>()
  const uncontrolledVisible = ref(false)
  const visibilityConfig =
    visibilityToggle && typeof visibilityToggle === 'object' ? visibilityToggle : undefined
  const isControlled = visibilityConfig?.visible !== undefined
  const visible = isControlled ? !!visibilityConfig?.visible : uncontrolledVisible.value
  const visibilityEnabled = visibilityToggle !== false

  const handleVisibleChange = (nextVisible: boolean) => {
    if (inputRef.current) {
      inputRef.current.type = nextVisible ? 'text' : 'password'
    }
    if (!isControlled) {
      uncontrolledVisible.value = nextVisible
    }
    if (visibilityConfig?.onVisibleChange) {
      visibilityConfig.onVisibleChange(nextVisible)
    }
  }

  const visibilityButton = visibilityEnabled ? (
    <button
      type="button"
      aria-label={visible ? 'Hide password' : 'Show password'}
      className="btn btn-ghost btn-xs btn-circle h-7 min-h-0 w-7 shrink-0 p-0"
      onClick={(event: MouseEvent) => {
        if (typeof (event as any).preventDefault === 'function') {
          ;(event as any).preventDefault()
        }
        handleVisibleChange(!visible)
      }}
    >
      {iconRender ? iconRender(visible) : visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
    </button>
  ) : null

  const mergedSuffix = visibilityButton ? (
    <span className="inline-flex items-center gap-1">
      {suffix}
      {visibilityButton}
    </span>
  ) : (
    suffix
  )

  return (
    <InputRoot
      {...rest}
      ref={inputRef}
      type={visible ? 'text' : 'password'}
      suffix={mergedSuffix}
    />
  )
}

type InputCompound = FC<InputProps> & {
  Shell: FC<InputShellProps>
  Search: FC<SearchProps>
  Password: FC<PasswordProps>
  TextArea: FC<TextareaProps>
}

const InputCompound: InputCompound = Object.assign(InputRoot, {
  Shell,
  Search,
  Password,
  TextArea: Textarea,
})

export default InputCompound
