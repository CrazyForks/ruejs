import { h, type FC } from '@rue-js/rue'

export type StepsDirection = 'vertical' | 'horizontal'
export type StepColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
export type StepStatus = 'wait' | 'process' | 'finish' | 'error'

export interface StepsProgressDotInfo {
  index: number
  status: StepStatus
  title?: any
  description?: any
  content?: any
}

export type StepsProgressDotRender = (iconDot: any, info: StepsProgressDotInfo) => any

export interface StepSharedProps {
  color?: StepColor
  className?: string
  title?: any
  description?: any
  content?: any
  subTitle?: any
  icon?: any
  status?: StepStatus
  disabled?: boolean
  clickable?: boolean
  dataContent?: string
  children?: any
  [key: string]: any
}

export interface StepItem extends StepSharedProps {
  key?: string | number
  onClick?: (event: MouseEvent, index: number) => void
}

export interface StepsProps {
  as?: any
  direction?: StepsDirection
  orientation?: StepsDirection
  className?: string
  children?: any
  items?: ReadonlyArray<StepItem>
  current?: number
  status?: StepStatus
  progressDot?: boolean | StepsProgressDotRender
  onChange?: (current: number) => void
  [key: string]: any
}

export interface StepProps extends StepSharedProps {
  as?: any
  index?: number
  onClick?: (event: MouseEvent, index?: number) => void
  onKeyDown?: (event: KeyboardEvent) => void
}

export interface StepIconProps {
  as?: any
  className?: string
  children?: any
  [key: string]: any
}

const joinClassName = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ')

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null || typeof children === 'boolean' ? [] : [children]
}

const mergeClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

const resolveDirection = (direction?: StepsDirection, orientation?: StepsDirection) =>
  orientation ?? direction

const getStatusColor = (status?: StepStatus, color?: StepColor) => {
  if (color) return color
  if (status === 'error') return 'error'
  if (status === 'finish' || status === 'process') return 'primary'
  return undefined
}

const getDefaultDataContent = (status?: StepStatus, hasIcon?: boolean) => {
  if (hasIcon) return undefined
  if (status === 'finish') return '✓'
  if (status === 'error') return '✕'
  return undefined
}

const preventEvent = (event: MouseEvent | KeyboardEvent) => {
  if (typeof event.preventDefault === 'function') event.preventDefault()
  if (typeof event.stopPropagation === 'function') event.stopPropagation()
}

const DotIcon: FC<{ status?: StepStatus }> = ({ status }) => {
  const cls =
    status === 'wait'
      ? 'inline-block size-2.5 rounded-full border border-base-300 bg-base-100'
      : 'inline-block size-2.5 rounded-full bg-current'
  return <span className={cls} />
}

const renderProgressDot = (progressDot: StepsProps['progressDot'], info: StepsProgressDotInfo) => {
  if (!progressDot) return undefined
  const dotNode = <DotIcon status={info.status} />
  if (typeof progressDot === 'function') {
    return progressDot(dotNode, info)
  }
  return dotNode
}

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

const renderTag = (as: any, props: Record<string, any>, children?: any) => {
  const nextChildren = toChildArray(children)
  return h(as, props, ...nextChildren)
}

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

export default StepsCompound
