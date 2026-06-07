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

/** ModalWidth 类型。 */
export type ModalWidth = string | number
/** ModalInlineStyle 样式值类型。 */
export type ModalInlineStyle = string | Record<string, string | number | null | undefined>
/** ModalGetContainer 类型。 */
export type ModalGetContainer = string | HTMLElement | (() => HTMLElement) | false

/** ModalButtonProps 组件属性。 */
export interface ModalButtonProps extends ButtonProps {}

/** ModalClassNames 局部类名配置。 */
export interface ModalClassNames {
  /** 根节点区域配置。 */
  root?: string
  /** 遮罩层区域配置。 */
  mask?: string
  /** 外层包裹区域配置。 */
  wrapper?: string
  /** 内容容器区域配置。 */
  container?: string
  /** box 配置项。 */
  box?: string
  /** 头部区域内容。 */
  header?: string
  /** 标题内容。 */
  title?: string
  /** 主体区域配置。 */
  body?: string
  /** 底部区域内容。 */
  footer?: string
  /** 关闭按钮区域配置。 */
  close?: string
}

/** ModalStyles 局部样式配置。 */
export interface ModalStyles {
  /** 根节点区域配置。 */
  root?: ModalInlineStyle
  /** 遮罩层区域配置。 */
  mask?: ModalInlineStyle
  /** 外层包裹区域配置。 */
  wrapper?: ModalInlineStyle
  /** 内容容器区域配置。 */
  container?: ModalInlineStyle
  /** box 配置项。 */
  box?: ModalInlineStyle
  /** 头部区域内容。 */
  header?: ModalInlineStyle
  /** 标题内容。 */
  title?: ModalInlineStyle
  /** 主体区域配置。 */
  body?: ModalInlineStyle
  /** 底部区域内容。 */
  footer?: ModalInlineStyle
  /** 关闭按钮区域配置。 */
  close?: ModalInlineStyle
}

/** ModalProps 组件属性。 */
export interface ModalProps {
  /** 受控打开状态。 */
  open?: boolean
  /** 非受控初始打开状态。 */
  defaultOpen?: boolean
  /** 标题内容。 */
  title?: any
  /** 组件子内容。 */
  children?: any
  /** 操作区内容。 */
  actions?: any
  /** 底部区域内容。 */
  footer?:
    | any
    | ((
        originNode: any,
        extra: {
          OkBtn: FC<Record<string, any>>
          CancelBtn: FC<Record<string, any>>
        },
      ) => any)
  /** 根节点附加类名。 */
  className?: string
  /** 根节点附加类名。 */
  rootClassName?: string
  /** 根节点内联样式。 */
  rootStyle?: ModalInlineStyle
  /** wrapClassName 附加类名。 */
  wrapClassName?: string
  /** wrapProps 透传属性。 */
  wrapProps?: Record<string, any>
  /** bodyClassName 附加类名。 */
  bodyClassName?: string
  /** headerClassName 附加类名。 */
  headerClassName?: string
  /** footerClassName 附加类名。 */
  footerClassName?: string
  /** maskClassName 附加类名。 */
  maskClassName?: string
  /** 按局部区域覆盖的类名集合。 */
  classNames?: ModalClassNames
  /** 按局部区域覆盖的内联样式集合。 */
  styles?: ModalStyles
  /** width 配置项。 */
  width?: ModalWidth
  /** 根节点内联样式。 */
  style?: ModalInlineStyle
  /** bodyStyle 内联样式。 */
  bodyStyle?: ModalInlineStyle
  /** maskStyle 内联样式。 */
  maskStyle?: ModalInlineStyle
  /** centered 配置项。 */
  centered?: boolean
  /** closable 配置项。 */
  closable?: boolean
  /** closeIcon 图标内容。 */
  closeIcon?: any
  /** keyboard 配置项。 */
  keyboard?: boolean
  /** 遮罩层区域配置。 */
  mask?: boolean
  /** maskClosable 配置项。 */
  maskClosable?: boolean
  /** forceRender 自定义渲染函数。 */
  forceRender?: boolean
  /** destroyOnClose 配置项。 */
  destroyOnClose?: boolean
  /** destroyOnHidden 配置项。 */
  destroyOnHidden?: boolean
  /** confirmLoading 配置项。 */
  confirmLoading?: boolean
  /** okText 文本内容。 */
  okText?: any
  /** cancelText 文本内容。 */
  cancelText?: any
  /** okType 配置项。 */
  okType?: ButtonType
  /** okButtonProps 透传属性。 */
  okButtonProps?: ModalButtonProps
  /** cancelButtonProps 透传属性。 */
  cancelButtonProps?: ModalButtonProps
  /** zIndex 配置项。 */
  zIndex?: number
  /** getContainer 配置项。 */
  getContainer?: ModalGetContainer
  /** 是否展示加载态。 */
  loading?: boolean
  /** onOk 事件回调。 */
  onOk?: (event: MouseEvent) => void
  /** onCancel 事件回调。 */
  onCancel?: (event: MouseEvent | KeyboardEvent) => void
  /** 关闭时触发的回调。 */
  onClose?: (event?: MouseEvent | KeyboardEvent) => void
  /** 打开状态变化时触发的回调。 */
  onOpenChange?: (open: boolean) => void
  /** afterClose 配置项。 */
  afterClose?: () => void
  /** afterOpenChange 配置项。 */
  afterOpenChange?: (open: boolean) => void
  /** modalRender 自定义渲染函数。 */
  modalRender?: (node: any) => any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

let activeModalCount = 0
let previousDocumentOverflow = ''

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (...classNames: Array<string | undefined | false | null>) =>
  classNames.filter(Boolean).join(' ')

/** 转换为 Camel Case 的内部工具函数。 */
const toCamelCase = (value: string) =>
  value.replace(/-([a-z])/g, (_, match: string) => match.toUpperCase())

/** 归一化 Style Key 的内部工具函数。 */
const normalizeStyleKey = (key: string) => {
  if (key.startsWith('--')) return key
  return key.includes('-') ? toCamelCase(key) : key
}

/** 转换为 Style Object 的内部工具函数。 */
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

/** merge Style Value 的内部工具函数。 */
const mergeStyleValue = (...styles: Array<ModalInlineStyle | undefined>) => {
  const merged: Record<string, string | number> = {}

  styles.forEach(style => {
    const normalizedStyle = toStyleObject(style)
    if (normalizedStyle) Object.assign(merged, normalizedStyle)
  })

  return Object.keys(merged).length > 0 ? merged : undefined
}

/** 解析 Width Style 的内部工具函数。 */
const resolveWidthStyle = (width?: ModalWidth) => {
  if (width == null) return undefined
  return typeof width === 'number' ? `${width}px` : width
}

/** 渲染 Loading Body 的内部工具函数。 */
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

/** Default Close Icon 的内部工具函数。 */
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

/** lock Document Scroll 的内部工具函数。 */
const lockDocumentScroll = () => {
  if (typeof document === 'undefined') return
  if (activeModalCount === 0) {
    previousDocumentOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
  activeModalCount += 1
}

/** unlock Document Scroll 的内部工具函数。 */
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

/** 默认导出模态框组件。 */
export default Modal
