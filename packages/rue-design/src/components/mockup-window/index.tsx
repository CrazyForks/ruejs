/* RUE_VAPOR_TRANSFORMED */
/*
MockupWindow 组件概述
- 保留 daisyUI 的 mockup-window 外框和既有 children 用法。
- 新增推荐用法：根组件可通过 title / description / toolbar / actions 自动装配常见窗口结构。
- 同时暴露 Header / Body / Toolbar / Actions 复合子组件，便于需要更细粒度布局时手动拼装。
*/
import type { FC } from '@rue-js/rue'

export type MockupWindowPadding = 'none' | 'sm' | 'md' | 'lg'

export interface MockupWindowProps {
  bordered?: boolean
  background?: boolean
  title?: any
  description?: any
  toolbar?: any
  actions?: any
  padding?: MockupWindowPadding
  bodyClassName?: string
  headerClassName?: string
  actionsClassName?: string
  className?: string
  style?: any
  children?: any
  [key: string]: any
}

export interface MockupWindowPartProps {
  className?: string
  style?: any
  children?: any
  [key: string]: any
}

export interface MockupWindowHeaderProps extends MockupWindowPartProps {
  title?: any
  description?: any
  extra?: any
}

export interface MockupWindowBodyProps extends MockupWindowPartProps {
  padding?: MockupWindowPadding
}

const appendClassName = (base?: string, className?: string) => {
  if (base && className) return `${base} ${className}`
  return base ?? className ?? ''
}

const resolvePaddingClass = (padding: MockupWindowPadding) => {
  switch (padding) {
    case 'none':
      return ''
    case 'sm':
      return 'p-3'
    case 'lg':
      return 'p-6'
    default:
      return 'p-4'
  }
}

const hasVisibleChildren = (children: any) => {
  if (Array.isArray(children)) return children.length > 0
  return children != null
}

const Header: FC<MockupWindowHeaderProps> = ({
  title,
  description,
  extra,
  className,
  style,
  children,
  ...rest
}) => {
  const hasCustomChildren = hasVisibleChildren(children)

  return (
    <div
      {...rest}
      className={appendClassName(
        'rue-mockup-window-header flex items-start justify-between gap-3 border-b border-base-300/80 px-4 py-3',
        className,
      )}
      style={style}
    >
      {hasCustomChildren ? (
        children
      ) : (
        <>
          <div className="min-w-0 flex-1">
            {title != null ? <div className="truncate text-sm font-semibold">{title}</div> : null}
            {description != null ? (
              <div className="mt-1 text-xs opacity-70">{description}</div>
            ) : null}
          </div>
          {extra != null ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{extra}</div>
          ) : null}
        </>
      )}
    </div>
  )
}

const Body: FC<MockupWindowBodyProps> = ({
  padding = 'none',
  className,
  style,
  children,
  ...rest
}) => {
  const paddingClassName = resolvePaddingClass(padding)

  return (
    <div
      {...rest}
      className={appendClassName(
        appendClassName('rue-mockup-window-body', paddingClassName),
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}

const Toolbar: FC<MockupWindowPartProps> = ({ className, style, children, ...rest }) => {
  return (
    <div
      {...rest}
      className={appendClassName(
        'rue-mockup-window-toolbar flex flex-wrap items-center gap-2',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}

const Actions: FC<MockupWindowPartProps> = ({ className, style, children, ...rest }) => {
  return (
    <div
      {...rest}
      className={appendClassName(
        'rue-mockup-window-actions flex flex-wrap items-center justify-end gap-2 border-t border-base-300/80 px-4 py-3',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}

const Root: FC<MockupWindowProps> = ({
  bordered,
  background,
  title,
  description,
  toolbar,
  actions,
  padding,
  bodyClassName,
  headerClassName,
  actionsClassName,
  className,
  style,
  children,
  ...rest
}) => {
  const hasHeader = title != null || description != null || toolbar != null
  const hasActions = actions != null
  const hasStructuredSlots =
    hasHeader ||
    hasActions ||
    padding != null ||
    bodyClassName != null ||
    headerClassName != null ||
    actionsClassName != null

  let rootClassName = 'mockup-window'
  if (bordered) rootClassName += ' border border-base-300'
  if (background) rootClassName += ' bg-base-100'
  if (className) rootClassName += ` ${className}`

  if (!hasStructuredSlots) {
    return (
      <div {...rest} className={rootClassName} style={style}>
        {children}
      </div>
    )
  }

  return (
    <div {...rest} className={rootClassName} style={style}>
      {hasHeader ? (
        <Header
          title={title}
          description={description}
          extra={toolbar}
          className={headerClassName}
        />
      ) : null}
      <Body padding={padding ?? 'md'} className={bodyClassName}>
        {children}
      </Body>
      {hasActions ? <Actions className={actionsClassName}>{actions}</Actions> : null}
    </div>
  )
}

type MockupWindowCompound = FC<MockupWindowProps> & {
  Header: FC<MockupWindowHeaderProps>
  Body: FC<MockupWindowBodyProps>
  Toolbar: FC<MockupWindowPartProps>
  Actions: FC<MockupWindowPartProps>
}

const MockupWindow: MockupWindowCompound = Object.assign(Root, {
  Header,
  Body,
  Toolbar,
  Actions,
})

export default MockupWindow
