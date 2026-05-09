/* RUE_VAPOR_TRANSFORMED */
/*
Menu 组件概述
- 保留 Rue 当前 menu 视觉结构，并补齐更接近成熟组件库的导航能力。
- 同时支持 children 组合写法、旧版 kind 数据结构，以及 items 驱动的增强写法。
*/
import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { RouterLink } from '@rue-js/router'

export type MenuKey = string | number
export type MenuSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'
export type MenuDirection = 'vertical' | 'horizontal'
export type MenuMode = 'vertical' | 'horizontal' | 'inline'
export type MenuTriggerSubMenuAction = 'hover' | 'click'

export interface MenuClickInfo {
  key?: MenuKey
  keyPath: MenuKey[]
  item?: MenuDataEntry
  domEvent: MouseEvent
}

export interface MenuSelectInfo extends MenuClickInfo {
  key: MenuKey
  selectedKeys: MenuKey[]
}

export interface MenuTitleData {
  kind: 'title'
  as?: 'li' | 'h2'
  className?: string
  children?: any
}

export interface MenuDropdownToggleData {
  show?: boolean
  visible?: boolean
  className?: string
  onClick?: (event: MouseEvent) => void
  children?: any
}

export interface MenuDropdownData {
  show?: boolean
  visible?: boolean
  className?: string
  items?: ReadonlyArray<MenuDataEntry>
}

export interface MenuLegacySubmenuData {
  className?: string
  items?: ReadonlyArray<MenuDataEntry>
}

export interface MenuItemData {
  kind?: 'item'
  type?: undefined
  key?: MenuKey
  as?: 'a' | 'button' | 'span'
  href?: string
  to?: string
  target?: string
  rel?: string
  title?: string
  label?: any
  icon?: any
  extra?: any
  danger?: boolean
  onClick?: (event: MouseEvent) => void
  disabled?: boolean
  active?: boolean
  selected?: boolean
  focus?: boolean
  liClassName?: string
  className?: string
  children?: any
  dropdownToggle?: MenuDropdownToggleData
  dropdown?: MenuDropdownData
  submenu?: MenuLegacySubmenuData
  [key: string]: any
}

export interface MenuSubMenuData {
  type: 'submenu'
  key?: MenuKey
  label?: any
  icon?: any
  extra?: any
  title?: string
  disabled?: boolean
  className?: string
  popupClassName?: string
  children?: ReadonlyArray<MenuDataEntry>
  onTitleClick?: (info: { key?: MenuKey; domEvent: MouseEvent }) => void
}

export interface MenuGroupData {
  type: 'group'
  key?: MenuKey
  label?: any
  className?: string
  children?: ReadonlyArray<MenuDataEntry>
}

export interface MenuDividerData {
  type: 'divider'
  key?: MenuKey
  className?: string
  dashed?: boolean
}

export type MenuDataEntry =
  | MenuTitleData
  | MenuItemData
  | MenuSubMenuData
  | MenuGroupData
  | MenuDividerData

export interface MenuProps {
  size?: MenuSize
  direction?: MenuDirection
  mode?: MenuMode
  className?: string
  style?: any
  selectable?: boolean
  multiple?: boolean
  inlineIndent?: number
  triggerSubMenuAction?: MenuTriggerSubMenuAction
  selectedKeys?: ReadonlyArray<MenuKey>
  defaultSelectedKeys?: ReadonlyArray<MenuKey>
  openKeys?: ReadonlyArray<MenuKey>
  defaultOpenKeys?: ReadonlyArray<MenuKey>
  onClick?: (info: MenuClickInfo) => void
  onSelect?: (info: MenuSelectInfo) => void
  onDeselect?: (info: MenuSelectInfo) => void
  onOpenChange?: (openKeys: MenuKey[]) => void
  children?: any
  items?: ReadonlyArray<MenuDataEntry>
}

export interface MenuItemProps {
  eventKey?: MenuKey
  as?: 'a' | 'button' | 'span'
  href?: string
  to?: string
  target?: string
  rel?: string
  title?: string
  icon?: any
  extra?: any
  danger?: boolean
  onClick?: (event: MouseEvent) => void
  disabled?: boolean
  active?: boolean
  selected?: boolean
  focus?: boolean
  liClassName?: string
  className?: string
  children?: any
  [key: string]: any
}

export interface MenuTitleProps {
  as?: 'li' | 'h2'
  className?: string
  children?: any
}

export interface MenuDropdownProps {
  show?: boolean
  visible?: boolean
  className?: string
  children?: any
}

export interface MenuDropdownToggleProps {
  show?: boolean
  visible?: boolean
  className?: string
  onClick?: (event: MouseEvent) => void
  children?: any
}

export interface SubmenuProps {
  className?: string
  children?: any
}

export interface MenuSubMenuProps {
  eventKey?: MenuKey
  title?: any
  icon?: any
  extra?: any
  disabled?: boolean
  className?: string
  popupClassName?: string
  open?: boolean
  defaultOpen?: boolean
  onTitleClick?: (info: { key?: MenuKey; domEvent: MouseEvent }) => void
  onOpenChange?: (open: boolean) => void
  children?: any
  __menuContext?: MenuContextValue | null
}

export interface MenuItemGroupProps {
  title?: any
  className?: string
  children?: any
}

export interface MenuDividerProps {
  className?: string
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

const RUE_COMPONENT_TYPE_KEY = '__rue_component_type'
const MENU_CONTEXT_PROP = '__menuContext'

const appendClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

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

const normalizeKeys = (keys?: ReadonlyArray<MenuKey>) => {
  return Array.isArray(keys) ? [...keys] : []
}

const hasKey = (keys: ReadonlyArray<MenuKey>, target?: MenuKey) => {
  if (target === undefined) return false
  return keys.some(key => key === target)
}

const isRenderableNode = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object'

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

  const type = value[RUE_COMPONENT_TYPE_KEY]
  if (type === Item || type === SubMenu) {
    nextProps[MENU_CONTEXT_PROP] = menuContext
  }

  value.props = nextProps
  return value
}

const toggleKey = (keys: ReadonlyArray<MenuKey>, target: MenuKey) => {
  return hasKey(keys, target) ? keys.filter(key => key !== target) : [...keys, target]
}

const getMenuMode = (mode?: MenuMode, direction?: MenuDirection): MenuMode => {
  if (mode) return mode
  if (direction === 'horizontal') return 'horizontal'
  return 'vertical'
}

const getAnchorRel = (target?: string, rel?: string) => {
  if (target === '_blank' && !rel) return 'noreferrer'
  return rel
}

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

    return (
      <RouterLink
        className={innerClassName}
        to={to}
        title={title}
        aria-current={mergedSelected ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={handleClick}
      >
        {contentNode}
      </RouterLink>
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

const Title: FC<MenuTitleProps> = ({ as = 'li', className, children }) => {
  const cls = appendClassName('menu-title', className)
  if (as === 'h2') return <h2 className={cls}>{children}</h2>
  return <li className={cls}>{children}</li>
}

const Dropdown: FC<MenuDropdownProps> = ({ show, visible, className, children }) => {
  const mergedVisible = visible ?? show
  let cls = 'menu-dropdown'
  if (mergedVisible) cls += ' menu-dropdown-show'
  if (className) cls += ` ${className}`
  return <ul className={cls}>{children}</ul>
}

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

const Submenu: FC<SubmenuProps> = ({ className, children }) => {
  return <ul className={className}>{children}</ul>
}

const Item: FC<MenuItemProps & { __menuContext?: MenuContextValue | null }> = ({
  liClassName,
  __menuContext = null,
  ...rest
}) => {
  const menuContext = __menuContext
  return <li className={liClassName}>{renderMenuAction(rest, menuContext)}</li>
}

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

const ItemGroup: FC<MenuItemGroupProps> = ({ title, className, children }) => {
  return (
    <li className={className}>
      <div className="menu-title">{title}</div>
      <ul>{children}</ul>
    </li>
  )
}

const SubMenu: FC<MenuSubMenuProps> = ({
  eventKey,
  title,
  icon,
  extra,
  disabled,
  className,
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
          suffix: <span>{mergedOpen ? '▾' : '▸'}</span>,
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

  if (itemEntry.dropdown || itemEntry.submenu || itemEntry.dropdownToggle) {
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
        {itemEntry.dropdownToggle ? (
          <DropdownToggle
            show={(itemEntry.dropdownToggle as any).show}
            visible={itemEntry.dropdownToggle.visible}
            className={itemEntry.dropdownToggle.className}
            onClick={itemEntry.dropdownToggle.onClick}
          >
            {itemEntry.dropdownToggle.children}
          </DropdownToggle>
        ) : null}
        {itemEntry.dropdown ? (
          <Dropdown
            show={(itemEntry.dropdown as any).show}
            visible={itemEntry.dropdown.visible}
            className={itemEntry.dropdown.className}
          >
            {itemEntry.dropdown.items?.map((child, childIndex) =>
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
    >
      {content}
    </Item>
  )
}

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

export default MenuCompound
