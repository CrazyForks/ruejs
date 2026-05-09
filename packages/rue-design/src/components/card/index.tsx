/* RUE_VAPOR_TRANSFORMED */
/*
Card 组件概述
- 保留 rue 现有的低层 card class 组合能力，同时补一层更顺手的语义化 API。
- 根组件支持 title、extra、cover、actions、loading、tabs、variant、type 等能力。
- 复合组件同时提供 Body/Title/Actions/Figure 低层拼装，以及 Meta/Grid 两个增强子组件。
*/
import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'medium' | 'middle' | 'large'

export type CardVariant = 'outlined' | 'borderless' | 'dashed'
export type CardType = 'default' | 'inner'
export type CardTabStyle = 'box' | 'border' | 'lift'
export type CardTabPlacement = 'top' | 'bottom'

export interface CardTabItem {
  key: string
  label?: any
  tab?: any
  disabled?: boolean
  className?: string
}

export interface CardTabProps {
  style?: CardTabStyle
  placement?: CardTabPlacement
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export interface CardProps {
  size?: CardSize
  border?: boolean
  bordered?: boolean
  dash?: boolean
  side?: boolean
  imageFull?: boolean
  variant?: CardVariant
  type?: CardType
  hoverable?: boolean
  loading?: boolean
  title?: any
  extra?: any
  cover?: any
  actions?: any[]
  tabList?: CardTabItem[]
  activeTabKey?: string
  defaultActiveTabKey?: string
  tabBarExtraContent?: any
  tabProps?: CardTabProps
  onTabChange?: (key: string) => void
  className?: string
  style?: any
  headerClassName?: string
  headerStyle?: any
  bodyClassName?: string
  bodyStyle?: any
  coverClassName?: string
  coverStyle?: any
  actionsClassName?: string
  actionsStyle?: any
  titleClassName?: string
  titleStyle?: any
  extraClassName?: string
  extraStyle?: any
  children?: any
  [key: string]: any
}

export interface CardPartProps {
  className?: string
  style?: any
  children?: any
  [key: string]: any
}

export interface CardGridProps {
  className?: string
  style?: any
  hoverable?: boolean
  children?: any
  [key: string]: any
}

export interface CardMetaProps {
  className?: string
  style?: any
  avatar?: any
  avatarClassName?: string
  avatarStyle?: any
  title?: any
  titleClassName?: string
  titleStyle?: any
  description?: any
  descriptionClassName?: string
  descriptionStyle?: any
  children?: any
  [key: string]: any
}

const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

/**
 * 统一兼容 daisyUI 的尺寸类与更语义化的别名，避免设计页和业务代码记忆两套命名。
 */
const resolveSizeClass = (size?: CardSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'medium':
    case 'middle':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

/** 将语义变体映射到 rue 当前 card 的边框体系。 */
const resolveVariantClass = (variant?: CardVariant) => {
  switch (variant) {
    case 'outlined':
      return 'card-border'
    case 'dashed':
      return 'card-dash'
    default:
      return ''
  }
}

/** tabs 若未显式传入尺寸，沿用 card 的尺寸映射。 */
const resolveTabSize = (size?: CardSize) => {
  const resolved = resolveSizeClass(size)
  switch (resolved) {
    case 'xs':
    case 'sm':
    case 'md':
    case 'lg':
    case 'xl':
      return resolved
    default:
      return undefined
  }
}

/** Card 内部 tabs 与独立 Tabs 组件保持同一套 class 语义。 */
const buildTabsClassName = (
  style?: CardTabStyle,
  placement?: CardTabPlacement,
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl',
  className?: string,
) => {
  let cls = 'tabs'
  if (style === 'box') cls += ' tabs-box'
  if (style === 'border') cls += ' tabs-border'
  if (style === 'lift') cls += ' tabs-lift'
  if (placement === 'bottom') cls += ' tabs-bottom'
  if (size) cls += ` tabs-${size}`
  if (className) cls += ` ${className}`
  return cls
}

/** 非受控模式下直接同步当前按钮的激活态，避免依赖额外重渲染。 */
const syncUncontrolledTabClasses = (button?: HTMLButtonElement | null) => {
  if (!button) return
  const root = button.closest('[data-rue-card-tabs]')
  if (!root) return

  root.querySelectorAll('button.tab').forEach(node => {
    node.classList.remove('tab-active')
  })
  button.classList.add('tab-active')
}

/** loading 骨架保持足够轻量，不引入额外组件依赖。 */
const LoadingPlaceholder: FC<{ size?: CardSize }> = ({ size }) => {
  const resolved = resolveSizeClass(size)
  const lineCount = resolved === 'xs' ? 2 : resolved === 'xl' ? 4 : 3
  const widthMap = ['w-4/5', 'w-full', 'w-3/4', 'w-2/3']

  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="skeleton h-5 w-2/5 rounded-full" />
      {Array.from({ length: lineCount }).map((_, index) => (
        <div
          key={`line-${index}`}
          className={`skeleton h-4 rounded-full ${widthMap[index % widthMap.length]}`.trim()}
        />
      ))}
    </div>
  )
}

/** 卡片主体区域。 */
const Body: FC<CardPartProps> = ({ className, style, children, ...rest }) => {
  return (
    <div {...rest} className={appendClassName('card-body', className)} style={style}>
      {children}
    </div>
  )
}

/** 卡片标题区域。 */
const Title: FC<CardPartProps> = ({ className, style, children, ...rest }) => {
  return (
    <h2 {...rest} className={appendClassName('card-title', className)} style={style}>
      {children}
    </h2>
  )
}

/** 卡片操作区域。 */
const Actions: FC<CardPartProps> = ({ className, style, children, ...rest }) => {
  return (
    <div {...rest} className={appendClassName('card-actions', className)} style={style}>
      {children}
    </div>
  )
}

/** 卡片媒体区域（figure）。 */
const Figure: FC<CardPartProps> = ({ className, style, children, ...rest }) => {
  return (
    <figure {...rest} className={appendClassName('figure', className)} style={style}>
      {children}
    </figure>
  )
}

/**
 * Grid 子卡片用于信息概览、快捷入口等密集场景。
 * hoverable 默认开启，保持与 antd Card.Grid 类似的交互预期。
 */
const Grid: FC<CardGridProps> = ({ className, style, hoverable = true, children, ...rest }) => {
  let cls = 'rue-card-grid block bg-base-100/70 p-5'
  if (hoverable) {
    cls +=
      ' transition duration-200 ease-out hover:bg-base-100 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]'
  }
  if (className) cls += ` ${className}`

  return (
    <div {...rest} className={cls} style={style}>
      {children}
    </div>
  )
}

/** Meta 统一头像、标题、描述的排列，适合列表卡片和资料卡片。 */
const Meta: FC<CardMetaProps> = ({
  className,
  style,
  avatar,
  avatarClassName,
  avatarStyle,
  title,
  titleClassName,
  titleStyle,
  description,
  descriptionClassName,
  descriptionStyle,
  children,
  ...rest
}) => {
  return (
    <div
      {...rest}
      className={appendClassName('rue-card-meta flex items-start gap-4', className)}
      style={style}
    >
      {avatar != null ? (
        <div
          className={appendClassName('rue-card-meta-avatar shrink-0', avatarClassName)}
          style={avatarStyle}
        >
          {avatar}
        </div>
      ) : null}
      {title != null || description != null || children != null ? (
        <div className="min-w-0 flex-1 space-y-1">
          {title != null ? (
            <div
              className={appendClassName(
                'rue-card-meta-title truncate text-base font-semibold leading-6',
                titleClassName,
              )}
              style={titleStyle}
            >
              {title}
            </div>
          ) : null}
          {description != null ? (
            <div
              className={appendClassName(
                'rue-card-meta-description text-sm leading-6 opacity-75',
                descriptionClassName,
              )}
              style={descriptionStyle}
            >
              {description}
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 根组件策略：
 * 1. 没有语义化 props 时，保持完全低层的 children 透传，兼容既有 demo 与业务代码。
 * 2. 一旦启用 title/extra/cover/actions/loading/tabs 等增强能力，就自动装配 header/body/actions 结构。
 */
const Card: FC<CardProps> = ({
  size,
  border,
  bordered,
  dash,
  side,
  imageFull,
  variant,
  type = 'default',
  hoverable,
  loading,
  title,
  extra,
  cover,
  actions,
  tabList,
  activeTabKey,
  defaultActiveTabKey,
  tabBarExtraContent,
  tabProps,
  onTabChange,
  className,
  style,
  headerClassName,
  headerStyle,
  bodyClassName,
  bodyStyle,
  coverClassName,
  coverStyle,
  actionsClassName,
  actionsStyle,
  titleClassName,
  titleStyle,
  extraClassName,
  extraStyle,
  children,
  ...rest
}) => {
  const resolvedSize = resolveSizeClass(size)
  const normalizedTabItems =
    tabList?.map(item => ({
      key: item.key,
      label: item.label ?? item.tab ?? item.key,
      disabled: item.disabled,
      className: item.className,
    })) ?? []
  const normalizedActions = actions ?? []
  const uncontrolledActiveKey = ref(defaultActiveTabKey ?? normalizedTabItems[0]?.key ?? '')
  const mergedActiveKey =
    activeTabKey ?? uncontrolledActiveKey.value ?? normalizedTabItems[0]?.key ?? ''
  const hasStructuredSlots =
    title != null ||
    extra != null ||
    cover != null ||
    !!loading ||
    normalizedActions.length > 0 ||
    normalizedTabItems.length > 0 ||
    tabBarExtraContent != null

  const handleTabChange = (key: string, event?: MouseEvent) => {
    if (activeTabKey === undefined) {
      uncontrolledActiveKey.value = key
      syncUncontrolledTabClasses(
        (event?.currentTarget ?? event?.target) as HTMLButtonElement | null,
      )
    }
    if (onTabChange) onTabChange(key)
  }

  let cls = 'card'
  if (resolvedSize) cls += ` card-${resolvedSize}`
  if (border || bordered) cls += ' card-border'
  if (dash) cls += ' card-dash'
  if (side) cls += ' card-side'
  if (imageFull) cls += ' image-full'
  if (variant && resolveVariantClass(variant)) cls += ` ${resolveVariantClass(variant)}`
  if (type === 'inner') cls += ' border border-base-300 bg-base-200/60 shadow-none'
  if (hoverable) {
    cls +=
      ' transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_22px_60px_-36px_rgba(15,23,42,0.55)]'
  }
  if (className) cls += ` ${className}`

  const tabsNode = normalizedTabItems.length ? (
    <div
      role="tablist"
      data-rue-card-tabs
      className={buildTabsClassName(
        tabProps?.style ?? 'border',
        tabProps?.placement,
        tabProps?.size ?? resolveTabSize(size),
        tabProps?.className,
      )}
    >
      {normalizedTabItems.map(item => (
        <button
          type="button"
          role="tab"
          key={item.key}
          className={`tab ${mergedActiveKey === item.key ? 'tab-active' : ''} ${item.disabled ? 'tab-disabled' : ''} ${item.className ?? ''}`.trim()}
          disabled={item.disabled}
          onClick={(event: MouseEvent) => {
            if (item.disabled) return
            handleTabChange(item.key, event as any)
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null

  return (
    <div {...rest} className={cls} style={style}>
      {hasStructuredSlots ? (
        <>
          {title != null || extra != null || tabsNode != null || tabBarExtraContent != null ? (
            <div
              className={appendClassName(
                'rue-card-header border-base-300/80 border-b px-6 py-4',
                headerClassName,
              )}
              style={headerStyle}
            >
              {title != null || extra != null ? (
                <div className="flex flex-wrap items-center gap-3">
                  {title != null ? (
                    <div
                      className={appendClassName(
                        'min-w-0 flex-1 text-base font-semibold leading-6',
                        titleClassName,
                      )}
                      style={titleStyle}
                    >
                      {title}
                    </div>
                  ) : null}
                  {extra != null ? (
                    <div
                      className={appendClassName('shrink-0 text-sm opacity-80', extraClassName)}
                      style={extraStyle}
                    >
                      {extra}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {tabsNode != null || tabBarExtraContent != null ? (
                <div
                  className={`flex flex-wrap items-center gap-3 ${title != null || extra != null ? 'mt-4' : ''}`.trim()}
                >
                  {tabsNode != null ? (
                    <div className="min-w-0 flex-1">{tabsNode}</div>
                  ) : (
                    <div className="flex-1" />
                  )}
                  {tabBarExtraContent != null ? (
                    <div className="shrink-0">{tabBarExtraContent}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {cover != null ? (
            <figure
              className={appendClassName('rue-card-cover overflow-hidden', coverClassName)}
              style={coverStyle}
            >
              {cover}
            </figure>
          ) : null}

          {loading || children != null ? (
            <div className={appendClassName('card-body', bodyClassName)} style={bodyStyle}>
              {loading ? <LoadingPlaceholder size={size} /> : children}
            </div>
          ) : null}

          {normalizedActions.length ? (
            <ul
              className={appendClassName(
                'rue-card-actions border-base-300/80 flex divide-x divide-base-300/80 border-t bg-base-200/40',
                actionsClassName,
              )}
              style={actionsStyle}
            >
              {normalizedActions.map((action, index) => (
                <li key={`action-${index}`} className="flex-1">
                  <div className="flex h-full items-center justify-center px-4 py-3 text-sm">
                    {action}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        children
      )}
    </div>
  )
}

type CardCompound = FC<CardProps> & {
  Body: FC<CardPartProps>
  Title: FC<CardPartProps>
  Actions: FC<CardPartProps>
  Figure: FC<CardPartProps>
  Grid: FC<CardGridProps>
  Meta: FC<CardMetaProps>
}

const CardCompound: CardCompound = Object.assign(Card, {
  Body,
  Title,
  Actions,
  Figure,
  Grid,
  Meta,
})

export default CardCompound
