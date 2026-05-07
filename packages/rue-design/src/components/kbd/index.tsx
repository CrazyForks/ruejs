/*
Kbd 组件概述
- 保留 Rue 当前 `kbd` 视觉风格，同时把单键和组合键都整理成更顺手的语义 API。
- 同时支持 `<Kbd>⌘</Kbd>` 的兼容写法，以及 `items` / `Kbd.Combo` / `Kbd.Group` 的增强写法。
*/
import type { FC } from '@rue-js/rue'

export type KbdSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'
export type KbdGap = 'xs' | 'sm' | 'md' | 'lg'
export type KbdDirection = 'horizontal' | 'vertical'

export interface KbdItemData {
  key?: string | number
  label?: any
  children?: any
  size?: KbdSize
  className?: string
  [key: string]: any
}

export interface KbdProps {
  as?: any
  size?: KbdSize
  className?: string
  children?: any
  items?: ReadonlyArray<KbdItemData | any>
  separator?: any
  itemClassName?: string
  separatorClassName?: string
  wrap?: boolean
  gap?: KbdGap
  [key: string]: any
}

export interface KbdGroupProps {
  as?: any
  size?: KbdSize
  items?: ReadonlyArray<KbdItemData | any>
  separator?: any
  itemClassName?: string
  separatorClassName?: string
  direction?: KbdDirection
  wrap?: boolean
  gap?: KbdGap
  className?: string
  children?: any
  [key: string]: any
}

export interface KbdComboProps {
  as?: any
  size?: KbdSize
  className?: string
  children?: any
  items?: ReadonlyArray<KbdItemData | any>
  separator?: any
  itemClassName?: string
  separatorClassName?: string
  wrap?: boolean
  gap?: KbdGap
  [key: string]: any
}

export interface KbdSeparatorProps {
  as?: any
  className?: string
  children?: any
  [key: string]: any
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const hasRenderableContent = (value: any): boolean => {
  if (value === undefined || value === null || value === false) {
    return false
  }

  if (Array.isArray(value)) {
    return value.some(item => hasRenderableContent(item))
  }

  return true
}

const resolveSizeToken = (size?: KbdSize) => {
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

const resolveGapClass = (gap: KbdGap = 'sm') => {
  switch (gap) {
    case 'xs':
      return 'gap-1'
    case 'md':
      return 'gap-3'
    case 'lg':
      return 'gap-4'
    default:
      return 'gap-2'
  }
}

const buildKbdClassName = (size?: KbdSize, className?: string) => {
  let cls = 'kbd'
  const resolvedSize = resolveSizeToken(size)
  if (resolvedSize) cls += ` kbd-${resolvedSize}`
  if (className) cls += ` ${className}`
  return cls
}

const isKbdItemData = (value: any): value is KbdItemData => {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && ('label' in value || 'children' in value || 'size' in value || 'className' in value || 'key' in value)
  )
}

const normalizeItem = (item: KbdItemData | any, index: number): KbdItemData => {
  if (isKbdItemData(item)) {
    return item
  }

  return {
    key: index,
    label: item,
  }
}

const renderItemContent = (item: KbdItemData) => {
  if (hasRenderableContent(item.children)) return item.children
  return item.label
}

const joinClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ')

const KeyRoot: FC<KbdProps> = ({ as = 'kbd', size, className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={buildKbdClassName(size, className)}>
      {children}
    </Component>
  )
}

const Separator: FC<KbdSeparatorProps> = ({ as = 'span', className, children = '+', ...rest }) => {
  const Component = as as any
  return (
    <Component
      {...rest}
      className={mergeClassName('inline-flex items-center justify-center px-1 text-sm opacity-60', className)}
    >
      {children}
    </Component>
  )
}

const renderComboItems = ({
  items,
  size,
  itemClassName,
  separator,
  separatorClassName,
}: Pick<KbdComboProps, 'items' | 'size' | 'itemClassName' | 'separator' | 'separatorClassName'>) => {
  const normalizedItems = items?.map((item, index) => normalizeItem(item, index)) ?? []

  return normalizedItems.flatMap((item, index) => {
    const itemKey = item.key ?? index
    const itemNodes = []

    if (index > 0) {
      itemNodes.push(
        <Separator key={`separator-${itemKey}`} className={separatorClassName}>
          {hasRenderableContent(separator) ? separator : '+'}
        </Separator>
      )
    }

    const { key, size: itemSize, className: itemOwnClassName, ...itemRest } = item
    itemNodes.push(
      <KeyRoot
        key={`key-${itemKey}`}
        size={itemSize ?? size}
        className={joinClassName(itemClassName, itemOwnClassName)}
        {...itemRest}
      >
        {renderItemContent(item)}
      </KeyRoot>
    )

    return itemNodes
  })
}

const Group: FC<KbdGroupProps> = ({
  as = 'span',
  size,
  items,
  separator,
  itemClassName,
  separatorClassName,
  direction = 'horizontal',
  wrap,
  gap = 'sm',
  className,
  children,
  ...rest
}) => {
  const Component = as as any
  const baseClassName = direction === 'vertical' ? 'inline-flex flex-col' : 'inline-flex items-center'
  const groupClassName = mergeClassName(
    `${baseClassName}${direction !== 'vertical' && wrap ? ' flex-wrap' : ''} ${resolveGapClass(gap)}`,
    className
  )

  return (
    <Component {...rest} className={groupClassName}>
      {hasRenderableContent(children)
        ? children
        : renderComboItems({
            items,
            size,
            itemClassName,
            separator,
            separatorClassName,
          })}
    </Component>
  )
}

const Combo: FC<KbdComboProps> = ({
  as = 'span',
  size,
  className,
  children,
  items,
  separator,
  itemClassName,
  separatorClassName,
  wrap,
  gap = 'sm',
  ...rest
}) => {
  return (
    <Group
      as={as}
      size={size}
      items={items}
      separator={separator}
      itemClassName={itemClassName}
      separatorClassName={separatorClassName}
      wrap={wrap}
      gap={gap}
      className={className}
      {...rest}
    >
      {children}
    </Group>
  )
}

type KbdCompound = FC<KbdProps> & {
  Group: FC<KbdGroupProps>
  Combo: FC<KbdComboProps>
  Separator: FC<KbdSeparatorProps>
}

const Root: FC<KbdProps> = ({
  items,
  separator,
  itemClassName,
  separatorClassName,
  wrap,
  gap,
  ...rest
}) => {
  if (Array.isArray(items)) {
    return (
      <Combo
        items={items}
        separator={separator}
        itemClassName={itemClassName}
        separatorClassName={separatorClassName}
        wrap={wrap}
        gap={gap}
        {...rest}
      />
    )
  }

  return <KeyRoot {...rest} />
}

const Kbd: KbdCompound = Object.assign(Root, {
  Group,
  Combo,
  Separator,
})

export default Kbd
