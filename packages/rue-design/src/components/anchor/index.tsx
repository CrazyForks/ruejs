import type { FC } from '@rue-js/rue'
import { Slot, getCurrentInstance, onMounted, onUnmounted, ref, useRef, watch } from '@rue-js/rue'

export type AnchorKey = string | number
export type AnchorDirection = 'vertical' | 'horizontal'
export type AnchorContainer = HTMLElement | Window

export interface AnchorItem {
  key?: AnchorKey
  href: string
  title: any
  target?: string
  replace?: boolean
  description?: any
  className?: string
  disabled?: boolean
  children?: AnchorItem[]
}

export interface AnchorLinkProps extends Omit<AnchorItem, 'children'> {
  children?: any
}

export interface AnchorClassNames {
  root?: string
  list?: string
  item?: string
  link?: string
  title?: string
  description?: string
  indicator?: string
}

export interface AnchorStyles {
  root?: Record<string, any>
  list?: Record<string, any>
  item?: Record<string, any>
  link?: Record<string, any>
  title?: Record<string, any>
  description?: Record<string, any>
  indicator?: Record<string, any>
}

export interface AnchorProps {
  className?: string
  rootClassName?: string
  style?: Record<string, any>
  children?: any
  offsetTop?: number
  bounds?: number
  affix?: boolean
  showInkInFixed?: boolean
  getContainer?: () => AnchorContainer | undefined
  getCurrentAnchor?: (activeLink: string) => string
  onClick?: (event: MouseEvent, link: { title: any; href: string }) => void
  targetOffset?: number
  onChange?: (currentActiveLink: string) => void
  items?: AnchorItem[]
  direction?: AnchorDirection
  replace?: boolean
  classNames?: AnchorClassNames
  styles?: AnchorStyles
  [key: string]: any
}

interface NormalizedAnchorItem extends Omit<AnchorItem, 'children'> {
  keyText: string
  level: number
  children?: NormalizedAnchorItem[]
}

const appendClassName = (base?: string, className?: string) => {
  if (base && className) return `${base} ${className}`
  return base ?? className ?? ''
}

const normalizeChildren = (children?: any) => {
  if (Array.isArray(children)) return children
  return children != null ? [children] : []
}

const createKeyText = (key: AnchorKey | undefined, href: string, level: number, index: number) => {
  const fallback = `${href || 'anchor'}:${level}:${index}`
  return key == null ? fallback : `${typeof key}:${String(key)}`
}

const isRenderableNode = (value: unknown): value is Record<string, any> => {
  return !!value && typeof value === 'object'
}

const isAnchorLinkNode = (value: unknown) => {
  if (!isRenderableNode(value)) return false
  return (value as any).type === AnchorLink
}

const extractHrefTargetId = (href?: string) => {
  if (!href) return ''
  const hashIndex = href.lastIndexOf('#')
  if (hashIndex < 0) return ''
  const targetId = href.slice(hashIndex + 1).trim()
  if (!targetId || targetId.startsWith('/')) return ''
  try {
    return decodeURIComponent(targetId)
  } catch {
    return targetId
  }
}

const resolveItemTitle = (item: Pick<AnchorItem, 'title' | 'href'>) => {
  return item.title ?? item.href
}

const parseLinkChildren = (children?: any, level = 0): AnchorItem[] => {
  return normalizeChildren(children).flatMap((child, _index) => {
    if (!isAnchorLinkNode(child)) return []

    const props = (child as any).props ?? {}
    const nestedChildren = parseLinkChildren(props.children, level + 1)
    const hasOnlyNestedLinks =
      nestedChildren.length > 0 &&
      normalizeChildren(props.children).every(entry => isAnchorLinkNode(entry))

    return [
      {
        key: props.key,
        href: props.href,
        title: props.title ?? (!hasOnlyNestedLinks ? props.children : undefined),
        target: props.target,
        replace: props.replace,
        description: props.description,
        className: props.className,
        disabled: !!props.disabled,
        children: nestedChildren,
      } satisfies AnchorItem,
    ]
  })
}

const normalizeItems = (
  items: AnchorItem[] | undefined,
  children: any,
  level = 0,
): NormalizedAnchorItem[] => {
  const sourceItems = items ?? parseLinkChildren(children)

  return (sourceItems ?? []).flatMap((item, index) => {
    if (!item || !item.href) return []

    return [
      {
        ...item,
        title: resolveItemTitle(item),
        keyText: createKeyText(item.key, item.href, level, index),
        level,
        children: item.children?.length
          ? normalizeItems(item.children, undefined, level + 1)
          : undefined,
      },
    ]
  })
}

const flattenItems = (
  items: NormalizedAnchorItem[],
  includeChildren = true,
): NormalizedAnchorItem[] => {
  return items.flatMap(item => {
    if (!includeChildren || !item.children?.length) return [item]
    return [item, ...flattenItems(item.children, includeChildren)]
  })
}

const getDefaultContainer = (): AnchorContainer | undefined => {
  return typeof window === 'undefined' ? undefined : window
}

const isWindowContainer = (container?: AnchorContainer): container is Window => {
  return typeof window !== 'undefined' && container === window
}

const getContainerScrollTop = (container?: AnchorContainer) => {
  if (!container) return 0
  if (isWindowContainer(container)) {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
  }
  return container.scrollTop
}

const getContainerViewportHeight = (container?: AnchorContainer) => {
  if (!container) return 0
  if (isWindowContainer(container)) {
    return (
      window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0
    )
  }
  return container.clientHeight
}

const getContainerScrollHeight = (container?: AnchorContainer) => {
  if (!container) return 0
  if (isWindowContainer(container)) {
    return Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.offsetHeight,
      document.body.offsetHeight,
    )
  }
  return container.scrollHeight
}

const setContainerScrollTop = (container: AnchorContainer | undefined, top: number) => {
  const nextTop = Math.max(0, top)
  if (!container) return

  if (isWindowContainer(container)) {
    try {
      window.scrollTo({ top: nextTop, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, nextTop)
    }
    return
  }

  try {
    container.scrollTo({ top: nextTop, behavior: 'smooth' })
  } catch {
    container.scrollTop = nextTop
  }

  if (container.scrollTop !== nextTop) {
    container.scrollTop = nextTop
  }
}

const getOffsetTop = (element: HTMLElement, container?: AnchorContainer) => {
  const rect = element.getBoundingClientRect()
  if (!container || isWindowContainer(container)) {
    return rect.top + getContainerScrollTop(getDefaultContainer())
  }

  const containerRect = container.getBoundingClientRect()
  return rect.top - containerRect.top + container.scrollTop
}

const getScopedTargetElement = (targetId: string, container: HTMLElement) => {
  if (container.id === targetId) return container

  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return container.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`)
  }

  const elements = container.querySelectorAll<HTMLElement>('[id]')
  for (const element of Array.from(elements)) {
    if (element.id === targetId) return element
  }
  return null
}

const getTargetElement = (href?: string, container?: AnchorContainer) => {
  if (typeof document === 'undefined') return null
  const targetId = extractHrefTargetId(href)
  if (!targetId) return null

  if (container && !isWindowContainer(container)) {
    return getScopedTargetElement(targetId, container)
  }

  return document.getElementById(targetId)
}

const isNearContainerBottom = (container: AnchorContainer | undefined, tolerance = 1) => {
  if (!container) return false
  const viewportHeight = getContainerViewportHeight(container)
  const scrollHeight = getContainerScrollHeight(container)

  if (viewportHeight <= 0 || scrollHeight <= viewportHeight) return false

  return getContainerScrollTop(container) + viewportHeight >= scrollHeight - tolerance
}

const isExternalHref = (href: string) => /^(https?:)?\/\//.test(href)

const updateHashSafely = (href: string, replace?: boolean) => {
  if (typeof window === 'undefined') return
  if (!href.startsWith('#')) return

  const currentHash = window.location.hash || ''
  if (currentHash.startsWith('#/')) return

  const method = replace ? 'replaceState' : 'pushState'
  if (typeof window.history?.[method] === 'function') {
    window.history[method](null, '', href)
  }
}

const resolveStickyStyle = (affix?: boolean, offsetTop?: number) => {
  if (!affix) return undefined
  return {
    position: 'sticky',
    top: `${Math.max(0, offsetTop ?? 0)}px`,
  }
}

const AnchorLink: FC<AnchorLinkProps> = ({
  href,
  title,
  target,
  replace,
  description,
  className,
  disabled,
  children,
  ...rest
}) => {
  const slotSource = ((getCurrentInstance() as { propsRO?: Record<string, unknown> } | null)
    ?.propsRO ?? {
    children,
  }) as Record<string, unknown>
  const hasNestedSlot = title != null && children != null

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <a
        {...rest}
        href={disabled ? undefined : href}
        target={target}
        aria-disabled={disabled ? 'true' : undefined}
        data-rue-anchor-link-placeholder="true"
        data-rue-anchor-link-replace={replace ? 'true' : undefined}
        className={appendClassName('link inline-flex flex-col items-start gap-0.5', className)}
      >
        <span>{title ?? children ?? href}</span>
        {description ? <span className="text-xs opacity-70">{description}</span> : null}
      </a>
      {hasNestedSlot ? (
        <span className="ml-4 flex flex-col items-start gap-1 text-sm opacity-85">
          <Slot source={slotSource} />
        </span>
      ) : null}
    </span>
  )
}

const AnchorBase: FC<AnchorProps> = ({
  className,
  rootClassName,
  style,
  children,
  offsetTop,
  bounds = 5,
  affix = true,
  showInkInFixed = false,
  getContainer,
  getCurrentAnchor,
  onClick,
  targetOffset,
  onChange,
  items,
  direction = 'vertical',
  replace,
  classNames,
  styles,
  ...rest
}) => {
  const rootRef = useRef<HTMLElement>()
  const slotSource = ((getCurrentInstance() as { propsRO?: Record<string, unknown> } | null)
    ?.propsRO ?? {
    children,
  }) as Record<string, unknown>
  const normalizedItems = normalizeItems(items, children)
  const visibleItems = direction === 'horizontal' ? normalizedItems : normalizedItems
  const flatItems = flattenItems(normalizedItems, direction !== 'horizontal')
  const shouldRenderChildrenFallback = !items && normalizedItems.length === 0 && children != null
  const activeHrefRef = ref('')
  const rawActiveHrefRef = useRef('')
  const hasInitializedActiveRef = useRef(false)
  const scrollContainerRef = useRef<AnchorContainer>()
  const cleanupScrollRef = useRef<(() => void) | undefined>(undefined)
  const frameRef = useRef<number | undefined>(undefined)
  const activeOffset = targetOffset ?? offsetTop ?? 0
  const itemSignature = flatItems.map(item => item.href).join('|')
  const showIndicator = affix || showInkInFixed || direction === 'horizontal'

  const resolveContainer = () => getContainer?.() ?? getDefaultContainer()

  const clearFrame = () => {
    if (typeof window === 'undefined') return
    if (frameRef.current == null) return
    window.cancelAnimationFrame(frameRef.current)
    frameRef.current = undefined
  }

  const setActiveHref = (href: string, emitChange = true) => {
    const syncActiveLinkDom = () => {
      if (!rootRef.current) return

      const linkNodes =
        rootRef.current.querySelectorAll<HTMLAnchorElement>('[data-rue-anchor-href]')
      linkNodes.forEach(linkNode => {
        const isActive =
          (linkNode.getAttribute('data-rue-anchor-href') ?? '') === activeHrefRef.value

        linkNode.setAttribute('data-active', isActive ? 'true' : 'false')
        if (isActive) {
          linkNode.setAttribute('aria-current', 'location')
        } else {
          linkNode.removeAttribute('aria-current')
        }

        linkNode.classList.toggle('border-primary/35', isActive)
        linkNode.classList.toggle('bg-primary/8', isActive)
        linkNode.classList.toggle('text-primary', isActive)
        linkNode.classList.toggle('shadow-[0_12px_30px_-24px_rgba(59,130,246,0.85)]', isActive)
        linkNode.classList.toggle('border-transparent', !isActive)
        linkNode.classList.toggle('bg-base-100/65', !isActive)
        linkNode.classList.toggle('text-base-content/78', !isActive)
        linkNode.classList.toggle('hover:border-base-300', !isActive)
        linkNode.classList.toggle('hover:bg-base-100', !isActive)

        const indicatorNode = linkNode.querySelector<HTMLElement>(
          '[data-rue-anchor-indicator="true"]',
        )
        indicatorNode?.classList.toggle('border-primary', isActive)
        indicatorNode?.classList.toggle('bg-primary', isActive)
        indicatorNode?.classList.toggle('border-base-300', !isActive)
        indicatorNode?.classList.toggle('bg-base-100', !isActive)

        const titleNode = linkNode.querySelector<HTMLElement>('[data-rue-anchor-title="true"]')
        titleNode?.classList.toggle('text-primary', isActive)
        titleNode?.classList.toggle('text-base-content', !isActive)
      })
    }

    if (rawActiveHrefRef.current === href) {
      const resolved = typeof getCurrentAnchor === 'function' ? getCurrentAnchor(href) : href
      if (activeHrefRef.value !== resolved) {
        activeHrefRef.value = resolved
      }
      syncActiveLinkDom()
      return
    }

    rawActiveHrefRef.current = href
    activeHrefRef.value = typeof getCurrentAnchor === 'function' ? getCurrentAnchor(href) : href
    syncActiveLinkDom()
    if (!hasInitializedActiveRef.current) {
      hasInitializedActiveRef.current = true
      return
    }

    if (emitChange && onChange) onChange(href)
  }

  const syncActiveHref = () => {
    const container = resolveContainer()
    const scrollTop = getContainerScrollTop(container)
    let nextHref = ''
    let maxTop = Number.NEGATIVE_INFINITY

    flatItems.forEach(item => {
      const targetElement = getTargetElement(item.href, container)
      if (!targetElement) return
      const top = getOffsetTop(targetElement, container)
      if (top <= scrollTop + activeOffset + bounds && top >= maxTop) {
        maxTop = top
        nextHref = item.href
      }
    })

    const lastItem = flatItems[flatItems.length - 1]
    if (
      lastItem &&
      nextHref !== lastItem.href &&
      isNearContainerBottom(container, Math.max(bounds, 1))
    ) {
      const lastTargetElement = getTargetElement(lastItem.href, container)
      if (lastTargetElement) {
        nextHref = lastItem.href
      }
    }

    if (!nextHref && flatItems.length > 0) {
      nextHref = flatItems[0]?.href ?? ''
    }

    setActiveHref(nextHref)
  }

  const scheduleActiveSync = () => {
    syncActiveHref()

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return
    }

    clearFrame()
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = undefined
      syncActiveHref()
    })
  }

  const bindContainerListener = () => {
    if (typeof window === 'undefined') return

    const nextContainer = resolveContainer()
    if (!nextContainer) return
    if (scrollContainerRef.current === nextContainer && cleanupScrollRef.current) return

    cleanupScrollRef.current?.()

    const handleContainerChange = () => {
      scheduleActiveSync()
    }

    nextContainer.addEventListener('scroll', handleContainerChange)
    window.addEventListener('resize', handleContainerChange)

    scrollContainerRef.current = nextContainer
    cleanupScrollRef.current = () => {
      nextContainer.removeEventListener('scroll', handleContainerChange)
      window.removeEventListener('resize', handleContainerChange)
      scrollContainerRef.current = undefined
      cleanupScrollRef.current = undefined
    }
  }

  const scrollToHref = (href: string) => {
    const container = resolveContainer()
    const targetElement = getTargetElement(href, container)
    if (!targetElement) return

    const top = getOffsetTop(targetElement, container) - activeOffset
    setActiveHref(href)
    setContainerScrollTop(container, top)
    scheduleActiveSync()
  }

  onMounted(() => {
    bindContainerListener()
    scheduleActiveSync()
  })

  onUnmounted(() => {
    cleanupScrollRef.current?.()
    clearFrame()
  })

  watch(
    () => `${direction}|${itemSignature}|${activeOffset}|${bounds}`,
    () => {
      bindContainerListener()
      scheduleActiveSync()
    },
    { immediate: true },
  )

  const activeHref = activeHrefRef.value

  const renderItem = (item: NormalizedAnchorItem) => {
    const active = activeHref === item.href
    const nestedVisible = direction !== 'horizontal' && !!item.children?.length
    const effectiveReplace = item.replace ?? replace
    const effectiveHref = item.disabled ? undefined : item.href

    return (
      <li
        key={item.keyText}
        data-rue-anchor-item={item.keyText}
        className={appendClassName(
          appendClassName(
            'list-none',
            direction === 'horizontal' ? 'shrink-0' : item.level > 0 ? 'pl-0' : undefined,
          ),
          classNames?.item,
        )}
        style={styles?.item}
      >
        <a
          href={effectiveHref}
          target={item.target}
          rel={item.target === '_blank' ? 'noreferrer' : undefined}
          aria-disabled={item.disabled ? 'true' : undefined}
          aria-current={active ? 'location' : undefined}
          data-rue-anchor-href={item.href}
          data-active={active ? 'true' : 'false'}
          className={appendClassName(
            appendClassName(
              appendClassName(
                direction === 'horizontal'
                  ? 'inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition duration-200 ease-out'
                  : 'group flex min-w-0 items-start gap-3 rounded-2xl border px-3 py-2.5 transition duration-200 ease-out',
                active
                  ? 'border-primary/35 bg-primary/8 text-primary shadow-[0_12px_30px_-24px_rgba(59,130,246,0.85)]'
                  : 'border-transparent bg-base-100/65 text-base-content/78 hover:border-base-300 hover:bg-base-100',
              ),
              item.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
            ),
            appendClassName(classNames?.link, item.className),
          )}
          style={styles?.link}
          onClick={(event: MouseEvent) => {
            if (item.disabled) {
              event.preventDefault()
              event.stopPropagation()
              return
            }

            if (onClick) onClick(event, { title: item.title, href: item.href })
            if (event.defaultPrevented) return

            const targetElement = getTargetElement(item.href, resolveContainer())
            if (targetElement) {
              event.preventDefault()
              scrollToHref(item.href)
              updateHashSafely(item.href, effectiveReplace)
              return
            }

            if (effectiveReplace && isExternalHref(item.href)) {
              event.preventDefault()
              window.location.replace(item.href)
            }
          }}
        >
          {showIndicator ? (
            <span
              aria-hidden="true"
              data-rue-anchor-indicator="true"
              className={appendClassName(
                appendClassName(
                  direction === 'horizontal'
                    ? 'h-2 w-2 rounded-full border transition-colors'
                    : 'mt-1 h-2.5 w-2.5 shrink-0 rounded-full border transition-colors',
                  active ? 'border-primary bg-primary' : 'border-base-300 bg-base-100',
                ),
                classNames?.indicator,
              )}
              style={styles?.indicator}
            />
          ) : null}
          <span className="min-w-0 flex-1">
            <span
              data-rue-anchor-title="true"
              className={appendClassName(
                appendClassName(
                  'block truncate text-sm font-medium leading-6',
                  active ? 'text-primary' : 'text-base-content',
                ),
                classNames?.title,
              )}
              style={styles?.title}
            >
              {resolveItemTitle(item)}
            </span>
            {item.description && direction !== 'horizontal' ? (
              <span
                className={appendClassName(
                  'mt-0.5 block text-xs leading-5 text-base-content/58',
                  classNames?.description,
                )}
                style={styles?.description}
              >
                {item.description}
              </span>
            ) : null}
          </span>
        </a>
        {nestedVisible ? (
          <ul className="mt-2 space-y-1.5 border-l border-base-300/70 pl-4">
            {item.children!.map(child => renderItem(child))}
          </ul>
        ) : null}
      </li>
    )
  }

  const mergedRootClassName = appendClassName(
    appendClassName(
      appendClassName(
        appendClassName(
          direction === 'horizontal'
            ? 'rue-anchor overflow-x-auto rounded-[1.5rem] border border-base-300/70 bg-gradient-to-r from-base-100 via-base-100 to-base-200/50 p-3 shadow-[0_20px_45px_-36px_rgba(15,23,42,0.45)]'
            : 'rue-anchor rounded-[1.5rem] border border-base-300/70 bg-gradient-to-b from-base-100 via-base-100 to-base-200/40 p-4 shadow-[0_20px_45px_-36px_rgba(15,23,42,0.45)]',
          affix ? 'z-[1]' : undefined,
        ),
        classNames?.root,
      ),
      rootClassName,
    ),
    className,
  )

  return (
    <nav
      ref={rootRef}
      {...rest}
      aria-label="页内导航"
      className={mergedRootClassName}
      style={{ ...resolveStickyStyle(affix, offsetTop), ...styles?.root, ...style }}
      data-rue-anchor="true"
      data-rue-anchor-direction={direction}
    >
      {shouldRenderChildrenFallback ? (
        <div
          className={appendClassName(
            direction === 'horizontal'
              ? 'flex flex-wrap items-center gap-2'
              : 'flex flex-col items-stretch gap-2',
            classNames?.list,
          )}
          style={styles?.list}
          data-rue-anchor-children="true"
        >
          <Slot source={slotSource} />
        </div>
      ) : (
        <ul
          className={appendClassName(
            direction === 'horizontal' ? 'flex items-center gap-2' : 'space-y-1.5',
            classNames?.list,
          )}
          style={styles?.list}
        >
          {visibleItems.map(item => renderItem(item))}
        </ul>
      )}
    </nav>
  )
}

type AnchorComponent = FC<AnchorProps> & {
  Link: typeof AnchorLink
}

const Anchor = AnchorBase as AnchorComponent

Anchor.Link = AnchorLink

export type { AnchorComponent }
export default Anchor
