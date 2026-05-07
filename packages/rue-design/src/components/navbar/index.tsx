import type { FC } from '@rue-js/rue'

export type NavbarPlacement = 'start' | 'center' | 'end'
export type NavbarAlign = 'start' | 'center' | 'end' | 'between'

export interface NavbarSectionProps {
  as?: any
  className?: string
  children?: any
  align?: NavbarAlign
  grow?: boolean
  wrap?: boolean
  placement?: NavbarPlacement
  [key: string]: any
}

export interface NavbarItemProps {
  as?: any
  className?: string
  children?: any
  content?: any
  grow?: boolean
  [key: string]: any
}

export interface NavbarItem extends Omit<NavbarItemProps, 'content'> {
  key?: string | number
  placement?: NavbarPlacement
  content?: any
}

export interface NavbarRootProps {
  as?: any
  className?: string
  children?: any
  brand?: any
  start?: any
  center?: any
  end?: any
  actions?: any
  items?: ReadonlyArray<NavbarItem>
  startProps?: Omit<NavbarSectionProps, 'children' | 'placement'>
  centerProps?: Omit<NavbarSectionProps, 'children' | 'placement'>
  endProps?: Omit<NavbarSectionProps, 'children' | 'placement'>
  wrap?: boolean
  sticky?: boolean
  bordered?: boolean
  [key: string]: any
}

const joinClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ')

const hasRenderableContent = (value: any): boolean => {
  if (value == null) return false
  if (Array.isArray(value)) return value.some(item => hasRenderableContent(item))
  return true
}

const resolveAlignClass = (align?: NavbarAlign, placement?: NavbarPlacement) => {
  if (align === 'between') return 'justify-between'
  if (align === 'center') return 'justify-center'
  if (align === 'end') return 'justify-end'
  if (align === 'start') return 'justify-start'
  if (placement === 'center') return 'justify-center'
  if (placement === 'end') return 'justify-end'
  return undefined
}

const buildSectionClassName = (
  placement: NavbarPlacement,
  align?: NavbarAlign,
  grow?: boolean,
  wrap?: boolean,
  className?: string,
) => {
  return joinClassName(
    `navbar-${placement}`,
    resolveAlignClass(align, placement),
    grow && 'flex-1',
    wrap && 'flex-wrap',
    className,
  )
}

const Section: FC<NavbarSectionProps> = ({
  as = 'div',
  className,
  children,
  align,
  grow,
  wrap,
  placement = 'start',
  ...rest
}) => {
  const Component = as as any
  return (
    <Component {...rest} className={buildSectionClassName(placement, align, grow, wrap, className)}>
      {children}
    </Component>
  )
}

const Item: FC<NavbarItemProps> = ({
  as = 'div',
  className,
  children,
  content,
  grow,
  ...rest
}) => {
  const Component = as as any
  return (
    <Component
      {...rest}
      className={joinClassName('inline-flex min-w-0 items-center', grow && 'flex-1', className)}
    >
      {content ?? children}
    </Component>
  )
}

const Start: FC<Omit<NavbarSectionProps, 'placement'>> = props => <Section {...props} placement="start" />
const Center: FC<Omit<NavbarSectionProps, 'placement'>> = props => <Section {...props} placement="center" />
const End: FC<Omit<NavbarSectionProps, 'placement'>> = props => <Section {...props} placement="end" />

const renderSlotItem = (content: any, key: string) => {
  if (!hasRenderableContent(content)) return null
  return <Item key={key}>{content}</Item>
}

const renderPlacementItems = (items: ReadonlyArray<NavbarItem> | undefined, placement: NavbarPlacement) => {
  return (items ?? [])
    .filter(item => (item.placement ?? 'start') === placement)
    .map((item, index) => {
      const { key, placement: _placement, content, children, ...rest } = item
      return (
        <Item key={key ?? `${placement}-${index}`} {...rest} content={content ?? children} />
      )
    })
}

const Root: FC<NavbarRootProps> = ({
  as = 'div',
  className,
  children,
  brand,
  start,
  center,
  end,
  actions,
  items,
  startProps,
  centerProps,
  endProps,
  wrap,
  sticky,
  bordered,
  ...rest
}) => {
  const Component = as as any
  const hasChildren = hasRenderableContent(children)
  const startNodes = [
    renderSlotItem(brand, 'brand'),
    renderSlotItem(start, 'start'),
    ...renderPlacementItems(items, 'start'),
  ]
  const centerNodes = [renderSlotItem(center, 'center'), ...renderPlacementItems(items, 'center')]
  const endNodes = [
    ...renderPlacementItems(items, 'end'),
    renderSlotItem(end, 'end'),
    renderSlotItem(actions, 'actions'),
  ]
  const hasStructuredSlots = startNodes.some(Boolean) || centerNodes.some(Boolean) || endNodes.some(Boolean)

  return (
    <Component
      {...rest}
      className={joinClassName(
        'navbar',
        wrap && 'flex-wrap gap-y-2',
        sticky && 'sticky top-0 z-30',
        bordered && 'border-b border-base-300',
        className,
      )}
    >
      {hasChildren ? (
        children
      ) : (
        <>
          {hasStructuredSlots && startNodes.some(Boolean) ? <Start {...startProps}>{startNodes}</Start> : null}
          {hasStructuredSlots && centerNodes.some(Boolean) ? <Center {...centerProps}>{centerNodes}</Center> : null}
          {hasStructuredSlots && endNodes.some(Boolean) ? <End {...endProps}>{endNodes}</End> : null}
        </>
      )}
    </Component>
  )
}

type NavbarCompound = FC<NavbarRootProps> & {
  Start: FC<Omit<NavbarSectionProps, 'placement'>>
  Center: FC<Omit<NavbarSectionProps, 'placement'>>
  End: FC<Omit<NavbarSectionProps, 'placement'>>
  Section: FC<NavbarSectionProps>
  Item: FC<NavbarItemProps>
}

const Navbar: NavbarCompound = Object.assign(Root, {
  Start,
  Center,
  End,
  Section,
  Item,
})

export default Navbar
