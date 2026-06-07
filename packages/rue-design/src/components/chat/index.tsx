/* RUE_VAPOR_TRANSFORMED */
/*
Chat 组件概述
- 保留 daisyUI chat 视觉语义：start/end 布局、chat-bubble 颜色与复合子组件结构。
- 增强 Rue 语义 API：支持单条消息 props、items 数据驱动别名、头像快捷写法与 typing 气泡。
- 兼容旧版 children 组合：已有 demo 不需要重写结构即可继续工作。
*/
import type { FC } from '@rue-js/rue'

/** ChatPlacement 位置或方向类型。 */
export type ChatPlacement = 'start' | 'end'
/** BubbleColor 语义色类型。 */
export type BubbleColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

/** ChatPartProps 组件属性。 */
export interface ChatPartProps {
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
}

/** ChatAvatarConfig 配置对象。 */
export interface ChatAvatarConfig {
  /** src 配置项。 */
  src?: string
  /** alt 配置项。 */
  alt?: string
  /** 根节点附加类名。 */
  className?: string
  /** bodyClassName 附加类名。 */
  bodyClassName?: string
  /** imgClassName 附加类名。 */
  imgClassName?: string
  /** 主体内容。 */
  content?: any
  /** 组件子内容。 */
  children?: any
}

/** ChatSemanticMessageProps 组件属性。 */
export interface ChatSemanticMessageProps {
  /** 弹出层或内容展示位置。 */
  placement?: ChatPlacement
  /** 根节点附加类名。 */
  className?: string
  /** message 配置项。 */
  message?: any
  /** text 区域配置。 */
  text?: any
  /** 组件语义色。 */
  color?: BubbleColor
  /** bubbleClassName 附加类名。 */
  bubbleClassName?: string
  /** avatar 配置项。 */
  avatar?: any
  /** avatarSrc 配置项。 */
  avatarSrc?: string
  /** avatarAlt 配置项。 */
  avatarAlt?: string
  /** avatarClassName 附加类名。 */
  avatarClassName?: string
  /** avatarBodyClassName 附加类名。 */
  avatarBodyClassName?: string
  /** avatarImgClassName 附加类名。 */
  avatarImgClassName?: string
  /** imageSrc 配置项。 */
  imageSrc?: string
  /** imageAlt 配置项。 */
  imageAlt?: string
  /** imageClassName 附加类名。 */
  imageClassName?: string
  /** 头部区域内容。 */
  header?: any
  /** author 配置项。 */
  author?: any
  /** headerName 配置项。 */
  headerName?: any
  /** timestamp 配置项。 */
  timestamp?: any
  /** headerTime 配置项。 */
  headerTime?: any
  /** headerClassName 附加类名。 */
  headerClassName?: string
  /** 底部区域内容。 */
  footer?: any
  /** footerClassName 附加类名。 */
  footerClassName?: string
  /** typing 配置项。 */
  typing?: boolean
  /** typingIndicator 配置项。 */
  typingIndicator?: any
}

/** ChatDataItem 数据项结构。 */
export interface ChatDataItem extends ChatSemanticMessageProps {
  /** 数据项唯一标识。 */
  key?: string | number
}

/** ChatProps 组件属性。 */
export interface ChatProps extends ChatSemanticMessageProps {
  /** 组件子内容。 */
  children?: any
  /** 数据驱动渲染项。 */
  items?: ReadonlyArray<ChatDataItem>
}

/** BubbleProps 组件属性。 */
export interface BubbleProps extends ChatPartProps {
  /** 组件语义色。 */
  color?: BubbleColor
  /** typing 配置项。 */
  typing?: boolean
  /** typingIndicator 配置项。 */
  typingIndicator?: any
}

/** HeaderProps 组件属性。 */
export interface HeaderProps extends ChatPartProps {
  /** author 配置项。 */
  author?: any
  /** time 配置项。 */
  time?: any
  /** timeClassName 附加类名。 */
  timeClassName?: string
}

/** ImageProps 组件属性。 */
export interface ImageProps extends ChatPartProps {
  /** src 配置项。 */
  src?: string
  /** alt 配置项。 */
  alt?: string
  /** bodyClassName 附加类名。 */
  bodyClassName?: string
  /** imgClassName 附加类名。 */
  imgClassName?: string
}

/** append Class Name 的内部工具函数。 */
const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

/** 判断是否存在 Renderable Node 的内部工具函数。 */
const hasRenderableNode = (value: any): boolean => {
  if (Array.isArray(value)) {
    return value.some(item => hasRenderableNode(item))
  }
  return value !== null && value !== undefined && value !== false
}

/** 解析 Placement 的内部工具函数。 */
const resolvePlacement = (placement?: ChatPlacement) => {
  return placement ?? 'start'
}

/** 判断 Avatar Config 的内部工具函数。 */
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

/** 判断是否存在 Semantic Message 的内部工具函数。 */
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

/** 解析 Message Text 的内部工具函数。 */
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
      {typing
        ? (typingIndicator ?? (
            <span className="loading loading-dots loading-xs" aria-label="Typing" />
          ))
        : children}
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

/** 渲染 Avatar 的内部工具函数。 */
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

/** 渲染 Header 的内部工具函数。 */
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

/** 渲染 Semantic Message 的内部工具函数。 */
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

  if (
    !hasRenderableNode(children) &&
    hasSemanticMessage({
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
  ) {
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

  return (
    <div className={appendClassName(`chat chat-${resolvePlacement(placement)}`, className)}>
      {children}
    </div>
  )
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

/** 默认导出聊天组件。 */
export default ChatCompound
