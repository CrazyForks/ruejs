/*
Steps 模块概述
- 汇总步骤条组件的公开类型、渲染入口和局部工具逻辑。
- 导出注释用于 API 文档生成，内部注释标明状态归一化、样式映射与 DOM 交互边界。
*/
import { h, type FC } from '@rue-js/rue'

/** StepsDirection 位置或方向类型。 */
export type StepsDirection = 'vertical' | 'horizontal'
/** StepColor 语义色类型。 */
export type StepColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
/** StepStatus 状态类型。 */
export type StepStatus = 'wait' | 'process' | 'finish' | 'error'

/** StepsProgressDotInfo 接口。 */
export interface StepsProgressDotInfo {
  /** index 配置项。 */
  index: number
  /** 组件状态。 */
  status: StepStatus
  /** 标题内容。 */
  title?: any
  /** 描述内容。 */
  description?: any
  /** 主体内容。 */
  content?: any
}

/** StepsProgressDotRender 自定义渲染函数类型。 */
export type StepsProgressDotRender = (iconDot: any, info: StepsProgressDotInfo) => any

/** StepSharedProps 组件属性。 */
export interface StepSharedProps {
  /** 组件语义色。 */
  color?: StepColor
  /** 根节点附加类名。 */
  className?: string
  /** 标题内容。 */
  title?: any
  /** 描述内容。 */
  description?: any
  /** 主体内容。 */
  content?: any
  /** subTitle 配置项。 */
  subTitle?: any
  /** 图标内容。 */
  icon?: any
  /** 组件状态。 */
  status?: StepStatus
  /** 是否禁用交互。 */
  disabled?: boolean
  /** clickable 配置项。 */
  clickable?: boolean
  /** dataContent 配置项。 */
  dataContent?: string
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** StepItem 数据项结构。 */
export interface StepItem extends StepSharedProps {
  /** 数据项唯一标识。 */
  key?: string | number
  /** 点击时触发的回调。 */
  onClick?: (event: MouseEvent, index: number) => void
}

/** StepsProps 组件属性。 */
export interface StepsProps {
  /** 自定义渲染的宿主元素。 */
  as?: any
  /** 布局方向。 */
  direction?: StepsDirection
  /** orientation 配置项。 */
  orientation?: StepsDirection
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
  /** 数据驱动渲染项。 */
  items?: ReadonlyArray<StepItem>
  /** current 配置项。 */
  current?: number
  /** 组件状态。 */
  status?: StepStatus
  /** progressDot 配置项。 */
  progressDot?: boolean | StepsProgressDotRender
  /** 值或状态变化时触发的回调。 */
  onChange?: (current: number) => void
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** StepProps 组件属性。 */
export interface StepProps extends StepSharedProps {
  /** 自定义渲染的宿主元素。 */
  as?: any
  /** index 配置项。 */
  index?: number
  /** 点击时触发的回调。 */
  onClick?: (event: MouseEvent, index?: number) => void
  /** onKeyDown 事件回调。 */
  onKeyDown?: (event: KeyboardEvent) => void
}

/** StepIconProps 组件属性。 */
export interface StepIconProps {
  /** 自定义渲染的宿主元素。 */
  as?: any
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** join Class Name 的内部工具函数。 */
const joinClassName = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ')

/** 转换为 Child Array 的内部工具函数。 */
const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null || typeof children === 'boolean' ? [] : [children]
}

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

/** 解析 Direction 的内部工具函数。 */
const resolveDirection = (direction?: StepsDirection, orientation?: StepsDirection) =>
  orientation ?? direction

/** 读取 Status Color 的内部工具函数。 */
const getStatusColor = (status?: StepStatus, color?: StepColor) => {
  if (color) return color
  if (status === 'error') return 'error'
  if (status === 'finish' || status === 'process') return 'primary'
  return undefined
}

/** 读取 Default Data Content 的内部工具函数。 */
const getDefaultDataContent = (status?: StepStatus, hasIcon?: boolean) => {
  if (hasIcon) return undefined
  if (status === 'finish') return '✓'
  if (status === 'error') return '✕'
  return undefined
}

/** prevent Event 的内部工具函数。 */
const preventEvent = (event: MouseEvent | KeyboardEvent) => {
  if (typeof event.preventDefault === 'function') event.preventDefault()
  if (typeof event.stopPropagation === 'function') event.stopPropagation()
}

/** Dot Icon 的内部工具函数。 */
const DotIcon: FC<{ status?: StepStatus }> = ({ status }) => {
  const cls =
    status === 'wait'
      ? 'inline-block size-2.5 rounded-full border border-base-300 bg-base-100'
      : 'inline-block size-2.5 rounded-full bg-current'
  return <span className={cls} />
}

/** 渲染 Progress Dot 的内部工具函数。 */
const renderProgressDot = (progressDot: StepsProps['progressDot'], info: StepsProgressDotInfo) => {
  if (!progressDot) return undefined
  const dotNode = <DotIcon status={info.status} />
  if (typeof progressDot === 'function') {
    return progressDot(dotNode, info)
  }
  return dotNode
}

/** 解析 Item Status 的内部工具函数。 */
const resolveItemStatus = (
  item: StepItem,
  index: number,
  current?: number,
  currentStatus?: StepStatus,
): StepStatus => {
  if (item.status) return item.status
  if (typeof current !== 'number') return 'wait'
  if (index < current) return 'finish'
  if (index === current) return currentStatus ?? 'process'
  return 'wait'
}

/** 渲染 Tag 的内部工具函数。 */
const renderTag = (as: any, props: Record<string, any>, children?: any) => {
  const nextChildren = toChildArray(children)
  return h(as, props, ...nextChildren)
}

/** Step 的内部工具函数。 */
const Step: FC<StepProps> = ({
  as = 'li',
  color,
  className,
  title,
  description,
  content,
  subTitle,
  icon,
  status,
  disabled,
  clickable,
  dataContent,
  children,
  index,
  onClick,
  onKeyDown,
  ...rest
}) => {
  const Component = as as any
  const detail = content ?? description
  const heading = title ?? children
  const interactive = clickable ?? !!onClick
  const resolvedColor = getStatusColor(status, color)
  const explicitDataContent = dataContent ?? rest['data-content']
  const resolvedDataContent = explicitDataContent ?? getDefaultDataContent(status, icon != null)
  const hasStructuredBody = title != null || detail != null || subTitle != null || icon != null
  const ariaCurrent = rest['aria-current'] ?? (status === 'process' ? 'step' : undefined)
  const ariaDisabled = disabled ? 'true' : undefined

  let cls = 'step'
  if (resolvedColor) cls += ` step-${resolvedColor}`
  if (interactive && !disabled) cls += ' cursor-pointer'
  if (disabled) cls += ' opacity-50'
  if (interactive && disabled) cls += ' cursor-not-allowed'

  const handleClick = (event: MouseEvent) => {
    if (disabled) {
      preventEvent(event)
      return
    }
    if (onClick) onClick(event, index)
  }

  const role = interactive ? (rest.role ?? 'button') : rest.role
  const tabIndex = interactive ? (rest.tabIndex ?? (disabled ? -1 : 0)) : rest.tabIndex
  const keyDownHandler = interactive
    ? (event: KeyboardEvent) => {
        if (onKeyDown) onKeyDown(event)
        if (event.defaultPrevented || disabled) {
          if (disabled) preventEvent(event)
          return
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleClick(event as unknown as MouseEvent)
        }
      }
    : rest.onKeyDown
  const clickHandler = interactive ? handleClick : rest.onClick
  const body = hasStructuredBody ? (
    <>
      {icon != null ? (
        <span
          className={mergeClassName('step-icon', detail != null ? 'mt-0.5' : undefined)}
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <span className="inline-flex min-w-0 flex-col gap-1 py-1 text-start">
        {heading != null || subTitle != null ? (
          <span className="flex flex-wrap items-center gap-2 leading-tight">
            {heading != null ? <span className="font-medium">{heading}</span> : null}
            {subTitle != null ? <span className="text-xs opacity-60">{subTitle}</span> : null}
          </span>
        ) : null}
        {detail != null ? <span className="text-xs leading-snug opacity-70">{detail}</span> : null}
      </span>
    </>
  ) : (
    children
  )

  return renderTag(
    Component,
    {
      ...rest,
      className: mergeClassName(cls, className),
      ...(resolvedDataContent != null ? { 'data-content': resolvedDataContent } : {}),
      role,
      tabIndex,
      onClick: clickHandler,
      onKeyDown: keyDownHandler,
      'aria-current': ariaCurrent,
      'aria-disabled': ariaDisabled,
    },
    body,
  )
}

/** Icon 的内部工具函数。 */
const Icon: FC<StepIconProps> = ({ as = 'span', className, children, ...rest }) => {
  const Component = as as any
  return renderTag(
    Component,
    {
      ...rest,
      className: mergeClassName('step-icon', className),
    },
    children,
  )
}

/** Steps Root 的内部工具函数。 */
const StepsRoot: FC<StepsProps> = ({
  as = 'ul',
  direction,
  orientation,
  className,
  children,
  items,
  current,
  status,
  progressDot,
  onChange,
  ...rest
}) => {
  const Component = as as any
  const resolvedDirection = resolveDirection(direction, orientation)
  const renderedItems =
    items && items.length > 0
      ? items.map((item, index) => {
          const itemStatus = resolveItemStatus(item, index, current, status)
          const itemIcon =
            item.icon ??
            renderProgressDot(progressDot, {
              index,
              status: itemStatus,
              title: item.title,
              description: item.description,
              content: item.content,
            })
          const mergedClickable = item.clickable ?? (!!onChange || !!item.onClick)

          return (
            <Step
              key={item.key ?? index}
              {...item}
              index={index}
              status={itemStatus}
              color={getStatusColor(itemStatus, item.color)}
              icon={itemIcon}
              clickable={mergedClickable}
              aria-current={
                index === current ? (item['aria-current'] ?? 'step') : item['aria-current']
              }
              onClick={(event, clickedIndex) => {
                if (item.disabled) return
                if (item.onClick && typeof clickedIndex === 'number')
                  item.onClick(event, clickedIndex)
                if (onChange && typeof clickedIndex === 'number' && clickedIndex !== current) {
                  onChange(clickedIndex)
                }
              }}
            />
          )
        })
      : children

  let cls = 'steps'
  if (resolvedDirection) cls += ` steps-${resolvedDirection}`

  return renderTag(
    Component,
    {
      ...rest,
      className: joinClassName(cls, className),
    },
    renderedItems,
  )
}

type StepsCompound = FC<StepsProps> & {
  Step: FC<StepProps>
  Icon: FC<StepIconProps>
}

const StepsCompound: StepsCompound = Object.assign(StepsRoot, {
  Step,
  Icon,
})

/** 默认导出步骤条组件。 */
export default StepsCompound
