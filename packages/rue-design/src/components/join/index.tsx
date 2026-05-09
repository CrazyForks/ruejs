/* RUE_VAPOR_TRANSFORMED */
import type { FC } from '@rue-js/rue'

export type JoinDirection = 'horizontal' | 'vertical'

export interface JoinItemProps {
  as?: any
  tag?: any
  className?: string
  active?: boolean
  disabled?: boolean
  href?: string
  onClick?: (event: MouseEvent) => void
  children?: any
  [key: string]: any
}

export interface JoinItemConfig extends JoinItemProps {
  key?: string | number
  label?: any
}

export interface JoinProps {
  as?: any
  direction?: JoinDirection
  items?: JoinItemConfig[]
  itemClassName?: string
  wrap?: boolean
  block?: boolean
  className?: string
  children?: any
  [key: string]: any
}

const mergeClassNames = (...classNames: Array<string | undefined | false>) => {
  return classNames.filter(Boolean).join(' ')
}

const isDisabledAttrTag = (tag: any) => {
  return (
    typeof tag === 'string' &&
    ['button', 'input', 'select', 'textarea', 'option', 'optgroup', 'fieldset'].includes(tag)
  )
}

const isButtonLikeClass = (className?: string) => {
  return !!className && /\bbtn\b/.test(className)
}

const hasRenderableChildren = (children: any) => {
  return !(children == null || (Array.isArray(children) && children.length === 0))
}

const Item: FC<JoinItemProps> = ({
  as,
  tag = 'button',
  className,
  active,
  disabled,
  href,
  onClick,
  children,
  ...rest
}) => {
  const Tag = (as ?? tag) as any
  const supportsDisabledAttr = isDisabledAttrTag(Tag)
  const disabledLikeButton = !!disabled && (Tag === 'a' || isButtonLikeClass(className))
  const mergedClassName = mergeClassNames(
    'join-item',
    active && 'btn-active',
    disabledLikeButton && 'btn-disabled',
    className,
  )

  const handleClick = (event: MouseEvent) => {
    if (disabled) {
      if (typeof (event as any).preventDefault === 'function') {
        ;(event as any).preventDefault()
      }
      if (typeof (event as any).stopPropagation === 'function') {
        ;(event as any).stopPropagation()
      }
      return
    }
    if (onClick) onClick(event)
  }

  if (Tag === 'a') {
    return (
      <a
        {...rest}
        {...(disabled ? {} : href != null ? { href } : {})}
        className={mergedClassName}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={handleClick}
      >
        {children}
      </a>
    )
  }

  if (Tag === 'button') {
    return (
      <button
        {...rest}
        type={rest.type ?? 'button'}
        disabled={disabled}
        className={mergedClassName}
        onClick={handleClick}
      >
        {children}
      </button>
    )
  }

  return (
    <Tag
      {...rest}
      {...(Tag === 'a' && !disabled && href != null ? { href } : {})}
      disabled={supportsDisabledAttr ? disabled : undefined}
      className={mergedClassName}
      aria-disabled={!supportsDisabledAttr && disabled ? 'true' : undefined}
      onClick={handleClick}
    >
      {children}
    </Tag>
  )
}

const renderItems = (items: JoinItemConfig[], itemClassName?: string) => {
  return items.map((item, index) => {
    const { key, label, children, className, ...rest } = item
    const content = Object.prototype.hasOwnProperty.call(item, 'children') ? children : label
    return (
      <Item key={key ?? index} {...rest} className={mergeClassNames(itemClassName, className)}>
        {content}
      </Item>
    )
  })
}

const JoinRoot: FC<JoinProps> = ({
  as,
  direction,
  items,
  itemClassName,
  wrap,
  block,
  className,
  children,
  ...rest
}) => {
  const Tag = (as ?? 'div') as any
  const mergedClassName = mergeClassNames(
    'join',
    direction && `join-${direction}`,
    wrap && 'flex flex-wrap',
    block && 'w-full',
    className,
  )

  return (
    <Tag {...rest} className={mergedClassName}>
      {hasRenderableChildren(children)
        ? children
        : items
          ? renderItems(items, itemClassName)
          : null}
    </Tag>
  )
}

type JoinCompound = FC<JoinProps> & {
  Item: FC<JoinItemProps>
}

const JoinCompound: JoinCompound = Object.assign(JoinRoot, {
  Item,
})

export default JoinCompound
