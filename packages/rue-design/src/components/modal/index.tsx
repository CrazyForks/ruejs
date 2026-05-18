/* RUE_VAPOR_TRANSFORMED */
/*
Modal 组件概述
- 保留 Rue 当前的 daisyUI 风格视觉，同时补齐受控/非受控、默认 footer、遮罩与键盘关闭等常用能力。
- 保留现有 `actions/onClose/className` 等写法，并统一使用 `open` 控制显隐。
*/
import type { FC } from '@rue-js/rue'
import { Teleport, h, onMounted, onUnmounted, ref, watch } from '@rue-js/rue'
import Button from '../button'
import type { ButtonProps, ButtonType } from '../button'

export type ModalWidth = string | number
export type ModalInlineStyle = string | Record<string, string | number | null | undefined>
export type ModalGetContainer = string | HTMLElement | (() => HTMLElement) | false

export interface ModalButtonProps extends ButtonProps {}

export interface ModalClassNames {
  root?: string
  mask?: string
  wrapper?: string
  container?: string
  box?: string
  header?: string
  title?: string
  body?: string
  footer?: string
  close?: string
}

export interface ModalStyles {
  root?: ModalInlineStyle
  mask?: ModalInlineStyle
  wrapper?: ModalInlineStyle
  container?: ModalInlineStyle
  box?: ModalInlineStyle
  header?: ModalInlineStyle
  title?: ModalInlineStyle
  body?: ModalInlineStyle
  footer?: ModalInlineStyle
  close?: ModalInlineStyle
}

export interface ModalProps {
  open?: boolean
  defaultOpen?: boolean
  title?: any
  children?: any
  actions?: any
  footer?:
    | any
    | ((
        originNode: any,
        extra: {
          OkBtn: FC<Record<string, any>>
          CancelBtn: FC<Record<string, any>>
        },
      ) => any)
  className?: string
  rootClassName?: string
  rootStyle?: ModalInlineStyle
  wrapClassName?: string
  wrapProps?: Record<string, any>
  bodyClassName?: string
  headerClassName?: string
  footerClassName?: string
  maskClassName?: string
  classNames?: ModalClassNames
  styles?: ModalStyles
  width?: ModalWidth
  style?: ModalInlineStyle
  bodyStyle?: ModalInlineStyle
  maskStyle?: ModalInlineStyle
  centered?: boolean
  closable?: boolean
  closeIcon?: any
  keyboard?: boolean
  mask?: boolean
  maskClosable?: boolean
  forceRender?: boolean
  destroyOnClose?: boolean
  destroyOnHidden?: boolean
  confirmLoading?: boolean
  okText?: any
  cancelText?: any
  okType?: ButtonType
  okButtonProps?: ModalButtonProps
  cancelButtonProps?: ModalButtonProps
  zIndex?: number
  getContainer?: ModalGetContainer
  loading?: boolean
  onOk?: (event: MouseEvent) => void
  onCancel?: (event: MouseEvent | KeyboardEvent) => void
  onClose?: (event?: MouseEvent | KeyboardEvent) => void
  onOpenChange?: (open: boolean) => void
  afterClose?: () => void
  afterOpenChange?: (open: boolean) => void
  modalRender?: (node: any) => any
  [key: string]: any
}

let activeModalCount = 0
let previousDocumentOverflow = ''

const mergeClassName = (...classNames: Array<string | undefined | false | null>) =>
  classNames.filter(Boolean).join(' ')

const toCamelCase = (value: string) =>
  value.replace(/-([a-z])/g, (_, match: string) => match.toUpperCase())

const normalizeStyleKey = (key: string) => {
  if (key.startsWith('--')) return key
  return key.includes('-') ? toCamelCase(key) : key
}

const toStyleObject = (style?: ModalInlineStyle) => {
  if (!style) return undefined
  const normalized: Record<string, string | number> = {}

  if (typeof style === 'string') {
    style
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(part => {
        const separatorIndex = part.indexOf(':')
        if (separatorIndex === -1) return
        const rawKey = part.slice(0, separatorIndex).trim()
        const rawValue = part.slice(separatorIndex + 1).trim()
        if (!rawKey || !rawValue) return
        normalized[normalizeStyleKey(rawKey)] = rawValue
      })

    return Object.keys(normalized).length > 0 ? normalized : undefined
  }

  Object.entries(style).forEach(([key, value]) => {
    if (value == null) return
    normalized[normalizeStyleKey(key)] = value
  })

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

const mergeStyleValue = (...styles: Array<ModalInlineStyle | undefined>) => {
  const merged: Record<string, string | number> = {}

  styles.forEach(style => {
    const normalizedStyle = toStyleObject(style)
    if (normalizedStyle) Object.assign(merged, normalizedStyle)
  })

  return Object.keys(merged).length > 0 ? merged : undefined
}

const resolveWidthStyle = (width?: ModalWidth) => {
  if (width == null) return undefined
  return typeof width === 'number' ? `${width}px` : width
}

const renderLoadingBody = () => {
  return (
    <div className="space-y-3" data-rue-modal-loading="true">
      <div className="skeleton h-4 w-2/5" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-5/6" />
      <div className="skeleton h-24 w-full" />
    </div>
  )
}

const DefaultCloseIcon: FC = () => {
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

const lockDocumentScroll = () => {
  if (typeof document === 'undefined') return
  if (activeModalCount === 0) {
    previousDocumentOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
  activeModalCount += 1
}

const unlockDocumentScroll = () => {
  if (typeof document === 'undefined' || activeModalCount === 0) return
  activeModalCount -= 1
  if (activeModalCount === 0) {
    document.documentElement.style.overflow = previousDocumentOverflow
  }
}

/** 模态框组件：保留现有 API，并补齐常见的 Modal 交互能力。 */
const Modal: FC<ModalProps> = ({
  open,
  defaultOpen = false,
  title,
  children,
  actions,
  footer,
  className,
  rootClassName,
  rootStyle,
  wrapClassName,
  wrapProps,
  bodyClassName,
  headerClassName,
  footerClassName,
  maskClassName,
  classNames,
  styles,
  width,
  style,
  bodyStyle,
  maskStyle,
  centered = false,
  closable = true,
  closeIcon,
  keyboard = true,
  mask = true,
  maskClosable = true,
  forceRender = false,
  destroyOnClose,
  destroyOnHidden = true,
  confirmLoading = false,
  okText = '确定',
  cancelText,
  okType = 'primary',
  okButtonProps,
  cancelButtonProps,
  zIndex,
  getContainer,
  loading = false,
  onOk,
  onCancel,
  onClose,
  onOpenChange,
  afterClose,
  afterOpenChange,
  modalRender,
  ...rest
}) => {
  const uncontrolledOpen = ref(defaultOpen)
  const hasOpened = ref(defaultOpen)
  const locked = ref(false)

  const isControlled = typeof open === 'boolean'
  const mergedOpen = typeof open === 'boolean' ? open : uncontrolledOpen.value
  const currentOpen = ref(mergedOpen)
  const currentKeyboard = ref(keyboard)

  const requestOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      uncontrolledOpen.value = nextOpen
    }
    if (onOpenChange) onOpenChange(nextOpen)
  }

  const notifyCancel = (event?: MouseEvent | KeyboardEvent) => {
    if (event && typeof (event as any).preventDefault === 'function') {
      ;(event as any).preventDefault()
    }
    if (onCancel && event) onCancel(event)
    if (onClose) onClose(event)
    requestOpenChange(false)
  }

  const handleOk = (event: MouseEvent) => {
    if (confirmLoading) return
    if (onOk) onOk(event)
  }

  const _handleMaskClick = (event: MouseEvent) => {
    if (!mask || !maskClosable) return
    if (event.target === event.currentTarget) {
      notifyCancel(event)
    }
  }

  onMounted(() => {
    if (mergedOpen) {
      lockDocumentScroll()
      locked.value = true
    }

    if (typeof window === 'undefined') return

    const handleDocumentKeydown = (event: KeyboardEvent) => {
      if (!currentOpen.value || !currentKeyboard.value || event.key !== 'Escape') return
      notifyCancel(event)
    }

    window.addEventListener('keydown', handleDocumentKeydown)
    onUnmounted(() => {
      window.removeEventListener('keydown', handleDocumentKeydown)
    })
  })

  watch(
    () => mergedOpen,
    (nextOpen: boolean) => {
      currentOpen.value = nextOpen
      if (nextOpen) {
        hasOpened.value = true
        if (!locked.value) {
          lockDocumentScroll()
          locked.value = true
        }
      } else if (locked.value) {
        unlockDocumentScroll()
        locked.value = false
        if (afterClose) afterClose()
      }
      if (afterOpenChange) afterOpenChange(nextOpen)
    },
  )

  watch(
    () => keyboard,
    (nextKeyboard: boolean) => {
      currentKeyboard.value = nextKeyboard
    },
    { immediate: true },
  )

  watch(
    () => defaultOpen,
    nextDefaultOpen => {
      if (!isControlled) {
        uncontrolledOpen.value = !!nextDefaultOpen
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    if (locked.value) {
      unlockDocumentScroll()
      locked.value = false
    }
  })

  const mergedDestroyOnHidden = destroyOnHidden ?? destroyOnClose ?? true
  const shouldMount = mergedOpen || forceRender || (!mergedDestroyOnHidden && hasOpened.value)
  if (!shouldMount) return null

  const wrapperProps = wrapProps ?? {}
  const {
    className: wrapperPropsClassName,
    style: wrapperPropsStyle,
    onClick: wrapperPropsOnClick,
    ...wrapperRestProps
  } = wrapperProps

  const defaultCancelText = cancelText ?? (onOk || okButtonProps ? '取消' : '关闭')
  const showLegacyActionFooter = footer === undefined && actions != null
  const showOkButton = !showLegacyActionFooter && (onOk != null || okButtonProps != null)
  const showCancelButton =
    showLegacyActionFooter || onCancel != null || onClose != null || showOkButton

  const renderCancelButtonNode = (buttonOverrides?: Record<string, any>) => {
    const { children: buttonChildren, onClick, ...buttonRest } = buttonOverrides ?? {}
    return h(
      Button,
      {
        ...cancelButtonProps,
        ...buttonRest,
        onClick: (event: MouseEvent) => {
          if (onClick) onClick(event)
          if (event.defaultPrevented) return
          notifyCancel(event)
        },
        disabled: buttonRest.disabled ?? cancelButtonProps?.disabled,
      },
      buttonChildren ?? cancelButtonProps?.children ?? defaultCancelText,
    )
  }

  const renderOkButtonNode = (buttonOverrides?: Record<string, any>) => {
    const { children: buttonChildren, onClick, ...buttonRest } = buttonOverrides ?? {}
    return h(
      Button,
      {
        ...okButtonProps,
        ...buttonRest,
        type: buttonRest.type ?? okButtonProps?.type ?? okType,
        loading: buttonRest.loading ?? okButtonProps?.loading ?? confirmLoading,
        onClick: (event: MouseEvent) => {
          if (onClick) onClick(event)
          if (event.defaultPrevented) return
          handleOk(event)
        },
      },
      buttonChildren ?? okButtonProps?.children ?? okText,
    )
  }

  const CancelBtn: FC<Record<string, any>> = props => renderCancelButtonNode(props)
  const OkBtn: FC<Record<string, any>> = props => renderOkButtonNode(props)

  const defaultFooter = (
    <>
      {showLegacyActionFooter ? actions : null}
      {showCancelButton ? renderCancelButtonNode() : null}
      {showOkButton ? renderOkButtonNode() : null}
    </>
  )

  const footerContent =
    loading || footer === null || footer === false
      ? null
      : typeof footer === 'function'
        ? footer(defaultFooter, { OkBtn, CancelBtn })
        : (footer ?? defaultFooter)

  const handleWrapperClick = (event: MouseEvent) => {
    if (wrapperPropsOnClick) wrapperPropsOnClick(event)
    if (event.defaultPrevented) return
    if (!mask || !maskClosable || event.target !== event.currentTarget) return
    notifyCancel(event)
  }

  const boxNode = (
    <div
      {...rest}
      aria-hidden={mergedOpen ? undefined : 'true'}
      className={mergeClassName(
        `modal ${mergedOpen ? 'modal-open' : ''} bg-transparent`.trim(),
        mergeClassName(
          rootClassName,
          mergeClassName(classNames?.root, mergedOpen ? undefined : 'pointer-events-none'),
        ),
      )}
      style={mergeStyleValue(styles?.root, rootStyle, zIndex != null ? { zIndex } : undefined)}
      data-rue-modal-root="true"
    >
      {mask ? (
        <div
          aria-hidden="true"
          className={mergeClassName(
            'absolute inset-0 bg-base-content/40',
            mergeClassName(maskClassName, classNames?.mask),
          )}
          style={mergeStyleValue(styles?.mask, maskStyle)}
          data-rue-modal-mask="true"
        />
      ) : null}
      <div
        {...wrapperRestProps}
        className={mergeClassName(
          mergeClassName(
            `absolute inset-0 overflow-y-auto px-4 py-6 sm:px-6 ${centered ? 'flex items-center justify-center' : 'flex items-start justify-center sm:items-center'}`,
            wrapClassName,
          ),
          mergeClassName(wrapperPropsClassName, classNames?.wrapper),
        )}
        style={mergeStyleValue(styles?.wrapper, wrapperPropsStyle)}
        onClick={handleWrapperClick}
        data-rue-modal-wrapper="true"
      >
        <div
          className={mergeClassName('relative flex w-full justify-center', classNames?.container)}
          style={mergeStyleValue(styles?.container)}
          data-rue-modal-container="true"
        >
          <div
            role="dialog"
            aria-modal={mergedOpen ? 'true' : 'false'}
            aria-hidden={mergedOpen ? undefined : 'true'}
            className={mergeClassName(
              mergeClassName('modal-box relative', className),
              mergeClassName(classNames?.box, mergedOpen ? undefined : 'pointer-events-none'),
            )}
            style={mergeStyleValue(
              styles?.box,
              style,
              width != null ? { width: resolveWidthStyle(width) } : undefined,
            )}
            onClick={(event: MouseEvent) => {
              event.stopPropagation()
            }}
            data-rue-modal-box="true"
          >
            {closable ? (
              <button
                type="button"
                aria-label="关闭"
                className={mergeClassName(
                  'btn btn-sm btn-circle btn-ghost absolute right-4 top-4 z-10',
                  classNames?.close,
                )}
                style={mergeStyleValue(styles?.close)}
                onClick={(event: MouseEvent) => notifyCancel(event)}
              >
                {closeIcon ?? <DefaultCloseIcon />}
              </button>
            ) : null}
            {title ? (
              <div
                className={mergeClassName(
                  'mb-4 pr-10',
                  mergeClassName(headerClassName, classNames?.header),
                )}
                style={mergeStyleValue(styles?.header)}
              >
                <div
                  className={mergeClassName('text-lg font-semibold leading-6', classNames?.title)}
                  style={mergeStyleValue(styles?.title)}
                >
                  {title}
                </div>
              </div>
            ) : null}
            <div
              className={mergeClassName(
                'space-y-4',
                mergeClassName(bodyClassName, classNames?.body),
              )}
              style={mergeStyleValue(styles?.body, bodyStyle)}
              aria-busy={loading ? 'true' : undefined}
            >
              {loading ? renderLoadingBody() : children}
            </div>
            {footerContent ? (
              <div
                className={mergeClassName(
                  'modal-action mt-6 flex flex-wrap items-center justify-end gap-2',
                  mergeClassName(footerClassName, classNames?.footer),
                )}
                style={mergeStyleValue(styles?.footer)}
              >
                {footerContent}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )

  const renderedNode = modalRender ? modalRender(boxNode) : boxNode
  const resolvedContainer = typeof getContainer === 'function' ? getContainer() : getContainer

  if (resolvedContainer === false || resolvedContainer == null) {
    return renderedNode
  }

  return <Teleport to={resolvedContainer}>{renderedNode}</Teleport>
}

export default Modal
