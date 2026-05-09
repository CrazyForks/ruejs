/* RUE_VAPOR_TRANSFORMED */
/*
Tabs 组件概述
- 保留 Rue 当前的 daisyUI 视觉基底，并补齐更接近成熟组件库的 tabs API。
- 同时支持受控 / 非受控、items.children 内容面板、额外操作区与可编辑标签头部。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, render as renderRue, useRef, watch } from '@rue-js/rue'

export type TabsStyle = 'box' | 'border' | 'lift'
export type TabsType = 'line' | 'card' | 'editable-card'
export type TabsPlacement = 'top' | 'bottom'
export type TabsExtendedPlacement = TabsPlacement | 'start' | 'end'
export type TabsSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'large'

export interface TabsIndicator {
  align?: 'start' | 'center' | 'end'
  size?: number | string
  className?: string
  style?: Record<string, any>
}

export interface TabBarExtraContentMap {
  left?: any
  right?: any
}

export interface TabItem {
  key: string
  label: any
  children?: any
  disabled?: boolean
  className?: string
  contentClassName?: string
  closable?: boolean
  closeIcon?: any
  icon?: any
}

export interface TabsProps {
  items: TabItem[]
  activeKey?: string
  defaultActiveKey?: string
  onChange?: (key: string) => void
  onEdit?: (eventOrKey: MouseEvent | string, action: 'add' | 'remove') => void
  style?: TabsStyle
  type?: TabsType
  placement?: TabsPlacement
  tabPlacement?: TabsExtendedPlacement
  size?: TabsSize
  centered?: boolean
  destroyOnHidden?: boolean
  hideAdd?: boolean
  addIcon?: any
  removeIcon?: any
  indicator?: TabsIndicator
  tabBarExtraContent?: any | TabBarExtraContentMap
  className?: string
  tabBarClassName?: string
  contentClassName?: string
}

let tabsIdSeed = 0

const appendClassName = (base?: string, className?: string) => {
  if (!base) return className ?? ''
  return className ? `${base} ${className}` : base
}

const resolveVisualStyle = (style?: TabsStyle, type?: TabsType): TabsStyle | undefined => {
  if (style) return style
  if (type === 'card' || type === 'editable-card') return 'box'
  if (type === 'line') return 'border'
  return undefined
}

const resolveSizeClass = (size?: TabsSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'middle':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

const resolveInitialActiveKey = (items: TabItem[], preferredKey?: string) => {
  if (preferredKey !== undefined && items.some(item => item.key === preferredKey)) {
    return preferredKey
  }
  return items.find(item => !item.disabled)?.key ?? items[0]?.key ?? ''
}

const normalizeExtraContent = (extra?: any | TabBarExtraContentMap): TabBarExtraContentMap => {
  if (
    extra &&
    typeof extra === 'object' &&
    !Array.isArray(extra) &&
    ('left' in extra || 'right' in extra)
  ) {
    return extra as TabBarExtraContentMap
  }
  return { right: extra }
}

const buildTabsClassName = (
  style?: TabsStyle,
  placement?: TabsExtendedPlacement,
  size?: TabsSize,
  centered?: boolean,
  className?: string,
) => {
  let cls = 'tabs'
  if (style === 'box') cls += ' tabs-box'
  if (style === 'border') cls += ' tabs-border'
  if (style === 'lift') cls += ' tabs-lift'
  if (placement === 'bottom') cls += ' tabs-bottom'
  if (placement === 'start' || placement === 'end') cls += ' flex-col items-stretch'
  if (resolveSizeClass(size)) cls += ` tabs-${resolveSizeClass(size)}`
  if (centered && placement !== 'start' && placement !== 'end') cls += ' justify-center'
  if (className) cls += ` ${className}`
  return cls
}

const resolveIndicatorWidth = (size?: number | string) => {
  if (typeof size === 'number') return `${size}px`
  return size ?? '100%'
}

const resolveIndicatorAlignment = (align?: TabsIndicator['align']) => {
  switch (align) {
    case 'start':
      return 'self-start'
    case 'end':
      return 'self-end'
    default:
      return 'self-center'
  }
}

const buildPanelClassName = (contentClassName?: string, active = true) =>
  appendClassName(
    appendClassName(
      'tab-content rounded-box border border-base-300 bg-base-100 p-5',
      active ? 'block' : 'hidden',
    ),
    contentClassName,
  )

/** Tabs 主组件：支持 items 内容面板、额外操作区与可编辑头部。 */
const Tabs: FC<TabsProps> = ({
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  onEdit,
  style,
  type,
  placement,
  tabPlacement,
  size,
  centered,
  destroyOnHidden,
  hideAdd,
  addIcon,
  removeIcon,
  indicator,
  tabBarExtraContent,
  className,
  tabBarClassName,
  contentClassName,
}) => {
  const normalizedItems = items ?? []
  const resolvedPlacement = tabPlacement ?? placement ?? 'top'
  const resolvedStyle = resolveVisualStyle(style, type)
  const currentSeedRef = useRef<string>()
  if (!currentSeedRef.current) {
    currentSeedRef.current = `rue-tabs-${tabsIdSeed++}`
  }
  const currentSeed = currentSeedRef.current!
  const uncontrolledActiveKey = ref(
    resolveInitialActiveKey(normalizedItems, defaultActiveKey ?? activeKey),
  )
  const tabListHostRef = useRef<HTMLDivElement>()
  const panelsHostRef = useRef<HTMLDivElement>()
  const destroyPanelHostsRef = useRef<Map<string, HTMLDivElement>>()
  const activeDestroyPanelKeyRef = useRef<string | null>()
  const lastDestroyItemsRef = useRef<TabItem[] | null>()
  if (!destroyPanelHostsRef.current) {
    destroyPanelHostsRef.current = new Map()
  }
  const hasPanels = normalizedItems.some(item => item.children != null)
  const extraContent = normalizeExtraContent(tabBarExtraContent)
  const isVertical = resolvedPlacement === 'start' || resolvedPlacement === 'end'
  const replaceDefaultIndicator = !!indicator && resolvedStyle === 'border'

  const getEffectiveActiveKey = () => {
    const mergedActiveKey =
      activeKey ?? uncontrolledActiveKey.value ?? resolveInitialActiveKey(normalizedItems)

    return normalizedItems.some(item => item.key === mergedActiveKey)
      ? mergedActiveKey
      : resolveInitialActiveKey(normalizedItems, defaultActiveKey ?? activeKey)
  }

  const commitChange = (key: string) => {
    if (key === getEffectiveActiveKey()) return
    if (activeKey === undefined) {
      uncontrolledActiveKey.value = key
    }
    if (onChange) onChange(key)
  }

  const handleEditAdd = (event: MouseEvent) => {
    if (onEdit) onEdit(event, 'add')
  }

  const rootClassName = appendClassName(
    appendClassName(appendClassName('rue-tabs', isVertical ? 'block' : 'block'), className),
    hasPanels ? 'w-full' : undefined,
  )
  const tabsClassName = buildTabsClassName(
    resolvedStyle,
    resolvedPlacement,
    size,
    centered,
    appendClassName(tabBarClassName, isVertical ? 'w-full' : undefined),
  )
  const addTrigger = type === 'editable-card' && hideAdd !== true && !!onEdit
  const addButtonNode = addTrigger ? (
    <button
      type="button"
      className="btn btn-ghost btn-sm shrink-0"
      aria-label="新增标签"
      onClick={(event: MouseEvent) => handleEditAdd(event)}
    >
      {addIcon ?? '+'}
    </button>
  ) : null

  const renderTabsNode = () => (
    <div
      role="tablist"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      className={tabsClassName}
    >
      {normalizedItems.map(item => {
        const active = getEffectiveActiveKey() === item.key
        const closable = type === 'editable-card' && !!onEdit && (item.closable ?? !item.disabled)
        const tabId = `${currentSeed}-tab-${item.key}`
        const panelId = `${currentSeed}-panel-${item.key}`

        return (
          <button
            type="button"
            role="tab"
            id={tabId}
            key={item.key}
            aria-selected={active ? 'true' : 'false'}
            aria-controls={item.children != null ? panelId : undefined}
            className={appendClassName(
              appendClassName(
                appendClassName(
                  appendClassName(
                    appendClassName(
                      'tab',
                      active
                        ? appendClassName(
                            'tab-active',
                            replaceDefaultIndicator
                              ? 'rue-tabs-indicator-active before:hidden'
                              : undefined,
                          )
                        : undefined,
                    ),
                    item.disabled ? 'tab-disabled' : undefined,
                  ),
                  isVertical ? 'justify-start' : undefined,
                ),
                closable ? 'gap-2 pr-2' : undefined,
              ),
              item.className,
            )}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              commitChange(item.key)
            }}
          >
            {item.icon != null ? (
              <span
                className="inline-flex shrink-0 items-center justify-center"
                aria-hidden={item.label != null ? 'true' : undefined}
              >
                {item.icon}
              </span>
            ) : null}
            <span className="relative inline-flex min-w-0 flex-col">
              <span className="truncate">{item.label}</span>
              {active && indicator ? (
                <span
                  className={appendClassName(
                    'mt-1 inline-flex h-0.5 rounded-full bg-current opacity-70',
                    appendClassName(
                      resolveIndicatorAlignment(indicator.align),
                      indicator.className,
                    ),
                  )}
                  style={{
                    width: resolveIndicatorWidth(indicator.size),
                    ...indicator.style,
                  }}
                />
              ) : null}
            </span>
            {closable ? (
              <span
                role="button"
                tabindex={item.disabled ? -1 : 0}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
                aria-label={`移除 ${item.key}`}
                onClick={(event: MouseEvent) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (item.disabled || !onEdit) return
                  onEdit(item.key, 'remove')
                }}
                onKeyDown={(event: KeyboardEvent) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }
                  event.preventDefault()
                  event.stopPropagation()
                  if (item.disabled || !onEdit) return
                  onEdit(item.key, 'remove')
                }}
              >
                {item.closeIcon ?? removeIcon ?? '×'}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )

  const renderPanelsNode = () => {
    if (!hasPanels) return null

    if (destroyOnHidden) {
      const activeItem = normalizedItems.find(item => item.key === getEffectiveActiveKey())
      if (!activeItem || activeItem.children == null) return null

      return (
        <div
          key={`${activeItem.key}-panel`}
          role="tabpanel"
          id={`${currentSeed}-panel-${activeItem.key}`}
          aria-labelledby={`${currentSeed}-tab-${activeItem.key}`}
          aria-hidden="false"
          className={buildPanelClassName(activeItem.contentClassName)}
        >
          {activeItem.children}
        </div>
      )
    }

    return (
      <>
        {normalizedItems.map(item => {
          const active = item.key === getEffectiveActiveKey()

          return (
            <div
              key={`${item.key}-panel`}
              role="tabpanel"
              id={`${currentSeed}-panel-${item.key}`}
              aria-labelledby={`${currentSeed}-tab-${item.key}`}
              aria-hidden={active ? 'false' : 'true'}
              className={buildPanelClassName(item.contentClassName, active)}
            >
              {item.children}
            </div>
          )
        })}
      </>
    )
  }

  const syncDestroyPanelHost = (host: HTMLDivElement, item: TabItem) => {
    host.setAttribute('role', 'tabpanel')
    host.id = `${currentSeed}-panel-${item.key}`
    host.setAttribute('aria-labelledby', `${currentSeed}-tab-${item.key}`)
    host.setAttribute('aria-hidden', 'false')
    host.className = buildPanelClassName(item.contentClassName)
  }

  const clearDestroyPanelHosts = () => {
    for (const host of destroyPanelHostsRef.current!.values()) {
      renderRue([], host)
      host.remove()
    }
    destroyPanelHostsRef.current!.clear()
    activeDestroyPanelKeyRef.current = null
    lastDestroyItemsRef.current = null
  }

  const renderDestroyOnHiddenPanel = () => {
    const parent = panelsHostRef.current
    if (!parent) return

    if (lastDestroyItemsRef.current && lastDestroyItemsRef.current !== normalizedItems) {
      clearDestroyPanelHosts()
    }
    lastDestroyItemsRef.current = normalizedItems

    const activeItem = normalizedItems.find(item => item.key === getEffectiveActiveKey())
    const nextKey = activeItem?.key ?? null
    const prevKey = activeDestroyPanelKeyRef.current ?? null

    if (prevKey && prevKey !== nextKey) {
      const prevHost = destroyPanelHostsRef.current!.get(prevKey)
      if (prevHost && prevHost.parentNode === parent) {
        parent.removeChild(prevHost)
      }
    }

    if (!activeItem || activeItem.children == null) {
      parent.replaceChildren()
      activeDestroyPanelKeyRef.current = nextKey
      return
    }

    let nextHost = destroyPanelHostsRef.current!.get(activeItem.key)
    if (!nextHost) {
      nextHost = document.createElement('div')
      syncDestroyPanelHost(nextHost, activeItem)
      renderRue(activeItem.children, nextHost)
      destroyPanelHostsRef.current!.set(activeItem.key, nextHost)
    } else if (prevKey === nextKey) {
      syncDestroyPanelHost(nextHost, activeItem)
      renderRue(activeItem.children, nextHost)
    } else {
      syncDestroyPanelHost(nextHost, activeItem)
    }

    if (
      nextHost.parentNode !== parent ||
      parent.childNodes.length !== 1 ||
      parent.firstChild !== nextHost
    ) {
      parent.replaceChildren(nextHost)
    }

    activeDestroyPanelKeyRef.current = activeItem.key
  }

  const renderManagedRegions = () => {
    if (tabListHostRef.current) {
      renderRue(renderTabsNode(), tabListHostRef.current)
    }
    if (panelsHostRef.current) {
      if (destroyOnHidden) {
        renderDestroyOnHiddenPanel()
      } else {
        clearDestroyPanelHosts()
        renderRue(renderPanelsNode(), panelsHostRef.current)
      }
    }
  }

  onMounted(() => {
    renderManagedRegions()
  })

  watch(
    () => [
      activeKey,
      defaultActiveKey,
      uncontrolledActiveKey.value,
      items,
      destroyOnHidden,
      resolvedPlacement,
      resolvedStyle,
      size,
      centered,
      indicator?.align,
      indicator?.size,
      indicator?.className,
      tabBarClassName,
      contentClassName,
    ],
    () => {
      renderManagedRegions()
    },
    { immediate: true },
  )

  if (isVertical) {
    return (
      <div className={rootClassName}>
        <div
          className={appendClassName(
            'flex items-start gap-4',
            resolvedPlacement === 'end' ? 'flex-row-reverse' : undefined,
          )}
        >
          <div className="flex w-full max-w-xs shrink-0 flex-col gap-3">
            {extraContent.left != null ? <div className="shrink-0">{extraContent.left}</div> : null}
            <div
              ref={(element: HTMLDivElement | null) =>
                (tabListHostRef.current = element ?? undefined)
              }
            />
            {addButtonNode != null || extraContent.right != null ? (
              <div className="flex flex-wrap items-center gap-2">
                {addButtonNode}
                {extraContent.right != null ? (
                  <div className="shrink-0">{extraContent.right}</div>
                ) : null}
              </div>
            ) : null}
          </div>
          {hasPanels ? (
            <div
              ref={(element: HTMLDivElement | null) =>
                (panelsHostRef.current = element ?? undefined)
              }
              className={appendClassName('min-w-0 flex-1', contentClassName)}
            />
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={rootClassName}>
      <div
        className={appendClassName(
          'flex gap-4',
          resolvedPlacement === 'bottom' ? 'flex-col-reverse' : 'flex-col',
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          {extraContent.left != null ? <div className="shrink-0">{extraContent.left}</div> : null}
          <div
            className={appendClassName(
              'min-w-0 flex-1',
              centered ? 'flex justify-center' : undefined,
            )}
          >
            <div
              ref={(element: HTMLDivElement | null) =>
                (tabListHostRef.current = element ?? undefined)
              }
            />
          </div>
          {addButtonNode}
          {extraContent.right != null ? <div className="shrink-0">{extraContent.right}</div> : null}
        </div>
        {hasPanels ? (
          <div
            ref={(element: HTMLDivElement | null) => (panelsHostRef.current = element ?? undefined)}
            className={appendClassName('min-w-0 flex-1', contentClassName)}
          />
        ) : null}
      </div>
    </div>
  )
}

export default Tabs
