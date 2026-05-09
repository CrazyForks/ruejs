/* RUE_VAPOR_TRANSFORMED */
/*
Textarea 组件概述
- 保留 Rue 当前 textarea 视觉类，并补齐更顺手的语义 API：status、allowClear、showCount、autoSize、resize。
- 继续兼容原有 color / size / ghost 用法，避免设计页和业务代码回退。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, render as renderRue, useRef, watch } from '@rue-js/rue'

export type TextareaTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type TextareaColor = 'default' | TextareaTone
export type TextareaSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'small'
  | 'middle'
  | 'medium'
  | 'large'
export type TextareaStatus = 'warning' | 'error'
export type TextareaVariant = 'outlined' | 'filled' | 'ghost'
export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both'

export interface TextareaAutoSizeConfig {
  minRows?: number
  maxRows?: number
}

export interface TextareaShowCountInfo {
  count: number
  maxLength?: number
}

export interface TextareaShowCountConfig {
  formatter?: (info: TextareaShowCountInfo) => any
}

export interface TextareaAllowClearConfig {
  clearIcon?: any
}

export interface TextareaProps {
  color?: TextareaColor
  size?: TextareaSize
  status?: TextareaStatus
  variant?: TextareaVariant
  resize?: TextareaResize
  ghost?: boolean
  showCount?: boolean | TextareaShowCountConfig
  allowClear?: boolean | TextareaAllowClearConfig
  autoSize?: boolean | TextareaAutoSizeConfig
  rootClassName?: string
  countClassName?: string
  clearButtonClassName?: string
  className?: string
  disabled?: boolean
  value?: string | number
  defaultValue?: string | number
  onClear?: (event: MouseEvent) => void
  onInput?: (event: Event) => void
  onChange?: (event: Event) => void
  [key: string]: any
}

const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const resolveTextValue = (value?: string | number) => {
  if (value == null) return ''
  return String(value)
}

const resolveSizeClass = (size?: TextareaSize) => {
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

const resolveStatusTone = (status?: TextareaStatus) => {
  switch (status) {
    case 'warning':
      return 'warning' as TextareaTone
    case 'error':
      return 'error' as TextareaTone
    default:
      return undefined
  }
}

const resolveResizeClass = (resize?: TextareaResize) => {
  switch (resize) {
    case 'none':
      return 'resize-none'
    case 'vertical':
      return 'resize-y'
    case 'horizontal':
      return 'resize-x'
    case 'both':
      return 'resize'
    default:
      return ''
  }
}

const buildTextareaClassName = ({
  color,
  status,
  size,
  variant,
  ghost,
  className,
  allowClear,
}: Pick<
  TextareaProps,
  'color' | 'status' | 'size' | 'variant' | 'ghost' | 'className' | 'allowClear'
>) => {
  let cls = 'textarea'
  const resolvedColor = color && color !== 'default' ? color : resolveStatusTone(status)
  const resolvedSize = resolveSizeClass(size)
  const isGhost = ghost || variant === 'ghost'

  if (resolvedColor) cls += ` textarea-${resolvedColor}`
  if (resolvedSize) cls += ` textarea-${resolvedSize}`
  if (isGhost) cls += ' textarea-ghost'
  if (variant === 'filled') cls += ' border-transparent bg-base-200/70 focus:bg-base-100'
  if (allowClear) cls += ' pr-10'
  if (className) cls += ` ${className}`

  return cls
}

const renderCountContent = (
  showCount: boolean | TextareaShowCountConfig | undefined,
  info: TextareaShowCountInfo,
) => {
  if (showCount && typeof showCount === 'object' && typeof showCount.formatter === 'function') {
    return showCount.formatter(info)
  }
  if (typeof info.maxLength === 'number') {
    return `${info.count} / ${info.maxLength}`
  }
  return String(info.count)
}

const stringifyCountContent = (content: any) => {
  if (content == null) return ''
  return typeof content === 'string' ? content : String(content)
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

const Textarea: FC<TextareaProps> = ({
  color,
  size,
  status,
  variant,
  resize,
  ghost,
  showCount,
  allowClear,
  autoSize,
  rootClassName,
  countClassName,
  clearButtonClassName,
  className,
  disabled,
  value,
  defaultValue,
  onClear,
  onInput,
  onChange,
  ...rest
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>()
  let countElement: HTMLDivElement | null = null
  let clearButtonElement: HTMLButtonElement | null = null
  const forwardedRef = rest.ref
  const isControlled = value !== undefined
  const currentValue = ref(resolveTextValue(isControlled ? value : defaultValue))
  const hasCount = !!showCount
  const clearConfig = allowClear && typeof allowClear === 'object' ? allowClear : undefined
  const clearable = !!allowClear
  const currentLength = () => currentValue.value.length
  const maxLength =
    typeof rest.maxLength === 'number'
      ? rest.maxLength
      : typeof rest.maxlength === 'number'
        ? rest.maxlength
        : undefined

  if ('ref' in rest) {
    delete rest.ref
  }

  const syncValueState = () => {
    currentValue.value = resolveTextValue(
      isControlled ? value : (textareaRef.current?.value ?? defaultValue),
    )
  }

  const syncCountDisplay = () => {
    if (!countElement || !hasCount) return
    renderRue(
      stringifyCountContent(
        renderCountContent(showCount, {
          count: currentLength(),
          maxLength,
        }),
      ),
      countElement,
    )
  }

  const syncClearButtonVisibility = () => {
    if (!clearButtonElement) return
    clearButtonElement.classList.toggle('hidden', currentLength() <= 0 || !!disabled)
  }

  const syncAffixes = () => {
    syncCountDisplay()
    syncClearButtonVisibility()
  }

  const syncAutoSize = () => {
    const element = textareaRef.current
    if (!element) return

    if (!autoSize) {
      element.style.height = ''
      element.style.overflowY = ''
      return
    }

    const config = typeof autoSize === 'object' ? autoSize : undefined
    const computedStyle = window.getComputedStyle(element)
    const lineHeightValue = Number.parseFloat(computedStyle.lineHeight)
    const fontSizeValue = Number.parseFloat(computedStyle.fontSize)
    const lineHeight = Number.isFinite(lineHeightValue)
      ? lineHeightValue
      : Number.isFinite(fontSizeValue)
        ? fontSizeValue * 1.5
        : 24
    const borderHeight =
      Number.parseFloat(computedStyle.borderTopWidth || '0') +
      Number.parseFloat(computedStyle.borderBottomWidth || '0')
    const paddingHeight =
      Number.parseFloat(computedStyle.paddingTop || '0') +
      Number.parseFloat(computedStyle.paddingBottom || '0')
    const minRows =
      typeof config?.minRows === 'number' && config.minRows > 0
        ? config.minRows
        : typeof rest.rows === 'number'
          ? rest.rows
          : undefined
    const maxRows =
      typeof config?.maxRows === 'number' && config.maxRows > 0
        ? Math.max(config.maxRows, minRows ?? 1)
        : undefined

    element.style.height = 'auto'
    let nextHeight = element.scrollHeight

    if (typeof minRows === 'number') {
      nextHeight = Math.max(nextHeight, minRows * lineHeight + borderHeight + paddingHeight)
    }

    if (typeof maxRows === 'number') {
      const maxHeight = maxRows * lineHeight + borderHeight + paddingHeight
      element.style.overflowY = nextHeight > maxHeight ? 'auto' : 'hidden'
      nextHeight = Math.min(nextHeight, maxHeight)
    } else {
      element.style.overflowY = 'hidden'
    }

    element.style.height = `${nextHeight}px`
  }

  const assignRefs = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element ?? undefined
    if (typeof forwardedRef === 'function') {
      forwardedRef(element)
      return
    }
    if (forwardedRef && typeof forwardedRef === 'object') {
      ;(forwardedRef as any).current = element ?? undefined
    }
  }

  const triggerNativeChangeEvents = (element: HTMLTextAreaElement) => {
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const handleInput = (event: Event) => {
    const target = event.target as HTMLTextAreaElement | null
    currentValue.value = target?.value ?? ''
    syncAutoSize()
    syncAffixes()
    if (onInput) onInput(event)
  }

  const handleChange = (event: Event) => {
    const target = event.target as HTMLTextAreaElement | null
    currentValue.value = target?.value ?? ''
    syncAutoSize()
    syncAffixes()
    if (onChange) onChange(event)
  }

  const handleClear = (event: MouseEvent) => {
    const element = textareaRef.current
    if (!element || disabled) return

    if (typeof (event as any).preventDefault === 'function') {
      ;(event as any).preventDefault()
    }
    if (typeof (event as any).stopPropagation === 'function') {
      ;(event as any).stopPropagation()
    }

    element.value = ''
    currentValue.value = ''
    syncAutoSize()
    syncAffixes()
    element.focus()
    triggerNativeChangeEvents(element)
    if (onClear) onClear(event)
  }

  onMounted(() => {
    syncValueState()
    syncAutoSize()
    syncAffixes()
  })

  watch(
    () => value,
    () => {
      if (isControlled && textareaRef.current) {
        textareaRef.current.value = resolveTextValue(value)
      }
      syncValueState()
      syncAutoSize()
      syncAffixes()
    },
    { immediate: true },
  )

  watch(
    () => autoSize,
    () => {
      syncAutoSize()
      syncAffixes()
    },
    { immediate: true },
  )

  if (rest.rows !== undefined && rest.rows !== null) {
    rest.rows = String(rest.rows)
  }

  if (autoSize && (rest.rows === undefined || rest.rows === null)) {
    const minRows =
      typeof autoSize === 'object' && typeof autoSize.minRows === 'number'
        ? autoSize.minRows
        : undefined
    if (minRows) {
      rest.rows = String(minRows)
    }
  }

  const nativeValueProps: Record<string, any> = {}
  if (value !== undefined) {
    nativeValueProps.value = value
  }
  if (defaultValue !== undefined) {
    nativeValueProps.defaultValue = defaultValue
  }

  const rawTextareaNode = (
    <textarea
      {...rest}
      {...nativeValueProps}
      ref={assignRefs}
      disabled={disabled}
      aria-invalid={status === 'error' ? 'true' : rest['aria-invalid']}
      data-rue-textarea-input="true"
      className={appendClassName(
        buildTextareaClassName({
          color,
          status,
          size,
          variant,
          ghost,
          className,
          allowClear: clearable,
        }),
        resolveResizeClass(resize),
      )}
      onInput={handleInput}
      onChange={handleChange}
    />
  )

  if (!clearable && !hasCount && !rootClassName) {
    return rawTextareaNode
  }

  const textareaNode = (
    <div className={appendClassName('relative', clearable ? 'w-full' : undefined)}>
      {rawTextareaNode}
      {clearable && !disabled ? (
        <button
          ref={(element: HTMLButtonElement | null) => {
            clearButtonElement = element
            syncClearButtonVisibility()
          }}
          type="button"
          tabIndex={-1}
          aria-label="Clear text"
          className={appendClassName(
            appendClassName(
              'btn btn-ghost btn-xs absolute right-2 top-2 h-7 min-h-0 w-7 rounded-full p-0 text-base-content/55 hover:text-base-content',
              currentLength() > 0 ? undefined : 'hidden',
            ),
            clearButtonClassName,
          )}
          onClick={handleClear}
        >
          {clearConfig?.clearIcon ?? <DefaultClearIcon />}
        </button>
      ) : null}
    </div>
  )

  return (
    <div
      className={appendClassName('flex flex-col gap-2', rootClassName)}
      data-rue-textarea-root="true"
    >
      {textareaNode}
      {hasCount ? (
        <div
          ref={(element: HTMLDivElement | null) => {
            countElement = element
            syncCountDisplay()
          }}
          className={appendClassName(
            'flex justify-end text-xs leading-5 text-base-content/60',
            countClassName,
          )}
          data-rue-textarea-count="true"
        />
      ) : null}
    </div>
  )
}

export default Textarea
