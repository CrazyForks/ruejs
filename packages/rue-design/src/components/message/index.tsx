import { render, useRef, type FC } from '@rue-js/rue'
import Toast, {
  type ToastItemCloseMeta,
  type ToastGetContainer,
  type ToastInset,
  type ToastItemProps,
  type ToastItemType,
  type ToastItemVariant,
  type ToastMessageApi,
  type ToastMessageConfig,
  type ToastPlacement,
  type ToastProps,
  type ToastUseMessageOptions,
} from '../toast'

export type MessageKey = string | number
export type MessageType = ToastItemType
export type MessageVariant = ToastItemVariant
export type MessagePlacement = Extract<
  ToastPlacement,
  | 'top-start'
  | 'top'
  | 'top-center'
  | 'top-end'
  | 'bottom-start'
  | 'bottom'
  | 'bottom-center'
  | 'bottom-end'
  | 'center'
>

export interface MessageProps extends Omit<ToastProps, 'children' | 'placement' | 'inset'> {
  placement?: MessagePlacement
  top?: number | string
  inset?: ToastInset
  children?: any
}

export interface MessageItemProps extends Omit<
  ToastItemProps,
  'title' | 'description' | 'children' | 'open' | 'defaultOpen'
> {
  content?: any
  children?: any
}

export interface MessageOpenConfig extends Omit<MessageItemProps, 'children'> {
  key?: MessageKey
  children?: any
}

export interface MessageUseMessageOptions extends Omit<
  ToastUseMessageOptions,
  'placement' | 'type' | 'showIcon'
> {
  placement?: MessagePlacement
  top?: number | string
  inset?: ToastInset
  getContainer?: ToastGetContainer
  showIcon?: boolean
}

export interface MessageConfigOptions extends MessageUseMessageOptions {}

type MessageDurationArg = number | (() => void)
type MessageArgTuple = [content: any, durationOrOnClose?: MessageDurationArg, onClose?: () => void]

export interface MessageHandle extends PromiseLike<boolean> {
  (): void
  promise: Promise<boolean>
}

export interface MessageInstance {
  open: (config: MessageOpenConfig) => MessageHandle
  success: (...args: MessageArgTuple) => MessageHandle
  info: (...args: MessageArgTuple) => MessageHandle
  warning: (...args: MessageArgTuple) => MessageHandle
  error: (...args: MessageArgTuple) => MessageHandle
  loading: (...args: MessageArgTuple) => MessageHandle
  destroy: (key?: MessageKey) => void
}

const MESSAGE_ROOT_CLASS = 'message'
const MESSAGE_DEFAULT_GAP = 10
const MESSAGE_DEFAULT_TOP_OFFSET = 20
const MESSAGE_DEFAULT_PLACEMENT: MessagePlacement = 'top'
const MESSAGE_DEFAULT_LOADING_DURATION = 0
const MESSAGE_ITEM_CLASS =
  'w-auto min-w-[min(16rem,100%)] max-w-[min(38rem,calc(100vw-2rem))] rounded-2xl px-4 py-2.5 shadow-xl'
const MESSAGE_BODY_CLASS = 'text-sm leading-5'
const MESSAGE_CONFIG_KEYS = new Set([
  'key',
  'content',
  'children',
  'type',
  'duration',
  'icon',
  'showIcon',
  'variant',
  'className',
  'style',
  'onClose',
  'onClick',
  'closable',
  'pauseOnHover',
  'closeIcon',
  'contentClassName',
  'iconClassName',
  'closeClassName',
  'action',
])

let messageSeed = 0
let globalMessageConfig: MessageConfigOptions = {}
let globalMessageApi: MessageInstance | undefined
let globalMessageMount: HTMLDivElement | undefined

const mergeClassNames = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  if (children == null) return []
  return [children]
}

const hasRenderableContent = (value: any) => {
  return toChildArray(value).length > 0
}

const isRecordLike = (value: any): value is Record<string, any> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const looksLikeMessageConfig = (value: any): value is MessageOpenConfig => {
  return isRecordLike(value) && Object.keys(value).some(key => MESSAGE_CONFIG_KEYS.has(key))
}

const renderMessageBody = (content: any) => {
  if (!hasRenderableContent(content)) return null
  return <div className={MESSAGE_BODY_CLASS}>{content}</div>
}

const resolveMessageInset = (top?: number | string, inset?: ToastInset) => {
  if (inset != null) return inset
  return { x: 16, y: top ?? MESSAGE_DEFAULT_TOP_OFFSET }
}

const normalizeMessageOptions = (
  options: MessageUseMessageOptions = {},
): ToastUseMessageOptions => {
  const {
    placement = MESSAGE_DEFAULT_PLACEMENT,
    top,
    inset,
    gap = MESSAGE_DEFAULT_GAP,
    className,
    ...rest
  } = options

  return {
    placement,
    inset: resolveMessageInset(top, inset),
    gap,
    className: mergeClassNames(MESSAGE_ROOT_CLASS, className),
    ...rest,
  }
}

const normalizeMessageConfig = (
  config: MessageOpenConfig,
  fallbackType?: MessageType,
  fallbackDuration?: number | null,
): ToastMessageConfig => {
  const { content, children, type, duration, showIcon, className, contentClassName, ...rest } =
    config
  const resolvedType = type ?? fallbackType ?? 'neutral'
  const resolvedChildren = hasRenderableContent(children) ? children : content

  return {
    ...rest,
    type: resolvedType,
    duration: duration ?? fallbackDuration,
    showIcon: showIcon ?? resolvedType !== 'neutral',
    className: mergeClassNames(MESSAGE_ITEM_CLASS, className),
    contentClassName: mergeClassNames('min-w-0', contentClassName),
    children: renderMessageBody(resolvedChildren),
  }
}

const normalizeMessageArgs = (...args: MessageArgTuple): MessageOpenConfig => {
  if (looksLikeMessageConfig(args[0])) {
    return args[0]
  }

  const [content, durationOrOnClose, onClose] = args
  return {
    content,
    duration: typeof durationOrOnClose === 'number' ? durationOrOnClose : undefined,
    onClose:
      typeof durationOrOnClose === 'function'
        ? durationOrOnClose
        : typeof onClose === 'function'
          ? onClose
          : undefined,
  }
}

const THEN_KEY = ['th', 'en'].join('')

const attachMessageHandlePromise = (handle: MessageHandle, promise: Promise<boolean>) => {
  Object.defineProperty(handle, THEN_KEY, {
    configurable: true,
    writable: true,
    value: (
      onfulfilled?: ((value: boolean) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) => promise.then(onfulfilled, onrejected),
  })
  handle.promise = promise
  return handle
}

const createResolvedMessageHandle = () => {
  const promise = Promise.resolve(true)
  return attachMessageHandlePromise((() => {}) as MessageHandle, promise)
}

const wrapMessageHandle = (
  openToast: (config: ToastMessageConfig) => () => void,
  config: ToastMessageConfig,
) => {
  let resolved = false
  let closeFn: (() => void) | undefined
  let resolvePromise: (value: boolean) => void = () => {}

  const promise = new Promise<boolean>(resolve => {
    resolvePromise = resolve
  })

  const resolveClose = () => {
    if (resolved) return
    resolved = true
    resolvePromise(true)
  }

  closeFn = openToast({
    ...config,
    onClose: (meta: ToastItemCloseMeta) => {
      config.onClose?.(meta)
      resolveClose()
    },
  })

  const handle = (() => {
    closeFn?.()
    resolveClose()
  }) as MessageHandle

  return attachMessageHandlePromise(handle, promise)
}

const createMessageInstance = (toastApi: ToastMessageApi): MessageInstance => {
  const open = (config: MessageOpenConfig) => {
    return wrapMessageHandle(toastApi.open, normalizeMessageConfig(config))
  }

  const createTypedOpen = (type: MessageType, fallbackDuration?: number | null) => {
    return (...args: MessageArgTuple) => {
      const config = normalizeMessageArgs(...args)
      return wrapMessageHandle(
        toastApi.open,
        normalizeMessageConfig(config, type, fallbackDuration),
      )
    }
  }

  return {
    open,
    success: createTypedOpen('success'),
    info: createTypedOpen('info'),
    warning: createTypedOpen('warning'),
    error: createTypedOpen('error'),
    loading: createTypedOpen('loading', MESSAGE_DEFAULT_LOADING_DURATION),
    destroy: toastApi.destroy,
  }
}

export const useMessage = (options: MessageUseMessageOptions = {}) => {
  const [toastApi, contextHolder] = Toast.useMessage(normalizeMessageOptions(options))
  const apiRef = useRef<MessageInstance>()

  if (apiRef.current == null) {
    apiRef.current = createMessageInstance(toastApi)
  }

  return [apiRef.current, contextHolder] as const
}

const MessageItem: FC<MessageItemProps> = ({
  content,
  children,
  type,
  showIcon,
  className,
  contentClassName,
  ...rest
}) => {
  const resolvedType = type ?? 'neutral'
  const resolvedChildren = hasRenderableContent(children) ? children : content

  return (
    <Toast.Item
      {...rest}
      type={resolvedType}
      showIcon={showIcon ?? resolvedType !== 'neutral'}
      className={mergeClassNames(MESSAGE_ITEM_CLASS, className)}
      contentClassName={mergeClassNames('min-w-0', contentClassName)}
    >
      {renderMessageBody(resolvedChildren)}
    </Toast.Item>
  )
}

const Message: FC<MessageProps> = ({
  placement = MESSAGE_DEFAULT_PLACEMENT,
  top,
  inset,
  gap = MESSAGE_DEFAULT_GAP,
  className,
  children,
  ...rest
}) => {
  return (
    <Toast
      {...rest}
      placement={placement}
      inset={resolveMessageInset(top, inset)}
      gap={gap}
      className={mergeClassNames(MESSAGE_ROOT_CLASS, className)}
    >
      {children}
    </Toast>
  )
}

const ensureGlobalMessageMount = () => {
  if (typeof document === 'undefined') return null

  if (globalMessageMount && !globalMessageMount.isConnected) {
    globalMessageMount = undefined
    globalMessageApi = undefined
  }

  if (globalMessageMount == null) {
    globalMessageMount = document.createElement('div')
    globalMessageMount.style.display = 'contents'
    globalMessageMount.dataset.rueMessageViewport = 'true'
    document.body.appendChild(globalMessageMount)
  }

  return globalMessageMount
}

const GlobalMessageHolder: FC<{ options: MessageConfigOptions }> = ({ options }) => {
  const [api, holder] = useMessage(options)
  globalMessageApi = api
  return holder
}

const syncGlobalMessageHolder = () => {
  const mount = ensureGlobalMessageMount()
  if (!mount) return undefined

  render(<GlobalMessageHolder options={globalMessageConfig} />, mount)
  return globalMessageApi
}

const openGlobalMessage = (config: MessageOpenConfig) => {
  const normalizedConfig = {
    ...config,
    key: config.key ?? `rue-message-${messageSeed++}`,
  }
  const api = syncGlobalMessageHolder()

  if (api) {
    return api.open(normalizedConfig)
  }

  return createResolvedMessageHandle()
}

const destroyGlobalMessage = (key?: MessageKey) => {
  const api = syncGlobalMessageHolder()
  if (api) {
    api.destroy(key)
  }
}

const setGlobalMessageConfig = (options: MessageConfigOptions) => {
  globalMessageConfig = {
    ...globalMessageConfig,
    ...options,
  }

  syncGlobalMessageHolder()
}

type MessageCompound = FC<MessageProps> & {
  Item: FC<MessageItemProps>
  useMessage: (options?: MessageUseMessageOptions) => readonly [MessageInstance, any]
  open: (config: MessageOpenConfig) => MessageHandle
  success: (...args: MessageArgTuple) => MessageHandle
  info: (...args: MessageArgTuple) => MessageHandle
  warning: (...args: MessageArgTuple) => MessageHandle
  error: (...args: MessageArgTuple) => MessageHandle
  loading: (...args: MessageArgTuple) => MessageHandle
  destroy: (key?: MessageKey) => void
  config: (options: MessageConfigOptions) => void
}

const MessageCompound: MessageCompound = Object.assign(Message, {
  Item: MessageItem,
  useMessage,
  open: openGlobalMessage,
  success: (...args: MessageArgTuple) => {
    return openGlobalMessage({ ...normalizeMessageArgs(...args), type: 'success' })
  },
  info: (...args: MessageArgTuple) => {
    return openGlobalMessage({ ...normalizeMessageArgs(...args), type: 'info' })
  },
  warning: (...args: MessageArgTuple) => {
    return openGlobalMessage({ ...normalizeMessageArgs(...args), type: 'warning' })
  },
  error: (...args: MessageArgTuple) => {
    return openGlobalMessage({ ...normalizeMessageArgs(...args), type: 'error' })
  },
  loading: (...args: MessageArgTuple) => {
    const config = normalizeMessageArgs(...args)
    return openGlobalMessage({
      ...config,
      type: 'loading',
      duration: config.duration ?? MESSAGE_DEFAULT_LOADING_DURATION,
    })
  },
  destroy: destroyGlobalMessage,
  config: setGlobalMessageConfig,
})

export default MessageCompound
