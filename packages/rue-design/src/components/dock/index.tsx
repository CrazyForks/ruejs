/* RUE_VAPOR_TRANSFORMED */
/*
Dock 组件概述
- 形态：保留原有 children / items 双写法，并补充 key、disabled、链接语义等增强能力。
- 状态：兼容 activeIndex，也支持 activeKey / defaultActiveKey 这类更语义化的导航控制。
- 复合组件：Item / Label 仍可独立组合，保持 Rue 当前 dock 视觉风格。
*/
import type { FC } from '@rue-js/rue'

export type DockRootAs = 'div' | 'nav'
export type DockItemAs = 'button' | 'a' | 'div'
export type DockItemKey = string | number
export type DockSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'

export interface DockChangeContext {
  key: DockItemKey
  index: number
  item?: DockItemData
}

export interface DockItemData {
  key?: DockItemKey
  as?: DockItemAs
  className?: string
  icon?: any
  iconClassName?: string
  label?: any
  labelClassName?: string
  href?: string
  target?: string
  rel?: string
  htmlType?: 'button' | 'submit' | 'reset'
  active?: boolean
  disabled?: boolean
  ariaLabel?: string
  onClick?: (event: MouseEvent, context: DockChangeContext) => void
}

export interface DockProps {
  as?: DockRootAs
  size?: DockSize
  className?: string
  ariaLabel?: string
  items?: ReadonlyArray<DockItemData>
  activeIndex?: number
  defaultActiveIndex?: number
  activeKey?: DockItemKey | null
  defaultActiveKey?: DockItemKey | null
  onChange?: (index: number, context: DockChangeContext) => void
  onSelect?: (key: DockItemKey | null, context: DockChangeContext) => void
  children?: any
}

export interface DockItemProps {
  as?: DockItemAs
  active?: boolean
  disabled?: boolean
  className?: string
  href?: string
  target?: string
  rel?: string
  htmlType?: 'button' | 'submit' | 'reset'
  ariaLabel?: string
  onClick?: (event: MouseEvent) => void
  children?: any
}

export interface DockLabelProps {
  className?: string
  children?: any
}

interface NormalizedDockItem extends DockItemData {
  key: DockItemKey
  index: number
}

const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const resolveSizeClass = (size?: DockSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'middle':
    case 'medium':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

const resolveAnchorRel = (target?: string, rel?: string) => {
  if (target === '_blank' && !rel) return 'noreferrer'
  return rel
}

const resolveSelectedKey = (
  items: ReadonlyArray<NormalizedDockItem>,
  activeKey: DockItemKey | null | undefined,
  activeIndex: number | undefined,
  defaultActiveKey: DockItemKey | null | undefined,
  defaultActiveIndex: number | undefined,
) => {
  if (activeKey !== undefined) return activeKey
  if (activeIndex !== undefined) return items[activeIndex]?.key ?? null
  if (defaultActiveKey !== undefined) return defaultActiveKey
  if (defaultActiveIndex !== undefined) return items[defaultActiveIndex]?.key ?? null
  return null
}

const Item: FC<DockItemProps> = ({
  as,
  active,
  disabled,
  className,
  href,
  target,
  rel,
  htmlType,
  ariaLabel,
  onClick,
  children,
}) => {
  const renderAs = as ?? (href ? 'a' : 'button')
  let cls = ''
  if (active) cls += ' dock-active'
  if (disabled) cls += ' opacity-50'
  if (className) cls += ` ${className}`
  const clsTrim = cls.trim() || undefined

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

  if (renderAs === 'a') {
    return (
      <a
        href={disabled ? undefined : href}
        target={target}
        rel={resolveAnchorRel(target, rel)}
        className={clsTrim}
        aria-label={ariaLabel}
        aria-current={active ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={handleClick}
      >
        {children}
      </a>
    )
  }

  if (renderAs === 'div') {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={clsTrim}
        aria-label={ariaLabel}
        aria-current={active ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={handleClick}
      >
        {children}
      </div>
    )
  }

  return (
    <button
      className={clsTrim}
      type={htmlType ?? 'button'}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      onClick={handleClick}
    >
      {children}
    </button>
  )
}

/** 停靠栏组件：数据驱动或 children 渲染。 */
const Dock: FC<DockProps> = ({
  as = 'div',
  size,
  className,
  ariaLabel,
  items,
  activeIndex,
  defaultActiveIndex,
  activeKey,
  defaultActiveKey,
  onChange,
  onSelect,
  children,
}) => {
  let cls = 'dock'
  const resolvedSize = resolveSizeClass(size)
  if (resolvedSize) cls += ` dock-${resolvedSize}`
  if (className) cls += ` ${className}`

  if (items && items.length) {
    const normalizedItems: NormalizedDockItem[] = items.map((item, index) => ({
      ...item,
      key: item.key ?? index,
      index,
    }))
    const selectedKey = resolveSelectedKey(
      normalizedItems,
      activeKey,
      activeIndex,
      defaultActiveKey,
      defaultActiveIndex,
    )

    const content = normalizedItems.map(item => {
      const context: DockChangeContext = {
        key: item.key,
        index: item.index,
        item,
      }
      const isActive =
        selectedKey != null
          ? selectedKey === item.key
          : activeIndex != null
            ? activeIndex === item.index
            : !!item.active

      return (
        <Item
          key={item.key}
          as={item.as ?? (item.href ? 'a' : 'button')}
          className={item.className}
          active={isActive}
          disabled={item.disabled}
          href={item.href}
          target={item.target}
          rel={item.rel}
          htmlType={item.htmlType}
          ariaLabel={item.ariaLabel}
          onClick={event => {
            if (item.onClick) item.onClick(event, context)
            if (onChange) onChange(item.index, context)
            if (onSelect) onSelect(item.key, context)
          }}
        >
          {item.icon != null ? (
            <span
              className={appendClassName(
                'inline-flex items-center justify-center',
                item.iconClassName,
              )}
            >
              {item.icon}
            </span>
          ) : null}
          {item.label != null ? <Label className={item.labelClassName}>{item.label}</Label> : null}
        </Item>
      )
    })

    if (as === 'nav') {
      return (
        <nav className={cls} aria-label={ariaLabel}>
          {content}
        </nav>
      )
    }
    return (
      <div className={cls} aria-label={ariaLabel}>
        {content}
      </div>
    )
  }

  if (as === 'nav') {
    return (
      <nav className={cls} aria-label={ariaLabel}>
        {children}
      </nav>
    )
  }
  return (
    <div className={cls} aria-label={ariaLabel}>
      {children}
    </div>
  )
}

/** 项标签组件：显示文字或图标旁说明。 */
const Label: FC<DockLabelProps> = ({ className, children }) => {
  return <span className={appendClassName('dock-label', className)}>{children}</span>
}

type DockCompound = FC<DockProps> & {
  Item: FC<DockItemProps>
  Label: FC<DockLabelProps>
}

const DockCompound: DockCompound = Object.assign(Dock, {
  Item,
  Label,
})

export default DockCompound
