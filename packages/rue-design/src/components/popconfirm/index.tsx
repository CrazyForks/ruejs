/*
Popconfirm 组件概述
- 提供确认型浮层，覆盖点击确认、异步确认、受控 / 非受控开关与常用文案定制。
- 交互心智参考成熟组件库，但视觉仍沿用 Rue 当前卡片与按钮体系，不直接复刻 ant-design 皮肤。
- 保持为原生 TSX 源文件，让 Rue 编译器参与优化，而不是手写 transformed 结果。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, ref, watch } from '@rue-js/rue'

export type PopconfirmPlacement =
  | 'top'
  | 'topLeft'
  | 'topRight'
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight'
  | 'left'
  | 'leftTop'
  | 'leftBottom'
  | 'right'
  | 'rightTop'
  | 'rightBottom'

export type PopconfirmTrigger = 'hover' | 'focus' | 'click' | 'contextMenu'
export type PopconfirmOkType =
  | 'solid'
  | 'filled'
  | 'outlined'
  | 'dashed'
  | 'text'
  | 'link'
  | 'default'
  | 'primary'
  | 'danger'
export type PopconfirmArrow = boolean | { pointAtCenter?: boolean }

export interface PopconfirmButtonProps {
  children?: any
  className?: string
  style?: Record<string, any>
  type?: 'solid' | 'filled' | 'outlined' | 'dashed' | 'text' | 'link'
  color?:
    | 'default'
    | 'danger'
    | 'neutral'
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'medium' | 'middle' | 'large'
  shape?: 'default' | 'square' | 'circle' | 'round'
  block?: boolean
  wide?: boolean
  danger?: boolean
  disabled?: boolean
  htmlType?: 'button' | 'submit' | 'reset'
  icon?: any
  iconPlacement?: 'start' | 'end'
  loading?: boolean | { delay?: number; icon?: any }
  onClick?: (event: MouseEvent) => void
}

export interface PopconfirmClassNames {
  root?: string
  trigger?: string
  overlay?: string
  panel?: string
  arrow?: string
  icon?: string
  body?: string
  title?: string
  description?: string
  footer?: string
  cancelButton?: string
  okButton?: string
}

export interface PopconfirmStyles {
  root?: Record<string, any>
  trigger?: Record<string, any>
  overlay?: Record<string, any>
  panel?: Record<string, any>
  arrow?: Record<string, any>
  icon?: Record<string, any>
  body?: Record<string, any>
  title?: Record<string, any>
  description?: Record<string, any>
  footer?: Record<string, any>
  cancelButton?: Record<string, any>
  okButton?: Record<string, any>
}

export interface PopconfirmProps {
  title?: any
  description?: any
  disabled?: boolean
  placement?: PopconfirmPlacement
  trigger?: PopconfirmTrigger | PopconfirmTrigger[]
  arrow?: PopconfirmArrow
  open?: boolean
  defaultOpen?: boolean
  icon?: any
  okText?: any
  cancelText?: any
  okType?: PopconfirmOkType
  okButtonProps?: PopconfirmButtonProps
  cancelButtonProps?: PopconfirmButtonProps
  showCancel?: boolean
  className?: string
  style?: string | Record<string, any>
  overlayClassName?: string
  overlayStyle?: Record<string, any>
  classNames?: PopconfirmClassNames
  styles?: PopconfirmStyles
  onConfirm?: (event?: MouseEvent) => void | boolean | Promise<unknown>
  onCancel?: (event?: MouseEvent) => void
  onOpenChange?: (open: boolean) => void
  onPopupClick?: (event: MouseEvent) => void
  children?: any
  [key: string]: any
}

interface PlacementLayout {
  direction: 'top' | 'bottom' | 'left' | 'right'
  align: 'start' | 'center' | 'end'
}

let popconfirmIdSeed = 0
const HOVER_CLOSE_DELAY_MS = 120

const mergeClassNames = (...parts: Array<string | undefined | false | null>) => {
  return parts.filter(Boolean).join(' ')
}

const mergeStyles = (...parts: Array<Record<string, any> | undefined>) => {
  const merged: Record<string, any> = {}
  parts.forEach(part => {
    if (part) Object.assign(merged, part)
  })
  return merged
}

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const serializeStyle = (style?: string | Record<string, any>) => {
  if (!style) return undefined
  if (typeof style === 'string') return style.trim() || undefined
  const serialized = Object.entries(style)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key.startsWith('--') ? key : toKebabCase(key)}:${String(value)}`)
    .join('; ')
  return serialized || undefined
}

const isRenderable = (value: any) => {
  return value !== undefined && value !== null && value !== false && value !== ''
}

const resolveNode = (value: any) => {
  return typeof value === 'function' ? value() : value
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  return !!value && typeof (value as PromiseLike<unknown>).then === 'function'
}

const callHandler = (handler: ((event: any) => void) | undefined, event: any) => {
  if (typeof handler === 'function') handler(event)
}

const normalizeTrigger = (trigger?: PopconfirmTrigger | PopconfirmTrigger[]) => {
  const source = Array.isArray(trigger) ? trigger : trigger ? [trigger] : ['click']
  return Array.from(new Set(source)) as PopconfirmTrigger[]
}

const resolvePlacementLayout = (placement: PopconfirmPlacement): PlacementLayout => {
  switch (placement) {
    case 'top':
      return { direction: 'top', align: 'center' }
    case 'topLeft':
      return { direction: 'top', align: 'start' }
    case 'topRight':
      return { direction: 'top', align: 'end' }
    case 'bottom':
      return { direction: 'bottom', align: 'center' }
    case 'bottomRight':
      return { direction: 'bottom', align: 'end' }
    case 'left':
      return { direction: 'left', align: 'center' }
    case 'leftTop':
      return { direction: 'left', align: 'start' }
    case 'leftBottom':
      return { direction: 'left', align: 'end' }
    case 'right':
      return { direction: 'right', align: 'center' }
    case 'rightTop':
      return { direction: 'right', align: 'start' }
    case 'rightBottom':
      return { direction: 'right', align: 'end' }
    case 'bottomLeft':
    default:
      return { direction: 'bottom', align: 'start' }
  }
}

const getOverlayPlacementClass = (placement: PopconfirmPlacement) => {
  switch (placement) {
    case 'top':
      return 'bottom-full left-1/2 mb-3 -translate-x-1/2'
    case 'topLeft':
      return 'bottom-full left-0 mb-3'
    case 'topRight':
      return 'bottom-full right-0 mb-3'
    case 'bottom':
      return 'top-full left-1/2 mt-3 -translate-x-1/2'
    case 'bottomRight':
      return 'top-full right-0 mt-3'
    case 'left':
      return 'right-full top-1/2 me-3 -translate-y-1/2'
    case 'leftTop':
      return 'right-full top-0 me-3'
    case 'leftBottom':
      return 'right-full bottom-0 me-3'
    case 'right':
      return 'left-full top-1/2 ms-3 -translate-y-1/2'
    case 'rightTop':
      return 'left-full top-0 ms-3'
    case 'rightBottom':
      return 'left-full bottom-0 ms-3'
    case 'bottomLeft':
    default:
      return 'top-full left-0 mt-3'
  }
}

const getTransformOriginClass = (placement: PopconfirmPlacement) => {
  switch (placement) {
    case 'top':
    case 'topLeft':
    case 'topRight':
      return 'origin-bottom'
    case 'left':
    case 'leftTop':
    case 'leftBottom':
      return 'origin-right'
    case 'right':
    case 'rightTop':
    case 'rightBottom':
      return 'origin-left'
    case 'bottom':
    case 'bottomLeft':
    case 'bottomRight':
    default:
      return 'origin-top'
  }
}

const resolveArrowClassName = (placement: PopconfirmPlacement, pointAtCenter: boolean) => {
  const layout = resolvePlacementLayout(placement)
  if (layout.direction === 'top') {
    return mergeClassNames(
      'bottom-[-6px] border-r border-b',
      pointAtCenter || layout.align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : layout.align === 'end'
          ? 'right-5'
          : 'left-5',
    )
  }

  if (layout.direction === 'bottom') {
    return mergeClassNames(
      'top-[-6px] border-l border-t',
      pointAtCenter || layout.align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : layout.align === 'end'
          ? 'right-5'
          : 'left-5',
    )
  }

  if (layout.direction === 'left') {
    return mergeClassNames(
      'right-[-6px] border-r border-t',
      pointAtCenter || layout.align === 'center'
        ? 'top-1/2 -translate-y-1/2'
        : layout.align === 'end'
          ? 'bottom-5'
          : 'top-5',
    )
  }

  return mergeClassNames(
    'left-[-6px] border-l border-b',
    pointAtCenter || layout.align === 'center'
      ? 'top-1/2 -translate-y-1/2'
      : layout.align === 'end'
        ? 'bottom-5'
        : 'top-5',
  )
}

const resolveButtonSizeClassName = (size?: PopconfirmButtonProps['size']) => {
  switch (size) {
    case 'xs':
      return 'btn-xs'
    case 'sm':
    case 'small':
      return 'btn-sm'
    case 'lg':
    case 'large':
      return 'btn-lg'
    case 'xl':
      return 'btn-xl'
    case 'md':
    case 'middle':
    case 'medium':
    default:
      return 'btn-md'
  }
}

const resolveButtonToneClassName = (color?: PopconfirmButtonProps['color'], danger?: boolean) => {
  const resolved = danger ? 'danger' : color
  if (!resolved || resolved === 'default') return ''
  return `btn-${resolved === 'danger' ? 'error' : resolved}`
}

const resolveButtonTypeClassName = (type?: PopconfirmButtonProps['type']) => {
  switch (type) {
    case 'outlined':
      return 'btn-outline'
    case 'dashed':
      return 'btn-dash'
    case 'filled':
      return 'btn-soft'
    case 'text':
      return 'btn-ghost'
    case 'link':
      return 'btn-link'
    default:
      return ''
  }
}

const resolveOkButtonPreset = (okType?: PopconfirmOkType): Partial<PopconfirmButtonProps> => {
  switch (okType) {
    case 'default':
      return {}
    case 'danger':
      return { color: 'danger' }
    case 'primary':
      return { color: 'primary' }
    case 'filled':
    case 'outlined':
    case 'dashed':
    case 'text':
    case 'link':
    case 'solid':
      return { type: okType }
    default:
      return { color: 'primary' }
  }
}

const resolveActionButtonClassName = (
  props: PopconfirmButtonProps | undefined,
  fallbackClassName: string,
  extraClassName?: string,
) => {
  return mergeClassNames(
    'btn',
    resolveButtonSizeClassName(props?.size),
    resolveButtonToneClassName(props?.color, props?.danger),
    resolveButtonTypeClassName(props?.type),
    props?.shape === 'circle' ? 'btn-circle' : '',
    props?.shape === 'square' ? 'btn-square' : '',
    props?.shape === 'round' ? 'rounded-full' : '',
    props?.block ? 'btn-block' : '',
    props?.wide ? 'btn-wide' : '',
    fallbackClassName,
    extraClassName,
    props?.className,
  )
}

const resolveButtonLoading = (loading?: PopconfirmButtonProps['loading']) => {
  if (!loading) return { active: false, icon: undefined as any }
  if (typeof loading === 'object') {
    return { active: true, icon: loading.icon }
  }
  return { active: true, icon: undefined as any }
}

const renderButtonContent = (
  props: PopconfirmButtonProps | undefined,
  fallbackLabel: any,
  loading?: boolean,
) => {
  const hasChildren = isRenderable(props?.children)
  const loadingConfig = resolveButtonLoading(props?.loading)
  const shouldShowIcon = !!loading || !!props?.icon
  const renderIconContent = () =>
    loading
      ? (loadingConfig.icon ?? (
          <span aria-hidden="true" className="loading loading-spinner loading-xs" />
        ))
      : props?.icon

  if (props?.iconPlacement === 'end') {
    return (
      <>
        <span>{hasChildren ? props?.children : fallbackLabel}</span>
        {shouldShowIcon ? (
          <span className="inline-flex items-center justify-center">{renderIconContent()}</span>
        ) : null}
      </>
    )
  }

  return (
    <>
      {shouldShowIcon ? (
        <span className="inline-flex items-center justify-center">{renderIconContent()}</span>
      ) : null}
      <span>{hasChildren ? props?.children : fallbackLabel}</span>
    </>
  )
}

const Popconfirm: FC<PopconfirmProps> = ({
  title,
  description,
  disabled,
  placement = 'top',
  trigger,
  arrow = true,
  open,
  defaultOpen = false,
  icon,
  okText = '确认',
  cancelText = '取消',
  okType = 'primary',
  okButtonProps,
  cancelButtonProps,
  showCancel = true,
  className,
  style,
  overlayClassName,
  overlayStyle,
  classNames,
  styles,
  onConfirm,
  onCancel,
  onOpenChange,
  onPopupClick,
  children,
  ...rest
}) => {
  const uncontrolledOpen = ref(defaultOpen)
  const currentOpenRef = ref(open ?? defaultOpen)
  const currentTriggers = ref(normalizeTrigger(trigger))
  const confirmLoading = ref(false)
  const titleId = ref(`rue-popconfirm-title-${popconfirmIdSeed++}`)
  const descriptionId = ref(`rue-popconfirm-desc-${popconfirmIdSeed++}`)
  const isControlled = open !== undefined
  const resolvedTitle = resolveNode(title)
  const resolvedDescription = resolveNode(description)
  const resolvedIcon = icon === undefined ? undefined : resolveNode(icon)
  const okPreset = resolveOkButtonPreset(okType)
  const pointAtCenter = typeof arrow === 'object' && !!arrow.pointAtCenter
  const showArrow = arrow !== false
  const resolvedOkLoading = resolveButtonLoading(okButtonProps?.loading)
  const isOkLoading = () => confirmLoading.value || resolvedOkLoading.active
  const hasTrigger = (type: PopconfirmTrigger) => currentTriggers.value.includes(type)
  let rootElement: HTMLElement | null = null
  let hoverCloseTimer: ReturnType<typeof setTimeout> | null = null

  const setRootElement = (element: HTMLElement | null) => {
    if (rootElement === element) return
    if (rootElement) {
      rootElement.removeEventListener('focusin', handleNativeFocusIn)
      rootElement.removeEventListener('focusout', handleNativeFocusOut)
    }
    rootElement = element
    if (rootElement) {
      rootElement.addEventListener('focusin', handleNativeFocusIn)
      rootElement.addEventListener('focusout', handleNativeFocusOut)
    }
  }

  const clearHoverCloseTimer = () => {
    if (!hoverCloseTimer) return
    clearTimeout(hoverCloseTimer)
    hoverCloseTimer = null
  }

  watch(
    () => open,
    nextOpen => {
      if (typeof nextOpen === 'boolean') {
        currentOpenRef.value = nextOpen
        if (!nextOpen) confirmLoading.value = false
        return
      }
      currentOpenRef.value = uncontrolledOpen.value
    },
    { immediate: true },
  )

  watch(
    () => defaultOpen,
    nextDefaultOpen => {
      if (isControlled) return
      uncontrolledOpen.value = !!nextDefaultOpen
      currentOpenRef.value = !!nextDefaultOpen
    },
    { immediate: true },
  )

  watch(
    () => trigger,
    (nextTrigger: PopconfirmTrigger | PopconfirmTrigger[] | undefined) => {
      currentTriggers.value = normalizeTrigger(nextTrigger)
    },
    { immediate: true },
  )

  const requestOpenChange = (nextOpen: boolean) => {
    clearHoverCloseTimer()
    if (disabled || nextOpen === currentOpenRef.value) return
    if (!isControlled) uncontrolledOpen.value = nextOpen
    currentOpenRef.value = nextOpen
    if (!nextOpen) confirmLoading.value = false
    onOpenChange?.(nextOpen)
  }

  const scheduleHoverClose = () => {
    clearHoverCloseTimer()
    hoverCloseTimer = setTimeout(() => {
      hoverCloseTimer = null
      requestOpenChange(false)
    }, HOVER_CLOSE_DELAY_MS)
  }

  const handleWindowClick = (event: MouseEvent) => {
    if (!currentOpenRef.value) return
    if (!(hasTrigger('click') || hasTrigger('contextMenu'))) return
    if (rootElement?.contains(event.target as Node)) return
    requestOpenChange(false)
  }

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (!currentOpenRef.value || event.key !== 'Escape') return
    requestOpenChange(false)
  }

  const handleNativeFocusIn = (event: FocusEvent) => {
    if (!hasTrigger('focus')) return
    onFocus?.(event as any)
    if (!event.defaultPrevented) requestOpenChange(true)
  }

  const handleNativeFocusOut = (event: FocusEvent) => {
    if (!hasTrigger('focus')) return
    onBlur?.(event as any)
    if (event.defaultPrevented) return
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && rootElement?.contains(nextTarget)) return
    requestOpenChange(false)
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('click', handleWindowClick, true)
    window.addEventListener('keydown', handleWindowKeyDown)
  })

  onUnmounted(() => {
    clearHoverCloseTimer()
    setRootElement(null)
    if (typeof window === 'undefined') return
    window.removeEventListener('click', handleWindowClick, true)
    window.removeEventListener('keydown', handleWindowKeyDown)
  })

  const handleCancel = (event: MouseEvent) => {
    callHandler(cancelButtonProps?.onClick, event)
    if ((event as Event).defaultPrevented) return
    requestOpenChange(false)
    onCancel?.(event)
  }

  const handleConfirm = async (event: MouseEvent) => {
    if (confirmLoading.value) return
    callHandler(okButtonProps?.onClick, event)
    if ((event as Event).defaultPrevented) return

    const result = onConfirm?.(event)
    if (result === false) return

    if (isPromiseLike(result)) {
      confirmLoading.value = true
      currentOpenRef.value = true
      try {
        const settled = await result
        if (settled !== false) requestOpenChange(false)
      } catch {
        // 保持浮层打开，交给业务决定如何反馈失败。
      } finally {
        confirmLoading.value = false
      }
      return
    }

    requestOpenChange(false)
  }

  const { onMouseEnter, onMouseLeave, onFocus, onBlur, onClick, onContextMenu, ...domProps } = rest

  const rootClassName = mergeClassNames(
    'relative inline-flex max-w-full align-top',
    classNames?.root,
    className,
  )
  const triggerClassName = mergeClassNames(
    'inline-flex max-w-full items-stretch',
    classNames?.trigger,
  )
  const overlayClass = mergeClassNames(
    'absolute z-50 w-max max-w-[min(24rem,calc(100vw-2rem))] transform-gpu transition duration-150 ease-out',
    getOverlayPlacementClass(placement),
    getTransformOriginClass(placement),
    classNames?.overlay,
    overlayClassName,
  )
  const arrowClassName = mergeClassNames(
    'absolute block h-3 w-3 rotate-45 border-base-300/80 bg-base-100/95',
    resolveArrowClassName(placement, pointAtCenter),
    classNames?.arrow,
  )

  return (
    <div
      {...domProps}
      ref={setRootElement}
      className={rootClassName}
      style={serializeStyle(
        mergeStyles(typeof style === 'string' ? undefined : style, styles?.root),
      )}
      onMouseEnter={(event: any) => {
        callHandler(onMouseEnter, event)
        if (!event?.defaultPrevented && hasTrigger('hover')) requestOpenChange(true)
      }}
      onMouseLeave={(event: any) => {
        callHandler(onMouseLeave, event)
        if (!event?.defaultPrevented && hasTrigger('hover')) scheduleHoverClose()
      }}
      onFocus={(event: any) => {
        callHandler(onFocus, event)
      }}
      onBlur={(event: any) => {
        callHandler(onBlur, event)
      }}
    >
      <div
        className={triggerClassName}
        style={serializeStyle(styles?.trigger)}
        aria-haspopup="dialog"
        aria-expanded={String(currentOpenRef.value)}
        onClick={(event: any) => {
          callHandler(onClick, event)
          if (!event?.defaultPrevented && hasTrigger('click')) {
            requestOpenChange(!currentOpenRef.value)
          }
        }}
        onContextMenu={(event: any) => {
          callHandler(onContextMenu, event)
          if (!event?.defaultPrevented && hasTrigger('contextMenu')) {
            if (typeof event.preventDefault === 'function') event.preventDefault()
            requestOpenChange(!currentOpenRef.value)
          }
        }}
      >
        {children}
      </div>

      {currentOpenRef.value ? (
        <div
          className={overlayClass}
          style={serializeStyle(mergeStyles(styles?.overlay, overlayStyle))}
          aria-hidden="false"
        >
          {showArrow ? (
            <span className={arrowClassName} style={serializeStyle(styles?.arrow)} />
          ) : null}
          <div
            data-rue-popconfirm-panel="true"
            role="alertdialog"
            aria-modal="false"
            aria-labelledby={isRenderable(resolvedTitle) ? titleId.value : undefined}
            aria-describedby={isRenderable(resolvedDescription) ? descriptionId.value : undefined}
            className={mergeClassNames(
              'space-y-4 rounded-[1.15rem] border border-base-300/80 bg-base-100/95 p-4 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.55)] backdrop-blur',
              classNames?.panel,
            )}
            style={serializeStyle(styles?.panel)}
            onClick={(event: MouseEvent) => {
              onPopupClick?.(event)
            }}
          >
            <div
              className={mergeClassNames('flex items-start gap-3', classNames?.body)}
              style={serializeStyle(styles?.body)}
            >
              {isRenderable(resolvedIcon) ? (
                <div
                  className={mergeClassNames('mt-0.5 shrink-0', classNames?.icon)}
                  style={serializeStyle(styles?.icon)}
                >
                  {resolvedIcon}
                </div>
              ) : icon === undefined ? (
                <div
                  className={mergeClassNames('mt-0.5 shrink-0', classNames?.icon)}
                  style={serializeStyle(styles?.icon)}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-warning/12 text-warning ring-1 ring-inset ring-warning/25"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5v4.75" />
                      <circle cx="12" cy="16.3" r="0.75" fill="currentColor" stroke="none" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.04 3.77 3.9 14.08A2 2 0 0 0 5.63 17h12.74a2 2 0 0 0 1.72-2.92L13.96 3.77a2.25 2.25 0 0 0-3.92 0Z"
                      />
                    </svg>
                  </span>
                </div>
              ) : null}
              <div className="min-w-0 flex-1 space-y-1.5">
                {isRenderable(resolvedTitle) ? (
                  <div
                    id={titleId.value}
                    className={mergeClassNames(
                      'text-sm font-semibold leading-5 text-base-content',
                      classNames?.title,
                    )}
                    style={serializeStyle(styles?.title)}
                  >
                    {resolvedTitle}
                  </div>
                ) : null}
                {isRenderable(resolvedDescription) ? (
                  <div
                    id={descriptionId.value}
                    className={mergeClassNames(
                      'text-xs leading-5 text-base-content/70',
                      classNames?.description,
                    )}
                    style={serializeStyle(styles?.description)}
                  >
                    {resolvedDescription}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className={mergeClassNames(
                'flex items-center justify-end gap-2 border-t border-base-200/80 pt-3',
                classNames?.footer,
              )}
              style={serializeStyle(styles?.footer)}
            >
              {showCancel ? (
                <button
                  data-rue-popconfirm-action="cancel"
                  type={cancelButtonProps?.htmlType ?? 'button'}
                  className={resolveActionButtonClassName(
                    {
                      ...cancelButtonProps,
                      type: cancelButtonProps?.type ?? 'text',
                      size: cancelButtonProps?.size ?? 'small',
                    },
                    '',
                    classNames?.cancelButton,
                  )}
                  style={serializeStyle(
                    mergeStyles(styles?.cancelButton, cancelButtonProps?.style),
                  )}
                  disabled={cancelButtonProps?.disabled}
                  aria-disabled={String(!!cancelButtonProps?.disabled)}
                  onClick={handleCancel}
                >
                  {renderButtonContent(cancelButtonProps, cancelText)}
                </button>
              ) : null}

              <button
                data-rue-popconfirm-action="ok"
                type={okButtonProps?.htmlType ?? 'button'}
                className={resolveActionButtonClassName(
                  {
                    ...okPreset,
                    ...okButtonProps,
                    size: okButtonProps?.size ?? 'small',
                  },
                  okType === 'default' ? '' : 'btn-primary',
                  classNames?.okButton,
                )}
                style={serializeStyle(mergeStyles(styles?.okButton, okButtonProps?.style))}
                disabled={!!okButtonProps?.disabled || isOkLoading()}
                aria-disabled={String(!!okButtonProps?.disabled || isOkLoading())}
                aria-busy={String(isOkLoading())}
                onClick={handleConfirm}
              >
                {renderButtonContent(okButtonProps, okText, isOkLoading())}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Popconfirm
