import type { FC } from '@rue-js/rue'

export type MockupBrowserAddressBarStatus = 'default' | 'success' | 'warning' | 'error'
export type MockupBrowserContentPadding = 'none' | 'sm' | 'md' | 'lg'

export interface MockupBrowserProps {
  bordered?: boolean
  background?: boolean
  showToolbar?: boolean
  url?: any
  toolbar?: any
  toolbarStart?: any
  toolbarEnd?: any
  toolbarClassName?: string
  contentClassName?: string
  contentBordered?: boolean
  contentBackground?: boolean
  contentPadding?: MockupBrowserContentPadding
  className?: string
  children?: any
  [key: string]: any
}

export interface MockupBrowserToolbarProps {
  start?: any
  end?: any
  className?: string
  children?: any
  [key: string]: any
}

export interface MockupBrowserAddressBarProps {
  href?: string
  prefix?: any
  suffix?: any
  interactive?: boolean
  status?: MockupBrowserAddressBarStatus
  className?: string
  children?: any
  [key: string]: any
}

export interface MockupBrowserContentProps {
  bordered?: boolean
  background?: boolean
  padding?: MockupBrowserContentPadding
  className?: string
  children?: any
  [key: string]: any
}

const joinClassName = (...tokens: Array<string | false | null | undefined>) => {
  return tokens.filter(Boolean).join(' ')
}

const resolveAddressBarStatusClass = (status: MockupBrowserAddressBarStatus = 'default') => {
  switch (status) {
    case 'success':
      return 'border-success/30 bg-success/10 text-success'
    case 'warning':
      return 'border-warning/30 bg-warning/10 text-warning'
    case 'error':
      return 'border-error/30 bg-error/10 text-error'
    default:
      return 'border-base-300 bg-base-200/60'
  }
}

const resolvePaddingClass = (padding: MockupBrowserContentPadding = 'none') => {
  switch (padding) {
    case 'sm':
      return 'p-3'
    case 'md':
      return 'p-4'
    case 'lg':
      return 'p-6'
    default:
      return ''
  }
}

const AddressBar: FC<MockupBrowserAddressBarProps> = ({
  href,
  prefix,
  suffix,
  interactive,
  status = 'default',
  className,
  children,
  ...rest
}) => {
  const content = children ?? href
  const mergedClassName = joinClassName(
    'input input-sm flex h-8 w-full min-w-0 items-center gap-2 text-sm',
    resolveAddressBarStatusClass(status),
    className,
  )

  const inner = (
    <>
      {prefix != null ? <span className="shrink-0 opacity-55">{prefix}</span> : null}
      <span className="min-w-0 flex-1 truncate">{content}</span>
      {suffix != null ? <span className="shrink-0 opacity-55">{suffix}</span> : null}
    </>
  )

  if ((interactive || href) && typeof href === 'string') {
    return (
      <a {...rest} href={href} className={mergedClassName}>
        {inner}
      </a>
    )
  }

  return (
    <div {...rest} className={mergedClassName}>
      {inner}
    </div>
  )
}

const Content: FC<MockupBrowserContentProps> = ({
  bordered = true,
  background,
  padding = 'none',
  className,
  children,
  ...rest
}) => {
  return (
    <div
      {...rest}
      className={joinClassName(
        bordered && 'border-t border-base-300',
        background && 'bg-base-100',
        resolvePaddingClass(padding),
        className,
      )}
    >
      {children}
    </div>
  )
}

const Toolbar: FC<MockupBrowserToolbarProps> = ({ start, end, className, children, ...rest }) => {
  return (
    <div {...rest} className={joinClassName('mockup-browser-toolbar gap-3', className)}>
      {start != null ? <div className="flex shrink-0 items-center gap-2">{start}</div> : null}
      {children != null ? <div className="flex min-w-0 flex-1 items-center">{children}</div> : null}
      {end != null ? <div className="flex shrink-0 items-center gap-2">{end}</div> : null}
    </div>
  )
}

const Root: FC<MockupBrowserProps> = ({
  bordered,
  background,
  showToolbar,
  url,
  toolbar,
  toolbarStart,
  toolbarEnd,
  toolbarClassName,
  contentClassName,
  contentBordered,
  contentBackground,
  contentPadding,
  className,
  children,
  ...rest
}) => {
  const toolbarContent = toolbar ?? (url != null ? <AddressBar href={typeof url === 'string' ? url : undefined}>{url}</AddressBar> : null)
  const shouldRenderToolbar =
    showToolbar !== false &&
    (toolbar != null || url != null || toolbarStart != null || toolbarEnd != null || toolbarClassName != null)
  const shouldWrapContent =
    shouldRenderToolbar || contentClassName != null || contentBordered != null || contentBackground != null || contentPadding != null

  return (
    <div
      {...rest}
      className={joinClassName('mockup-browser', bordered && 'border border-base-300', background && 'bg-base-100', className)}
    >
      {shouldRenderToolbar ? (
        <Toolbar className={toolbarClassName} start={toolbarStart} end={toolbarEnd}>
          {toolbarContent}
        </Toolbar>
      ) : null}
      {shouldWrapContent ? (
        <Content
          className={contentClassName}
          bordered={contentBordered}
          background={contentBackground}
          padding={contentPadding}
        >
          {children}
        </Content>
      ) : (
        children
      )}
    </div>
  )
}

type MockupBrowserCompound = FC<MockupBrowserProps> & {
  Toolbar: FC<MockupBrowserToolbarProps>
  AddressBar: FC<MockupBrowserAddressBarProps>
  Content: FC<MockupBrowserContentProps>
}

const MockupBrowser: MockupBrowserCompound = Object.assign(Root, {
  Toolbar,
  AddressBar,
  Content,
})

export default MockupBrowser
