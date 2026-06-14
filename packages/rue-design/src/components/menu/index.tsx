/*
Menu 组件概述
- 保留 Rue 当前 menu 视觉结构，并补齐更接近成熟组件库的导航能力。
- 同时支持 children 组合写法、旧版 kind 数据结构，以及 items 驱动的增强写法。
*/
import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { RouterLink } from '@rue-js/router'

/** MenuKey 标识键类型。 */
export type MenuKey = string | number
/** MenuSize 尺寸类型。 */
export type MenuSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'
/** MenuDirection 位置或方向类型。 */
export type MenuDirection = 'vertical' | 'horizontal'
/** MenuMode 类型。 */
export type MenuMode = 'vertical' | 'horizontal' | 'inline'
/** MenuTriggerSubMenuAction 类型。 */
export type MenuTriggerSubMenuAction = 'hover' | 'click'

/** MenuClickInfo 接口。 */
export interface MenuClickInfo {
  /** 数据项唯一标识。 */
  key?: MenuKey
  /** keyPath 配置项。 */
  keyPath: MenuKey[]
  /** item 区域配置。 */
  item?: MenuDataEntry
  /** domEvent 配置项。 */
  domEvent: MouseEvent
}

/** MenuSelectInfo 接口。 */
export interface MenuSelectInfo extends MenuClickInfo {
  /** 数据项唯一标识。 */
  key: MenuKey
  /** selectedKeys 标识键集合。 */
  selectedKeys: MenuKey[]
}

/** MenuTitleData 数据项结构。 */
export interface MenuTitleData {
  /** kind 配置项。 */
  kind: 'title'
  /** 自定义渲染的宿主元素。 */
  as?: 'li' | 'h2'
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
}

/** MenuDropdownToggleData 数据项结构。 */
export interface MenuDropdownToggleData {
  /** show 配置项。 */
  show?: boolean
  /** visible 配置项。 */
  visible?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 点击时触发的回调。 */
  onClick?: (event: MouseEvent) => void
  /** 组件子内容。 */
  children?: any
}

/** MenuDropdownData 数据项结构。 */
export interface MenuDropdownData {
  /** show 配置项。 */
  show?: boolean
  /** visible 配置项。 */
  visible?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 数据驱动渲染项。 */
  items?: ReadonlyArray<MenuDataEntry>
}

/** MenuLegacySubmenuData 数据项结构。 */
export interface MenuLegacySubmenuData {
  /** 根节点附加类名。 */
  className?: string
  /** 数据驱动渲染项。 */
  items?: ReadonlyArray<MenuDataEntry>
}

/** MenuItemData 数据项结构。 */
export interface MenuItemData {
  /** kind 配置项。 */
  kind?: 'item'
  /** 组件类型或语义类型。 */
  type?: undefined
  /** 数据项唯一标识。 */
  key?: MenuKey
  /** 自定义渲染的宿主元素。 */
  as?: 'a' | 'button' | 'span'
  /** 链接地址。 */
  href?: string
  /** to 配置项。 */
  to?: string
  /** 链接或定位目标。 */
  target?: string
  /** 链接 rel 属性。 */
  rel?: string
  /** 标题内容。 */
  title?: string
  /** 展示标签。 */
  label?: any
  /** 图标内容。 */
  icon?: any
  /** 额外操作或补充内容。 */
  extra?: any
  /** danger 配置项。 */
  danger?: boolean
  /** 点击时触发的回调。 */
  onClick?: (event: MouseEvent) => void
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 是否处于激活态。 */
  active?: boolean
  /** selected 配置项。 */
  selected?: boolean
  /** focus 配置项。 */
  focus?: boolean
  /** liClassName 附加类名。 */
  liClassName?: string
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
  /** dropdownToggle 配置项。 */
  dropdownToggle?: MenuDropdownToggleData
  /** dropdown 配置项。 */
  dropdown?: MenuDropdownData
  /** submenu 配置项。 */
  submenu?: MenuLegacySubmenuData
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** MenuSubMenuData 数据项结构。 */
export interface MenuSubMenuData {
  /** 组件类型或语义类型。 */
  type: 'submenu'
  /** 数据项唯一标识。 */
  key?: MenuKey
  /** 展示标签。 */
  label?: any
  /** 图标内容。 */
  icon?: any
  /** 额外操作或补充内容。 */
  extra?: any
  /** 标题内容。 */
  title?: string
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** popupClassName 附加类名。 */
  popupClassName?: string
  /** 组件子内容。 */
  children?: ReadonlyArray<MenuDataEntry>
  /** onTitleClick 事件回调。 */
  onTitleClick?: (info: { key?: MenuKey; domEvent: MouseEvent }) => void
}

/** MenuGroupData 数据项结构。 */
export interface MenuGroupData {
  /** 组件类型或语义类型。 */
  type: 'group'
  /** 数据项唯一标识。 */
  key?: MenuKey
  /** 展示标签。 */
  label?: any
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: ReadonlyArray<MenuDataEntry>
}

/** MenuDividerData 数据项结构。 */
export interface MenuDividerData {
  /** 组件类型或语义类型。 */
  type: 'divider'
  /** 数据项唯一标识。 */
  key?: MenuKey
  /** 根节点附加类名。 */
  className?: string
  /** dashed 配置项。 */
  dashed?: boolean
}

/** MenuDataEntry 类型。 */
export type MenuDataEntry =
  | MenuTitleData
  | MenuItemData
  | MenuSubMenuData
  | MenuGroupData
  | MenuDividerData

/** MenuProps 组件属性。 */
export interface MenuProps {
  /** 组件尺寸。 */
  size?: MenuSize
  /** 布局方向。 */
  direction?: MenuDirection
  /** mode 配置项。 */
  mode?: MenuMode
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: any
  /** selectable 配置项。 */
  selectable?: boolean
  /** multiple 配置项。 */
  multiple?: boolean
  /** inlineIndent 配置项。 */
  inlineIndent?: number
  /** triggerSubMenuAction 配置项。 */
  triggerSubMenuAction?: MenuTriggerSubMenuAction
  /** selectedKeys 标识键集合。 */
  selectedKeys?: ReadonlyArray<MenuKey>
  /** defaultSelectedKeys 标识键集合。 */
  defaultSelectedKeys?: ReadonlyArray<MenuKey>
  /** openKeys 标识键集合。 */
  openKeys?: ReadonlyArray<MenuKey>
  /** defaultOpenKeys 标识键集合。 */
  defaultOpenKeys?: ReadonlyArray<MenuKey>
  /** 点击时触发的回调。 */
  onClick?: (info: MenuClickInfo) => void
  /** 选中项时触发的回调。 */
  onSelect?: (info: MenuSelectInfo) => void
  /** 取消选中项时触发的回调。 */
  onDeselect?: (info: MenuSelectInfo) => void
  /** 打开状态变化时触发的回调。 */
  onOpenChange?: (openKeys: MenuKey[]) => void
  /** 组件子内容。 */
  children?: any
  /** 数据驱动渲染项。 */
  items?: ReadonlyArray<MenuDataEntry>
}

/** MenuItemProps 组件属性。 */
export interface MenuItemProps {
  /** eventKey 标识键。 */
  eventKey?: MenuKey
  /** 自定义渲染的宿主元素。 */
  as?: 'a' | 'button' | 'span'
  /** 链接地址。 */
  href?: string
  /** to 配置项。 */
  to?: string
  /** 链接或定位目标。 */
  target?: string
  /** 链接 rel 属性。 */
  rel?: string
  /** 标题内容。 */
  title?: string
  /** 图标内容。 */
  icon?: any
  /** 额外操作或补充内容。 */
  extra?: any
  /** danger 配置项。 */
  danger?: boolean
  /** 点击时触发的回调。 */
  onClick?: (event: MouseEvent) => void
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 是否处于激活态。 */
  active?: boolean
  /** selected 配置项。 */
  selected?: boolean
  /** focus 配置项。 */
  focus?: boolean
  /** liClassName 附加类名。 */
  liClassName?: string
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** MenuTitleProps 组件属性。 */
export interface MenuTitleProps {
  /** 自定义渲染的宿主元素。 */
  as?: 'li' | 'h2'
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
}

/** MenuDropdownProps 组件属性。 */
export interface MenuDropdownProps {
  /** show 配置项。 */
  show?: boolean
  /** visible 配置项。 */
  visible?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
}

/** MenuDropdownToggleProps 组件属性。 */
export interface MenuDropdownToggleProps {
  /** show 配置项。 */
  show?: boolean
  /** visible 配置项。 */
  visible?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 点击时触发的回调。 */
  onClick?: (event: MouseEvent) => void
  /** 组件子内容。 */
  children?: any
}

/** SubmenuProps 组件属性。 */
export interface SubmenuProps {
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
}

/** MenuSubMenuProps 组件属性。 */
export interface MenuSubMenuProps {
  /** eventKey 标识键。 */
  eventKey?: MenuKey
  /** 标题内容。 */
  title?: any
  /** 图标内容。 */
  icon?: any
  /** 额外操作或补充内容。 */
  extra?: any
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 标题按钮附加类名。 */
  titleClassName?: string
  /** popupClassName 附加类名。 */
  popupClassName?: string
  /** 受控打开状态。 */
  open?: boolean
  /** 非受控初始打开状态。 */
  defaultOpen?: boolean
  /** onTitleClick 事件回调。 */
  onTitleClick?: (info: { key?: MenuKey; domEvent: MouseEvent }) => void
  /** 打开状态变化时触发的回调。 */
  onOpenChange?: (open: boolean) => void
  /** 组件子内容。 */
  children?: any
  /** __menuContext 配置项。 */
  __menuContext?: MenuContextValue | null
}

/** MenuItemGroupProps 组件属性。 */
export interface MenuItemGroupProps {
  /** 标题内容。 */
  title?: any
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
}

/** MenuDividerProps 组件属性。 */
export interface MenuDividerProps {
  /** 根节点附加类名。 */
  className?: string
  /** dashed 配置项。 */
  dashed?: boolean
}

interface MenuContextValue {
  mode: MenuMode
  inlineIndent: number
  selectable: boolean
  multiple: boolean
  triggerSubMenuAction: MenuTriggerSubMenuAction
  selectedKeys: MenuKey[]
  openKeys: MenuKey[]
  isSelected: (key?: MenuKey, explicit?: boolean) => boolean
  isOpen: (key?: MenuKey, explicit?: boolean) => boolean
  onItemClick: (event: MouseEvent, item: Partial<MenuItemData>, keyPath?: MenuKey[]) => void
  onSubMenuToggle: (
    key: MenuKey,
    nextOpen: boolean,
    event: MouseEvent,
    item?: Partial<MenuSubMenuData>,
  ) => void
}

/** RUE_COMPONENT_TYPE_KEY 内部常量。 */
const RUE_COMPONENT_TYPE_KEY = '__rue_component_type'
/** MENU_CONTEXT_PROP 内部常量。 */
const MENU_CONTEXT_PROP = '__menuContext'

/** append Class Name 的内部工具函数。 */
const appendClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

/** 解析 Size Class 的内部工具函数。 */
const resolveSizeClass = (size?: MenuSize) => {
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

/** 归一化 Keys 的内部工具函数。 */
const normalizeKeys = (keys?: ReadonlyArray<MenuKey>) => {
  return Array.isArray(keys) ? [...keys] : []
}

/** 判断是否存在 Key 的内部工具函数。 */
const hasKey = (keys: ReadonlyArray<MenuKey>, target?: MenuKey) => {
  if (target === undefined) return false
  return keys.some(key => key === target)
}

/** 判断 Renderable Node 的内部工具函数。 */
const isRenderableNode = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object'

/** 判断组件类型是否匹配的内部工具函数。 */
const isVNodeOfType = (value: Record<string, any>, type: unknown) => {
  return value[RUE_COMPONENT_TYPE_KEY] === type || value.type === type || value.component === type
}

/** inject Menu Context 的内部工具函数。 */
const injectMenuContext = (value: unknown, menuContext: MenuContextValue): unknown => {
  if (Array.isArray(value)) {
    return value.map(child => injectMenuContext(child, menuContext))
  }
  if (!isRenderableNode(value)) {
    return value
  }

  const props = value.props
  if (!props || typeof props !== 'object') {
    return value
  }

  const nextProps = {
    ...(props as Record<string, unknown>),
  }
  if ('children' in nextProps) {
    nextProps.children = injectMenuContext(nextProps.children, menuContext)
  }

  if (isVNodeOfType(value, Item) || isVNodeOfType(value, SubMenu)) {
    nextProps[MENU_CONTEXT_PROP] = menuContext
  }

  return {
    ...value,
    props: nextProps,
  }
}

/** toggle Key 的内部工具函数。 */
const toggleKey = (keys: ReadonlyArray<MenuKey>, target: MenuKey) => {
  return hasKey(keys, target) ? keys.filter(key => key !== target) : [...keys, target]
}

/** 读取 Menu Mode 的内部工具函数。 */
const getMenuMode = (mode?: MenuMode, direction?: MenuDirection): MenuMode => {
  if (mode) return mode
  if (direction === 'horizontal') return 'horizontal'
  return 'vertical'
}

/** 读取 Anchor Rel 的内部工具函数。 */
const getAnchorRel = (target?: string, rel?: string) => {
  if (target === '_blank' && !rel) return 'noreferrer'
  return rel
}

/** 解析 Router Href 的内部工具函数。 */
const resolveRouterHref = (to: string) => {
  const resolvedHref = RouterLink.__rueHref(to)
  if (!resolvedHref) {
    return '#/'
  }
  if (resolvedHref === to && to && !to.startsWith('#')) {
    return `#${to}`
  }
  return resolvedHref
}

/** 读取 Item Class Name 的内部工具函数。 */
const getItemClassName = ({
  disabled,
  selected,
  focus,
  danger,
  className,
}: {
  disabled?: boolean
  selected?: boolean
  focus?: boolean
  danger?: boolean
  className?: string
}) => {
  let cls = ''
  if (disabled) cls += ' menu-disabled'
  if (selected) cls += ' menu-active'
  if (focus) cls += ' menu-focus'
  if (danger) cls += ' text-error'
  if (className) cls += ` ${className}`
  return cls.trim() || undefined
}

/** 渲染 Item Content 的内部工具函数。 */
const renderItemContent = ({
  icon,
  content,
  extra,
  suffix,
}: {
  icon?: any
  content?: any
  extra?: any
  suffix?: any
}) => {
  const hasIcon = icon != null
  const hasExtra = extra != null || suffix != null
  return (
    <>
      {hasIcon ? (
        <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>
      ) : null}
      {content != null ? (
        <span
          className={appendClassName(hasExtra ? 'min-w-0 flex-1' : '', hasIcon ? '' : undefined)}
        >
          {content}
        </span>
      ) : null}
      {extra != null ? (
        <span className="ml-auto shrink-0 pl-3 text-xs opacity-70">{extra}</span>
      ) : null}
      {suffix != null ? <span className="ml-2 shrink-0 opacity-60">{suffix}</span> : null}
    </>
  )
}

/** 渲染 Menu Action 的内部工具函数。 */
const renderMenuAction = (
  props: MenuItemProps,
  menuContext: MenuContextValue | null,
  itemMeta?: Partial<MenuDataEntry>,
  keyPath?: MenuKey[],
) => {
  const {
    eventKey,
    as = 'a',
    href,
    to,
    target,
    rel,
    title,
    icon,
    extra,
    onClick,
    disabled,
    active,
    selected,
    focus,
    danger,
    className,
    children,
    ...rest
  } = props

  const mergedSelected =
    menuContext?.isSelected(eventKey, selected ?? active) ?? !!(selected ?? active)
  const innerClassName = getItemClassName({
    disabled,
    selected: mergedSelected,
    focus,
    danger,
    className,
  })

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
    if (menuContext) {
      menuContext.onItemClick(
        event,
        {
          key: eventKey,
          label: children,
          icon,
          extra,
          title,
          danger,
          disabled,
          active,
          selected,
          focus,
          className,
          ...(itemMeta as any),
        },
        keyPath,
      )
    }
  }

  const contentNode = renderItemContent({
    icon,
    content: children,
    extra,
  })

  if (as === 'button') {
    return (
      <button
        {...rest}
        type={rest.type ?? 'button'}
        className={innerClassName}
        title={title}
        disabled={disabled}
        aria-current={mergedSelected ? 'page' : undefined}
        onClick={handleClick}
      >
        {contentNode}
      </button>
    )
  }

  if (as === 'span') {
    return (
      <span
        {...rest}
        className={innerClassName}
        title={title}
        role={rest.role ?? 'menuitem'}
        tabIndex={disabled ? -1 : (rest.tabIndex ?? 0)}
        aria-current={mergedSelected ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={handleClick}
      >
        {contentNode}
      </span>
    )
  }

  if (to) {
    if (disabled) {
      return (
        <span
          {...rest}
          className={innerClassName}
          title={title}
          role={rest.role ?? 'menuitem'}
          tabIndex={-1}
          aria-current={mergedSelected ? 'page' : undefined}
          aria-disabled="true"
          onClick={handleClick}
        >
          {contentNode}
        </span>
      )
    }

    const handleRouterClick = (event: MouseEvent) => {
      handleClick(event)
      if ((event as any).defaultPrevented) {
        return
      }
      RouterLink.__rueOnClick(event, to, false)
    }

    return (
      <a
        {...rest}
        className={innerClassName}
        href={resolveRouterHref(to)}
        title={title}
        aria-current={mergedSelected ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={handleRouterClick}
      >
        {contentNode}
      </a>
    )
  }

  if (href) {
    return (
      <a
        {...rest}
        className={innerClassName}
        href={disabled ? undefined : href}
        target={target}
        rel={getAnchorRel(target, rel)}
        title={title}
        aria-current={mergedSelected ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={handleClick}
      >
        {contentNode}
      </a>
    )
  }

  return (
    <a
      {...rest}
      className={innerClassName}
      title={title}
      aria-current={mergedSelected ? 'page' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      onClick={handleClick}
    >
      {contentNode}
    </a>
  )
}

/** Title 的内部工具函数。 */
const Title: FC<MenuTitleProps> = ({ as = 'li', className, children }) => {
  const cls = appendClassName('menu-title', className)
  if (as === 'h2') return <h2 className={cls}>{children}</h2>
  return <li className={cls}>{children}</li>
}

/** Dropdown 的内部工具函数。 */
const Dropdown: FC<MenuDropdownProps> = ({ show, visible, className, children }) => {
  const mergedVisible = visible ?? show
  let cls = 'menu-dropdown'
  if (mergedVisible) cls += ' menu-dropdown-show'
  if (className) cls += ` ${className}`
  return <ul className={cls}>{children}</ul>
}

/** Dropdown Toggle 的内部工具函数。 */
const DropdownToggle: FC<MenuDropdownToggleProps> = ({
  show,
  visible,
  className,
  onClick,
  children,
}) => {
  const mergedVisible = visible ?? show
  let cls = 'menu-dropdown-toggle'
  if (mergedVisible) cls += ' menu-dropdown-show'
  if (className) cls += ` ${className}`
  return (
    <span
      className={cls}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-expanded={onClick ? (mergedVisible ? 'true' : 'false') : undefined}
      onClick={onClick}
      onKeyDown={(event: KeyboardEvent) => {
        if (!onClick) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (typeof (event as any).preventDefault === 'function') {
          ;(event as any).preventDefault()
        }
        onClick(event as any)
      }}
    >
      {children}
    </span>
  )
}

/** Submenu 的内部工具函数。 */
const Submenu: FC<SubmenuProps> = ({ className, children }) => {
  return <ul className={className}>{children}</ul>
}

interface LegacyDropdownItemProps {
  entryKey: MenuKey
  itemEntry: MenuItemData
  content: any
  menuContext: MenuContextValue
  keyPath: MenuKey[]
}

const LegacyDropdownItem: FC<LegacyDropdownItemProps> = ({
  entryKey,
  itemEntry,
  content,
  menuContext,
  keyPath,
}) => {
  const dropdownToggle = itemEntry.dropdownToggle
  const dropdown = itemEntry.dropdown
  const initialOpen =
    dropdownToggle?.visible ?? dropdownToggle?.show ?? dropdown?.visible ?? dropdown?.show
  const dropdownOpen = ref(!!initialOpen)
  const toggleDropdown = (event: MouseEvent) => {
    if (itemEntry.disabled) return
    dropdownOpen.value = !dropdownOpen.value
    if (dropdownToggle?.onClick) dropdownToggle.onClick(event)
  }

  return (
    <li className={itemEntry.liClassName} key={entryKey}>
      {renderMenuAction(
        {
          eventKey: itemEntry.key,
          as: itemEntry.as,
          href: itemEntry.href,
          to: itemEntry.to,
          target: itemEntry.target,
          rel: itemEntry.rel,
          title: itemEntry.title,
          icon: itemEntry.icon,
          extra: itemEntry.extra,
          danger: itemEntry.danger,
          onClick: itemEntry.onClick,
          disabled: itemEntry.disabled,
          active: itemEntry.active,
          selected: itemEntry.selected,
          focus: itemEntry.focus,
          className: itemEntry.className,
          children: content,
        },
        menuContext,
        itemEntry,
        keyPath,
      )}
      {dropdownToggle ? (
        <DropdownToggle
          visible={dropdownOpen.value}
          className={dropdownToggle.className}
          onClick={toggleDropdown}
        >
          {dropdownToggle.children}
        </DropdownToggle>
      ) : null}
      {dropdown ? (
        <Dropdown visible={dropdownOpen.value} className={dropdown.className}>
          {dropdown.items?.map((child, childIndex) =>
            renderDataEntry(child, childIndex, menuContext, keyPath),
          )}
        </Dropdown>
      ) : null}
      {itemEntry.submenu ? (
        <Submenu className={itemEntry.submenu.className}>
          {itemEntry.submenu.items?.map((child, childIndex) =>
            renderDataEntry(child, childIndex, menuContext, keyPath),
          )}
        </Submenu>
      ) : null}
    </li>
  )
}

/** Item 的内部工具函数。 */
const Item: FC<MenuItemProps & { __menuContext?: MenuContextValue | null }> = ({
  liClassName,
  __menuContext = null,
  ...rest
}) => {
  const menuContext = __menuContext
  return <li className={liClassName}>{renderMenuAction(rest, menuContext)}</li>
}

/** Divider 的内部工具函数。 */
const Divider: FC<MenuDividerProps> = ({ className, dashed }) => {
  return (
    <li
      role="separator"
      className={appendClassName(
        appendClassName(
          'mx-2 my-1 h-px list-none bg-base-300/80',
          dashed ? 'border-t border-dashed border-base-300 bg-transparent' : undefined,
        ),
        className,
      )}
    />
  )
}

/** Item Group 的内部工具函数。 */
const ItemGroup: FC<MenuItemGroupProps> = ({ title, className, children }) => {
  return (
    <li className={className}>
      <div className="menu-title">{title}</div>
      <ul>{children}</ul>
    </li>
  )
}

/** Sub Menu 的内部工具函数。 */
const SubMenu: FC<MenuSubMenuProps> = ({
  eventKey,
  title,
  icon,
  extra,
  disabled,
  className,
  titleClassName,
  popupClassName,
  open,
  defaultOpen,
  onTitleClick,
  onOpenChange,
  children,
  __menuContext = null,
}) => {
  const menuContext = __menuContext
  const uncontrolledOpen = ref(!!defaultOpen)
  const mergedOpen =
    eventKey !== undefined && menuContext
      ? menuContext.isOpen(eventKey, open)
      : (open ?? uncontrolledOpen.value)
  const triggerAction =
    menuContext?.mode === 'inline' ? 'click' : (menuContext?.triggerSubMenuAction ?? 'click')

  const commitOpen = (nextOpen: boolean, event: MouseEvent) => {
    if (disabled) return
    if (onTitleClick) onTitleClick({ key: eventKey, domEvent: event })
    if (eventKey !== undefined && menuContext) {
      menuContext.onSubMenuToggle(eventKey, nextOpen, event, {
        key: eventKey,
        label: title,
        icon,
        extra,
        disabled,
        className,
        popupClassName,
      })
    } else if (open === undefined) {
      uncontrolledOpen.value = nextOpen
    }
    if (onOpenChange) onOpenChange(nextOpen)
  }

  return (
    <li
      className={className}
      onMouseEnter={(event: MouseEvent) => {
        if (triggerAction === 'hover') commitOpen(true, event as any)
      }}
      onMouseLeave={(event: MouseEvent) => {
        if (triggerAction === 'hover') commitOpen(false, event as any)
      }}
    >
      <button
        type="button"
        className={getItemClassName({
          disabled,
          selected: mergedOpen,
          className: titleClassName,
        })}
        aria-expanded={mergedOpen ? 'true' : 'false'}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={(event: MouseEvent) => {
          if (triggerAction !== 'click') return
          commitOpen(!mergedOpen, event as any)
        }}
      >
        {renderItemContent({
          icon,
          content: title,
          extra,
          suffix: mergedOpen ? '▾' : '▸',
        })}
      </button>
      <ul
        className={appendClassName(mergedOpen ? '' : 'hidden', popupClassName)}
        style={
          menuContext?.mode === 'inline'
            ? { paddingInlineStart: `${menuContext.inlineIndent}px` }
            : undefined
        }
      >
        {children}
      </ul>
    </li>
  )
}

/** 渲染 Data Entry 的内部工具函数。 */
const renderDataEntry = (
  entry: MenuDataEntry,
  index: number,
  menuContext: MenuContextValue,
  parentKeyPath: MenuKey[] = [],
): any => {
  const entryKey = (entry as any).key ?? `${parentKeyPath.join('-') || 'root'}-${index}`

  if ((entry as MenuTitleData).kind === 'title') {
    const titleEntry = entry as MenuTitleData
    return (
      <Title key={entryKey} as={titleEntry.as} className={titleEntry.className}>
        {titleEntry.children}
      </Title>
    )
  }

  if ((entry as MenuDividerData).type === 'divider') {
    const dividerEntry = entry as MenuDividerData
    return (
      <Divider key={entryKey} className={dividerEntry.className} dashed={dividerEntry.dashed} />
    )
  }

  if ((entry as MenuGroupData).type === 'group') {
    const groupEntry = entry as MenuGroupData
    return (
      <ItemGroup key={entryKey} title={groupEntry.label} className={groupEntry.className}>
        {groupEntry.children?.map((child, childIndex) =>
          renderDataEntry(
            child,
            childIndex,
            menuContext,
            groupEntry.key !== undefined ? [...parentKeyPath, groupEntry.key] : parentKeyPath,
          ),
        )}
      </ItemGroup>
    )
  }

  if ((entry as MenuSubMenuData).type === 'submenu') {
    const subMenuEntry = entry as MenuSubMenuData
    const keyPath =
      subMenuEntry.key !== undefined ? [...parentKeyPath, subMenuEntry.key] : parentKeyPath
    return (
      <SubMenu
        key={entryKey}
        eventKey={subMenuEntry.key}
        title={subMenuEntry.label}
        icon={subMenuEntry.icon}
        extra={subMenuEntry.extra}
        disabled={subMenuEntry.disabled}
        className={subMenuEntry.className}
        popupClassName={subMenuEntry.popupClassName}
        onTitleClick={subMenuEntry.onTitleClick}
        __menuContext={menuContext}
      >
        {subMenuEntry.children?.map((child, childIndex) =>
          renderDataEntry(child, childIndex, menuContext, keyPath),
        )}
      </SubMenu>
    )
  }

  const itemEntry = entry as MenuItemData
  const content = itemEntry.label ?? itemEntry.children
  const keyPath = itemEntry.key !== undefined ? [...parentKeyPath, itemEntry.key] : parentKeyPath

  if (itemEntry.submenu && !itemEntry.dropdown && !itemEntry.dropdownToggle) {
    const subMenuKey = itemEntry.key ?? entryKey
    const subMenuKeyPath = [...parentKeyPath, subMenuKey]
    const legacySubMenuContext = { ...menuContext, triggerSubMenuAction: 'click' as const }
    return (
      <SubMenu
        key={entryKey}
        eventKey={subMenuKey}
        title={content}
        icon={itemEntry.icon}
        extra={itemEntry.extra}
        disabled={itemEntry.disabled}
        className={itemEntry.liClassName}
        titleClassName={itemEntry.className}
        popupClassName={itemEntry.submenu.className}
        onTitleClick={itemEntry.onClick ? info => itemEntry.onClick?.(info.domEvent) : undefined}
        __menuContext={legacySubMenuContext}
      >
        {itemEntry.submenu.items?.map((child, childIndex) =>
          renderDataEntry(child, childIndex, legacySubMenuContext, subMenuKeyPath),
        )}
      </SubMenu>
    )
  }

  if (itemEntry.dropdown || itemEntry.submenu || itemEntry.dropdownToggle) {
    return (
      <LegacyDropdownItem
        key={entryKey}
        entryKey={entryKey}
        itemEntry={itemEntry}
        content={content}
        menuContext={menuContext}
        keyPath={keyPath}
      />
    )
  }

  return (
    <Item
      key={entryKey}
      eventKey={itemEntry.key}
      as={itemEntry.as}
      href={itemEntry.href}
      to={itemEntry.to}
      target={itemEntry.target}
      rel={itemEntry.rel}
      title={itemEntry.title}
      icon={itemEntry.icon}
      extra={itemEntry.extra}
      danger={itemEntry.danger}
      onClick={itemEntry.onClick}
      disabled={itemEntry.disabled}
      active={itemEntry.active}
      selected={itemEntry.selected}
      focus={itemEntry.focus}
      liClassName={itemEntry.liClassName}
      className={itemEntry.className}
      __menuContext={menuContext}
    >
      {content}
    </Item>
  )
}

/** Menu 的内部工具函数。 */
const Menu: FC<MenuProps> = ({
  size,
  direction = 'vertical',
  mode,
  className,
  style,
  selectable = true,
  multiple = false,
  inlineIndent = 24,
  triggerSubMenuAction = 'hover',
  selectedKeys,
  defaultSelectedKeys,
  openKeys,
  defaultOpenKeys,
  onClick,
  onSelect,
  onDeselect,
  onOpenChange,
  children,
  items,
}) => {
  const resolvedMode = getMenuMode(mode, direction)
  const uncontrolledSelectedKeys = ref(normalizeKeys(defaultSelectedKeys ?? selectedKeys))
  const uncontrolledOpenKeys = ref(normalizeKeys(defaultOpenKeys ?? openKeys))
  const mergedSelectedKeys =
    selectedKeys !== undefined ? normalizeKeys(selectedKeys) : uncontrolledSelectedKeys.value
  const mergedOpenKeys =
    openKeys !== undefined ? normalizeKeys(openKeys) : uncontrolledOpenKeys.value

  const commitSelectedKeys = (nextSelectedKeys: MenuKey[]) => {
    if (selectedKeys === undefined) uncontrolledSelectedKeys.value = nextSelectedKeys
  }

  const commitOpenKeys = (nextOpenKeys: MenuKey[]) => {
    if (openKeys === undefined) uncontrolledOpenKeys.value = nextOpenKeys
    if (onOpenChange) onOpenChange(nextOpenKeys)
  }

  const menuContextValue: MenuContextValue = {
    mode: resolvedMode,
    inlineIndent,
    selectable,
    multiple,
    triggerSubMenuAction,
    selectedKeys: mergedSelectedKeys,
    openKeys: mergedOpenKeys,
    isSelected: (key, explicit) => explicit ?? hasKey(mergedSelectedKeys, key),
    isOpen: (key, explicit) => explicit ?? hasKey(mergedOpenKeys, key),
    onItemClick: (event, item, keyPath = item.key !== undefined ? [item.key] : []) => {
      const info: MenuClickInfo = {
        key: item.key,
        keyPath,
        item: item as MenuDataEntry,
        domEvent: event,
      }
      if (onClick) onClick(info)
      if (!selectable || item.key === undefined) return

      const nextSelectedKeys = multiple ? toggleKey(mergedSelectedKeys, item.key) : [item.key]
      const isSelected = hasKey(mergedSelectedKeys, item.key)
      commitSelectedKeys(nextSelectedKeys)

      const selectInfo: MenuSelectInfo = {
        ...info,
        key: item.key,
        selectedKeys: nextSelectedKeys,
      }

      if (multiple && isSelected) {
        if (onDeselect) onDeselect(selectInfo)
        return
      }
      if (!multiple && isSelected && mergedSelectedKeys.length === 1) return
      if (onSelect) onSelect(selectInfo)
    },
    onSubMenuToggle: (key, nextOpen, _event, _item) => {
      const nextOpenKeys = nextOpen
        ? hasKey(mergedOpenKeys, key)
          ? mergedOpenKeys
          : [...mergedOpenKeys, key]
        : mergedOpenKeys.filter(openKey => openKey !== key)
      commitOpenKeys(nextOpenKeys)
    },
  }

  let cls = 'menu'
  if (resolvedMode === 'horizontal') cls += ' menu-horizontal'
  else cls += ' menu-vertical'
  const resolvedSize = resolveSizeClass(size)
  if (resolvedSize) cls += ` menu-${resolvedSize}`
  if (className) cls += ` ${className}`

  const content =
    items && items.length
      ? items.map((entry, index) => renderDataEntry(entry, index, menuContextValue))
      : injectMenuContext(children, menuContextValue)

  return (
    <ul
      className={cls}
      style={style}
      role={resolvedMode === 'horizontal' ? 'menubar' : 'menu'}
      aria-orientation={resolvedMode === 'horizontal' ? 'horizontal' : 'vertical'}
    >
      {content}
    </ul>
  )
}

type MenuCompound = FC<MenuProps> & {
  Item: FC<MenuItemProps>
  Title: FC<MenuTitleProps>
  Dropdown: FC<MenuDropdownProps>
  DropdownToggle: FC<MenuDropdownToggleProps>
  Submenu: FC<SubmenuProps>
  SubMenu: FC<MenuSubMenuProps>
  ItemGroup: FC<MenuItemGroupProps>
  Divider: FC<MenuDividerProps>
}

const MenuCompound: MenuCompound = Object.assign(Menu, {
  Item,
  Title,
  Dropdown,
  DropdownToggle,
  Submenu,
  SubMenu,
  ItemGroup,
  Divider,
})

/** 默认导出菜单组件。 */
export default MenuCompound
