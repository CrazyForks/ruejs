/*
Chat 组件概述
- 保留 daisyUI chat 视觉语义：start/end 布局、chat-bubble 颜色与复合子组件结构。
- 增强 Rue 语义 API：支持单条消息 props、items 数据驱动别名、头像快捷写法与 typing 气泡。
- 兼容旧版 children 组合：已有 demo 不需要重写结构即可继续工作。
*/
import type { FC } from '@rue-js/rue'

export type ChatPlacement = 'start' | 'end'
export type BubbleColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export interface ChatPartProps {
  className?: string
  children?: any
}

export interface ChatAvatarConfig {
  src?: string
  alt?: string
  className?: string
  bodyClassName?: string
  imgClassName?: string
  content?: any
  children?: any
}

export interface ChatSemanticMessageProps {
  placement?: ChatPlacement
  className?: string
  message?: any
  text?: any
  color?: BubbleColor
  bubbleClassName?: string
  avatar?: any
  avatarSrc?: string
  avatarAlt?: string
  avatarClassName?: string
  avatarBodyClassName?: string
  avatarImgClassName?: string
  imageSrc?: string
  imageAlt?: string
  imageClassName?: string
  header?: any
  author?: any
  headerName?: any
  timestamp?: any
  headerTime?: any
  headerClassName?: string
  footer?: any
  footerClassName?: string
  typing?: boolean
  typingIndicator?: any
}

export interface ChatDataItem extends ChatSemanticMessageProps {
  key?: string | number
}

export interface ChatProps extends ChatSemanticMessageProps {
  children?: any
  items?: ReadonlyArray<ChatDataItem>
}

export interface BubbleProps extends ChatPartProps {
  color?: BubbleColor
  typing?: boolean
  typingIndicator?: any
}

export interface HeaderProps extends ChatPartProps {
  author?: any
  time?: any
  timeClassName?: string
}

export interface ImageProps extends ChatPartProps {
  src?: string
  alt?: string
  bodyClassName?: string
  imgClassName?: string
}

const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const hasRenderableNode = (value: any): boolean => {
  if (Array.isArray(value)) {
    return value.some(item => hasRenderableNode(item))
  }
  return value !== null && value !== undefined && value !== false
}

const resolvePlacement = (placement?: ChatPlacement) => {
  return placement ?? 'start'
}

const isAvatarConfig = (value: any): value is ChatAvatarConfig => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return (
    'src' in value ||
    'alt' in value ||
    'className' in value ||
    'bodyClassName' in value ||
    'imgClassName' in value ||
    'content' in value ||
    'children' in value
  )
}

const hasSemanticMessage = (message: ChatSemanticMessageProps) => {
  return (
    message.message != null ||
    message.text != null ||
    message.color != null ||
    message.bubbleClassName != null ||
    message.avatar != null ||
    message.avatarSrc != null ||
    message.imageSrc != null ||
    message.header != null ||
    message.author != null ||
    message.headerName != null ||
    message.timestamp != null ||
    message.headerTime != null ||
    message.headerClassName != null ||
    message.footer != null ||
    message.footerClassName != null ||
    message.typing === true ||
    message.typingIndicator != null
  )
}

const resolveMessageText = (message: ChatSemanticMessageProps) => {
  return message.message ?? message.text
}

/** 气泡子组件：支持颜色类与 typing 态。 */
const Bubble: FC<BubbleProps> = ({ color, className, children, typing, typingIndicator }) => {
  const bubbleClassName = appendClassName(
    color ? `chat-bubble chat-bubble-${color}` : 'chat-bubble',
    className,
  )

  return (
    <div className={bubbleClassName}>
      {typing ? (
        typingIndicator ?? <span className="loading loading-dots loading-xs" aria-label="Typing" />
      ) : (
        children
      )}
    </div>
  )
}

/** 头部子组件：支持 author/time 的语义快捷写法。 */
const Header: FC<HeaderProps> = ({ className, children, author, time, timeClassName }) => {
  const headerClassName = appendClassName('chat-header', className)

  if (hasRenderableNode(children)) {
    return <div className={headerClassName}>{children}</div>
  }

  if (author == null && time == null) {
    return null
  }

  return (
    <div className={headerClassName}>
      {author}
      {time != null ? (
        <time className={appendClassName('text-xs opacity-50', timeClassName)}>{time}</time>
      ) : null}
    </div>
  )
}

/** 脚注子组件：保留 chat-footer 语义。 */
const Footer: FC<ChatPartProps> = ({ className, children }) => {
  if (!hasRenderableNode(children)) {
    return null
  }
  return <div className={appendClassName('chat-footer', className)}>{children}</div>
}

/** 头像子组件：支持沿用旧版 children，也支持 src 快捷写法。 */
const Image: FC<ImageProps> = ({ className, children, src, alt, bodyClassName, imgClassName }) => {
  const needsAvatarShell = src != null || bodyClassName != null || imgClassName != null
  const imageClassName = appendClassName(
    needsAvatarShell ? 'chat-image avatar' : 'chat-image',
    className,
  )

  if (hasRenderableNode(children)) {
    return <div className={imageClassName}>{children}</div>
  }

  if (src == null) {
    return null
  }

  return (
    <div className={imageClassName}>
      <div className={bodyClassName ?? 'w-10 rounded-full'}>
        <img alt={alt ?? 'chat image'} className={imgClassName} src={src} />
      </div>
    </div>
  )
}

const renderAvatar = (message: ChatSemanticMessageProps) => {
  const avatarSrc = message.avatarSrc ?? message.imageSrc
  const avatarAlt = message.avatarAlt ?? message.imageAlt
  const avatarClassName = message.avatarClassName ?? message.imageClassName

  if (message.avatar != null) {
    if (isAvatarConfig(message.avatar)) {
      return (
        <Image
          className={appendClassName(avatarClassName ?? '', message.avatar.className)}
          src={message.avatar.src ?? avatarSrc}
          alt={message.avatar.alt ?? avatarAlt}
          bodyClassName={message.avatar.bodyClassName ?? message.avatarBodyClassName}
          imgClassName={message.avatar.imgClassName ?? message.avatarImgClassName}
        >
          {message.avatar.content ?? message.avatar.children}
        </Image>
      )
    }

    return <Image className={avatarClassName}>{message.avatar}</Image>
  }

  if (avatarSrc != null) {
    return (
      <Image
        className={avatarClassName}
        src={avatarSrc}
        alt={avatarAlt}
        bodyClassName={message.avatarBodyClassName}
        imgClassName={message.avatarImgClassName}
      />
    )
  }

  return null
}

const renderHeader = (message: ChatSemanticMessageProps) => {
  if (message.header != null) {
    return <Header className={message.headerClassName}>{message.header}</Header>
  }

  const author = message.author ?? message.headerName
  const time = message.timestamp ?? message.headerTime

  if (author == null && time == null) {
    return null
  }

  return <Header className={message.headerClassName} author={author} time={time} />
}

const renderSemanticMessage = (message: ChatSemanticMessageProps, key?: string | number) => {
  const messageText = resolveMessageText(message)
  const placement = resolvePlacement(message.placement)
  const rootClassName = appendClassName(`chat chat-${placement}`, message.className)

  return (
    <div className={rootClassName} key={key}>
      {renderAvatar(message)}
      {renderHeader(message)}
      {messageText != null || message.typing ? (
        <Bubble
          className={message.bubbleClassName}
          color={message.color}
          typing={message.typing}
          typingIndicator={message.typingIndicator}
        >
          {messageText}
        </Bubble>
      ) : null}
      <Footer className={message.footerClassName}>{message.footer}</Footer>
    </div>
  )
}

/** 聊天气泡容器：支持数据驱动、语义化单条消息与旧版 children 组合。 */
const Chat: FC<ChatProps> = ({
  placement,
  className,
  children,
  items,
  message,
  text,
  color,
  bubbleClassName,
  avatar,
  avatarSrc,
  avatarAlt,
  avatarClassName,
  avatarBodyClassName,
  avatarImgClassName,
  imageSrc,
  imageAlt,
  imageClassName,
  header,
  author,
  headerName,
  timestamp,
  headerTime,
  headerClassName,
  footer,
  footerClassName,
  typing,
  typingIndicator,
}) => {
  if (items && items.length) {
    return (
      <>
        {items.map((item, index) =>
          renderSemanticMessage(
            {
              ...item,
              placement: resolvePlacement(item.placement),
              className: appendClassName(className ?? '', item.className),
            },
            item.key ?? index,
          ),
        )}
      </>
    )
  }

  if (!hasRenderableNode(children) && hasSemanticMessage({
    placement,
    className,
    message,
    text,
    color,
    bubbleClassName,
    avatar,
    avatarSrc,
    avatarAlt,
    avatarClassName,
    avatarBodyClassName,
    avatarImgClassName,
    imageSrc,
    imageAlt,
    imageClassName,
    header,
    author,
    headerName,
    timestamp,
    headerTime,
    headerClassName,
    footer,
    footerClassName,
    typing,
    typingIndicator,
  })) {
    return renderSemanticMessage({
      placement,
      className,
      message,
      text,
      color,
      bubbleClassName,
      avatar,
      avatarSrc,
      avatarAlt,
      avatarClassName,
      avatarBodyClassName,
      avatarImgClassName,
      imageSrc,
      imageAlt,
      imageClassName,
      header,
      author,
      headerName,
      timestamp,
      headerTime,
      headerClassName,
      footer,
      footerClassName,
      typing,
      typingIndicator,
    })
  }

  return <div className={appendClassName(`chat chat-${resolvePlacement(placement)}`, className)}>{children}</div>
}

type ChatCompound = FC<ChatProps> & {
  Bubble: FC<BubbleProps>
  Header: FC<HeaderProps>
  Footer: FC<ChatPartProps>
  Image: FC<ImageProps>
}

const ChatCompound: ChatCompound = Object.assign(Chat, {
  Bubble,
  Header,
  Footer,
  Image,
})

export default ChatCompound
