/* RUE_VAPOR_TRANSFORMED */
/*
Breadcrumbs 组件概述
- 推荐使用 items：补齐 path/params、itemRender、menu 与自定义 separator 等能力。
- 保留 children 形式：继续兼容现有 Breadcrumbs.Item 组合写法，不破坏旧 demo。
- 视觉沿用 Rue 当前的箭头分隔风格，仅在 items 模式切换为可控的手动分隔符渲染。
*/
import type { FC } from '@rue-js/rue'
import Dropdown from '../dropdown/index'

type BreadcrumbsParamValue = string | number | boolean | null | undefined
type BreadcrumbsMenuAlign = 'start' | 'center' | 'end'
type BreadcrumbsMenuDirection = 'top' | 'bottom' | 'left' | 'right'

export interface BreadcrumbsParams {
  [key: string]: BreadcrumbsParamValue
}

export interface BreadcrumbsMenuItem {
  key?: string | number
  label?: any
  title?: any
  href?: string
  target?: string
  rel?: string
  disabled?: boolean
  className?: string
  onClick?: (event: MouseEvent) => void
}

export interface BreadcrumbsMenu {
  items?: ReadonlyArray<BreadcrumbsMenuItem>
  align?: BreadcrumbsMenuAlign
  direction?: BreadcrumbsMenuDirection
  className?: string
  contentClassName?: string
}

export interface BreadcrumbsRouteItem {
  key?: string | number
  title?: any
  label?: any
  href?: string
  path?: string
  icon?: any
  className?: string
  linkClassName?: string
  current?: boolean
  disabled?: boolean
  target?: string
  rel?: string
  menu?: BreadcrumbsMenu
  onClick?: (event: MouseEvent) => void
}

export interface BreadcrumbsSeparatorItem {
  key?: string | number
  type: 'separator'
  separator?: any
}

export type BreadcrumbsDataItem = BreadcrumbsRouteItem | BreadcrumbsSeparatorItem

export interface BreadcrumbsProps {
  className?: string
  children?: any
  items?: ReadonlyArray<BreadcrumbsDataItem>
  routes?: ReadonlyArray<BreadcrumbsDataItem>
  separator?: any
  params?: BreadcrumbsParams
  dropdownIcon?: any
  itemRender?: (
    route: BreadcrumbsRouteItem,
    params: BreadcrumbsParams,
    routes: ReadonlyArray<BreadcrumbsRouteItem>,
    paths: string[],
    href?: string,
  ) => any
}

export interface BreadcrumbsItemProps extends BreadcrumbsRouteItem {
  children?: any
}

const normalizeChildren = (children?: any) => {
  if (Array.isArray(children)) {
    return children
  }
  return children != null ? [children] : []
}

const mergeClassName = (base?: string, className?: string) => {
  if (base && className) return `${base} ${className}`
  return base ?? className ?? ''
}

const isSeparatorItem = (item: BreadcrumbsDataItem): item is BreadcrumbsSeparatorItem => {
  return !!item && typeof item === 'object' && 'type' in item && item.type === 'separator'
}

const resolveItemTitle = (item: Pick<BreadcrumbsRouteItem, 'title' | 'label'>, fallback?: any) =>
  item.title ?? item.label ?? fallback

const resolvePath = (params: BreadcrumbsParams, path?: string) => {
  if (path === undefined) {
    return undefined
  }

  let mergedPath = path.replace(/^\//, '').replace(/\/$/, '')
  Object.keys(params).forEach(key => {
    const value = params[key]
    if (value != null) {
      mergedPath = mergedPath.replace(`:${key}`, String(value))
    }
  })
  return mergedPath
}

const resolveHref = (href: string | undefined, paths: string[], hasPath: boolean) => {
  if (href) {
    return href
  }
  if (!hasPath) {
    return undefined
  }
  const mergedPath = paths.filter(Boolean).join('/')
  return mergedPath ? `/${mergedPath}` : '/'
}

const resolveLinkRel = (target?: string, rel?: string) => {
  if (target === '_blank' && !rel) {
    return 'noreferrer'
  }
  return rel
}

const preventWhenDisabled = (disabled?: boolean, onClick?: (event: MouseEvent) => void) => {
  return (event: MouseEvent) => {
    if (disabled) {
      if (typeof (event as any).preventDefault === 'function') {
        ;(event as any).preventDefault()
      }
      if (typeof (event as any).stopPropagation === 'function') {
        ;(event as any).stopPropagation()
      }
      return
    }
    if (onClick) {
      onClick(event)
    }
  }
}

const DefaultSeparator: FC = () => {
  return <span className="inline-block h-1.5 w-1.5 rotate-45 border-t border-r border-current" />
}

const DefaultDropdownIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  )
}

const renderMenuTrigger = (menu: BreadcrumbsMenu | undefined, dropdownIcon: any, title: any) => {
  if (!menu?.items || menu.items.length === 0) {
    return null
  }

  const triggerLabel = typeof title === 'string' && title ? `打开 ${title} 菜单` : '打开路径菜单'

  return (
    <Dropdown
      align={menu.align}
      direction={menu.direction}
      className={mergeClassName('ms-1', menu.className)}
    >
      <Dropdown.Trigger
        className="inline-flex items-center justify-center rounded-full text-base-content/60 outline-none transition-colors hover:text-base-content"
        aria-label={triggerLabel}
      >
        {dropdownIcon ?? <DefaultDropdownIcon />}
      </Dropdown.Trigger>
      <Dropdown.Content
        as="ul"
        tabIndex={-1}
        className={mergeClassName(
          'menu z-1 mt-2 min-w-40 rounded-box border border-base-300/60 bg-base-100 p-2 shadow-sm',
          menu.contentClassName,
        )}
      >
        {menu.items.map((menuItem, index) => {
          const menuTitle = resolveItemTitle(menuItem)
          const handleClick = preventWhenDisabled(menuItem.disabled, menuItem.onClick)
          const className = menuItem.className ?? undefined

          if (menuItem.href && !menuItem.disabled) {
            return (
              <li key={menuItem.key ?? index}>
                <a
                  className={className}
                  href={menuItem.href}
                  target={menuItem.target}
                  rel={resolveLinkRel(menuItem.target, menuItem.rel)}
                  onClick={menuItem.onClick ? handleClick : undefined}
                >
                  {menuTitle}
                </a>
              </li>
            )
          }

          if (!menuItem.disabled && menuItem.onClick) {
            return (
              <li key={menuItem.key ?? index}>
                <button className={className} type="button" onClick={handleClick}>
                  {menuTitle}
                </button>
              </li>
            )
          }

          return (
            <li key={menuItem.key ?? index}>
              <span
                className={mergeClassName(
                  menuItem.disabled ? 'cursor-not-allowed opacity-50' : undefined,
                  className,
                )}
              >
                {menuTitle}
              </span>
            </li>
          )
        })}
      </Dropdown.Content>
    </Dropdown>
  )
}

interface RenderItemContentOptions {
  item: BreadcrumbsRouteItem
  href?: string
  isLast: boolean
  allowAutoCurrent: boolean
  params: BreadcrumbsParams
  routes: ReadonlyArray<BreadcrumbsRouteItem>
  paths: string[]
  dropdownIcon?: any
  itemRender?: BreadcrumbsProps['itemRender']
  fallbackChildren?: any
}

const renderItemContent = ({
  item,
  href,
  isLast,
  allowAutoCurrent,
  params,
  routes,
  paths,
  dropdownIcon,
  itemRender,
  fallbackChildren,
}: RenderItemContentOptions) => {
  const title = resolveItemTitle(item, fallbackChildren)
  const isCurrent = item.current ?? (allowAutoCurrent && isLast && !href)
  const handleClick = preventWhenDisabled(item.disabled, item.onClick)

  if (itemRender) {
    return (
      <>
        {itemRender(item, params, routes, paths, href)}
        {renderMenuTrigger(item.menu, dropdownIcon, title)}
      </>
    )
  }

  const content = (
    <>
      {item.icon ? (
        <span
          className="inline-flex shrink-0 items-center justify-center"
          aria-hidden={title != null ? 'true' : undefined}
        >
          {item.icon}
        </span>
      ) : null}
      {title}
    </>
  )

  const contentClassName =
    mergeClassName(
      isCurrent
        ? 'cursor-default font-medium text-base-content no-underline'
        : item.disabled
          ? 'cursor-not-allowed opacity-50 no-underline'
          : undefined,
      item.linkClassName,
    ) || undefined

  if (href && !item.disabled && !isCurrent) {
    return (
      <>
        <a
          className={contentClassName}
          href={href}
          target={item.target}
          rel={resolveLinkRel(item.target, item.rel)}
          onClick={item.onClick ? handleClick : undefined}
        >
          {content}
        </a>
        {renderMenuTrigger(item.menu, dropdownIcon, title)}
      </>
    )
  }

  if (!item.disabled && !isCurrent && item.onClick) {
    return (
      <>
        <button className={contentClassName} type="button" onClick={handleClick}>
          {content}
        </button>
        {renderMenuTrigger(item.menu, dropdownIcon, title)}
      </>
    )
  }

  return (
    <>
      <span className={contentClassName} aria-current={isCurrent ? 'page' : undefined}>
        {content}
      </span>
      {renderMenuTrigger(item.menu, dropdownIcon, title)}
    </>
  )
}

/** Breadcrumbs 主组件：推荐 items，保留 children 兼容写法。 */
const Breadcrumbs: FC<BreadcrumbsProps> = ({
  className,
  children,
  items,
  routes,
  separator,
  params = {},
  dropdownIcon,
  itemRender,
}) => {
  const mergedItems = items && items.length ? items : routes
  let cls = 'breadcrumbs'
  if (mergedItems && mergedItems.length) {
    cls += ' [&>ul>li+li]:before:hidden'
  }
  if (className) cls += ` ${className}`

  if (mergedItems && mergedItems.length) {
    const renderableItems = mergedItems.filter(
      item => !isSeparatorItem(item),
    ) as BreadcrumbsRouteItem[]
    const resolvedSeparator = separator ?? <DefaultSeparator />
    const paths: string[] = []
    let routeIndex = -1
    let hasRenderedItem = false
    let separatorBefore = resolvedSeparator

    return (
      <div className={cls}>
        <ul>
          {mergedItems.map((item, index) => {
            if (isSeparatorItem(item)) {
              separatorBefore = item.separator ?? resolvedSeparator
              return null
            }

            routeIndex += 1

            const pathSegment = resolvePath(params, item.path)
            const pathsForItem =
              pathSegment !== undefined && pathSegment !== '' ? [...paths, pathSegment] : [...paths]
            const href = resolveHref(item.href, pathsForItem, pathSegment !== undefined)

            if (pathSegment !== undefined && pathSegment !== '') {
              paths.push(pathSegment)
            }

            const rendered = (
              <li className={item.className ?? undefined} key={item.key ?? index}>
                {hasRenderedItem ? (
                  <span
                    className="pointer-events-none inline-flex shrink-0 items-center justify-center ms-2 me-3 text-base-content/40"
                    aria-hidden="true"
                  >
                    {separatorBefore}
                  </span>
                ) : null}
                {renderItemContent({
                  item,
                  href,
                  isLast: routeIndex === renderableItems.length - 1,
                  allowAutoCurrent: true,
                  params,
                  routes: renderableItems,
                  paths: pathsForItem,
                  dropdownIcon,
                  itemRender,
                })}
              </li>
            )

            hasRenderedItem = true
            separatorBefore = resolvedSeparator
            return rendered
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className={cls}>
      <ul>{children}</ul>
    </div>
  )
}

/** 子项组件：children 模式的轻量增强版，支持 href、icon、menu 与 current。 */
const Item: FC<BreadcrumbsItemProps> = ({ className, children, ...rest }) => {
  return (
    <li className={className ?? undefined}>
      {renderItemContent({
        item: rest,
        href: rest.href,
        isLast: false,
        allowAutoCurrent: false,
        params: {},
        routes: [rest],
        paths: [],
        fallbackChildren: children,
      })}
    </li>
  )
}

type BreadcrumbsCompound = FC<BreadcrumbsProps> & {
  Item: FC<BreadcrumbsItemProps>
}

const BreadcrumbsCompound: BreadcrumbsCompound = Object.assign(Breadcrumbs, {
  Item,
})

export default BreadcrumbsCompound
