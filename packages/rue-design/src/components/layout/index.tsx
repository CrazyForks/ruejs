/* RUE_VAPOR_TRANSFORMED */
/*
Layout 组件概述
- 提供接近 ant-design Layout 的复合容器：Layout / Header / Sider / Content / Footer。
- 保留 Rue 现有的 className + style 组合方式，并补齐 Sider 的 collapsible、breakpoint、trigger、collapsedWidth 等核心能力。
- 默认视觉延续 Rue 的轻量面板体系：柔和边框、圆角、半透明底色与可叠加的 utility class，而不是照搬 antd 的纯蓝壳子。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, ref, watch } from '@rue-js/rue'

export type LayoutBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export type LayoutStyle = string | Record<string, any>
export type LayoutCollapseType = 'clickTrigger' | 'responsive'
export type LayoutSiderTheme = 'light' | 'dark'
export type LayoutSiderTriggerPosition = 'start' | 'end'

export interface LayoutProps {
  as?: any
  hasSider?: boolean
  className?: string
  style?: LayoutStyle
  children?: any
  [key: string]: any
}

export interface LayoutSectionProps {
  as?: any
  className?: string
  style?: LayoutStyle
  children?: any
  [key: string]: any
}

export interface LayoutSiderTriggerRenderMeta {
  collapsed: boolean
  below: boolean
  zeroWidth: boolean
  toggle: () => void
}

export interface LayoutSiderTriggerProps {
  className?: string
  style?: LayoutStyle
  children?: any
  [key: string]: any
}

export interface LayoutSiderProps {
  as?: any
  className?: string
  style?: LayoutStyle
  bodyClassName?: string
  bodyStyle?: LayoutStyle
  footer?: any
  footerClassName?: string
  footerStyle?: LayoutStyle
  triggerClassName?: string
  triggerStyle?: LayoutStyle
  theme?: LayoutSiderTheme
  width?: number | string
  collapsedWidth?: number | string
  collapsed?: boolean
  defaultCollapsed?: boolean
  collapsible?: boolean
  breakpoint?: LayoutBreakpoint
  reverseArrow?: boolean
  trigger?: any | ((meta: LayoutSiderTriggerRenderMeta) => any)
  zeroWidthTriggerStyle?: LayoutStyle
  triggerPosition?: LayoutSiderTriggerPosition
  onCollapse?: (collapsed: boolean, type: LayoutCollapseType) => void
  onBreakpoint?: (broken: boolean) => void
  children?: any
  [key: string]: any
}

export interface LayoutCompound extends FC<LayoutProps> {
  Header: FC<LayoutSectionProps>
  Content: FC<LayoutSectionProps>
  Footer: FC<LayoutSectionProps>
  Sider: FC<LayoutSiderProps>
  Trigger: FC<LayoutSiderTriggerProps>
}

const BREAKPOINT_MAX_WIDTH: Record<LayoutBreakpoint, number> = {
  xs: 479.98,
  sm: 575.98,
  md: 767.98,
  lg: 991.98,
  xl: 1199.98,
  xxl: 1599.98,
}

const joinClassName = (...values: Array<string | undefined | false | null>) => {
  return values.filter(Boolean).join(' ')
}

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const serializeStyle = (style?: LayoutStyle) => {
  if (!style) return ''
  if (typeof style === 'string') return style.trim()

  return Object.entries(style)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key.startsWith('--') ? key : toKebabCase(key)}:${String(value)}`)
    .join('; ')
}

const mergeStyle = (...styles: Array<LayoutStyle | undefined>) => {
  return styles
    .map(style => serializeStyle(style))
    .filter(Boolean)
    .join('; ')
}

const flattenChildren = (children: any, out: any[] = []) => {
  if (children == null || children === false) return out
  if (Array.isArray(children)) {
    children.forEach(child => flattenChildren(child, out))
    return out
  }
  out.push(children)
  return out
}

const hasRenderableContent = (value: any): boolean => {
  if (value == null || value === false) return false
  if (Array.isArray(value)) return value.some((item: any) => hasRenderableContent(item))
  return true
}

const isNumeric = (value: any) => {
  if (value == null || value === '') return false
  return !Number.isNaN(Number.parseFloat(String(value))) && Number.isFinite(Number(value))
}

const resolveSize = (value: number | string | undefined, fallback: number) => {
  const resolved = value ?? fallback
  if (typeof resolved === 'number') return `${resolved}px`
  if (/^\d+(\.\d+)?$/.test(resolved)) return `${resolved}px`
  return resolved
}

const getViewportWidth = () => {
  if (typeof window === 'undefined') return BREAKPOINT_MAX_WIDTH.xl + 1
  return window.innerWidth || document.documentElement?.clientWidth || BREAKPOINT_MAX_WIDTH.xl + 1
}

const resolveThemeClassName = (theme?: LayoutSiderTheme) => {
  if (theme === 'dark') {
    return 'border-base-content/10 bg-neutral text-neutral-content'
  }
  return 'border-base-300 bg-base-100 text-base-content'
}

const resolveSiderBodyClassName = (theme?: LayoutSiderTheme) => {
  if (theme === 'dark') {
    return 'bg-neutral/90 text-neutral-content'
  }
  return 'bg-transparent text-base-content'
}

const resolveChevron = (collapsed: boolean, reverseArrow?: boolean) => {
  if (collapsed) {
    return reverseArrow ? '▶' : '◀'
  }
  return reverseArrow ? '◀' : '▶'
}

const isSiderElement = (child: any) => {
  return !!child && typeof child === 'object' && child.type === Sider
}

const resolveHasSider = (children: any, hasSider?: boolean) => {
  if (typeof hasSider === 'boolean') return hasSider
  return flattenChildren(children).some(child => isSiderElement(child))
}

const BasicSection = (
  suffix: string,
  defaultAs: any,
  extraClassName?: string,
  extraStyle?: LayoutStyle,
): FC<LayoutSectionProps> => {
  const Component: FC<LayoutSectionProps> = ({
    as = defaultAs,
    className,
    style,
    children,
    ...rest
  }) => {
    const Tag = as as any
    return (
      <Tag
        {...rest}
        className={joinClassName(`rue-layout-${suffix}`, extraClassName, className)}
        style={mergeStyle(extraStyle, style)}
      >
        {children}
      </Tag>
    )
  }

  return Component
}

const Header = BasicSection(
  'header',
  'header',
  'flex min-h-16 items-center gap-3 rounded-[1.5rem] border border-base-300/80 bg-base-100/92 px-5 py-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur',
)

const Content = BasicSection(
  'content',
  'main',
  'min-h-0 flex-1 rounded-[1.5rem] border border-base-300/75 bg-base-100/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)] backdrop-blur',
)

const Footer = BasicSection(
  'footer',
  'footer',
  'flex min-h-14 items-center justify-between gap-3 rounded-[1.5rem] border border-base-300/80 bg-base-200/75 px-5 py-4 text-sm text-base-content/75',
)

const Trigger: FC<LayoutSiderTriggerProps> = ({ className, style, children, ...rest }) => {
  return (
    <span
      {...rest}
      className={joinClassName(
        'rue-layout-sider-trigger inline-flex items-center gap-2 rounded-full border border-current/15 px-3 py-2 text-xs font-semibold tracking-wide transition duration-200 ease-out hover:bg-current/8',
        className,
      )}
      style={mergeStyle(style)}
    >
      {children}
    </span>
  )
}

const LayoutRoot: FC<LayoutProps> = ({
  as = 'section',
  hasSider,
  className,
  style,
  children,
  ...rest
}) => {
  const Component = as as any
  const mergedHasSider = resolveHasSider(children, hasSider)

  return (
    <Component
      {...rest}
      className={joinClassName(
        'rue-layout relative flex min-h-0 min-w-0 gap-4',
        mergedHasSider ? 'flex-row items-stretch' : 'flex-col',
        className,
      )}
      style={mergeStyle(
        {
          width: '100%',
          minWidth: 0,
          minHeight: 0,
        },
        style,
      )}
      data-rue-layout="true"
      data-rue-layout-has-sider={mergedHasSider ? 'true' : 'false'}
    >
      {children}
    </Component>
  )
}

const Sider: FC<LayoutSiderProps> = ({
  as = 'aside',
  className,
  style,
  bodyClassName,
  bodyStyle,
  footer,
  footerClassName,
  footerStyle,
  triggerClassName,
  triggerStyle,
  theme = 'light',
  width = 240,
  collapsedWidth = 80,
  collapsed,
  defaultCollapsed = false,
  collapsible = false,
  breakpoint,
  reverseArrow = false,
  trigger,
  zeroWidthTriggerStyle,
  triggerPosition = 'end',
  onCollapse,
  onBreakpoint,
  children,
  ...rest
}) => {
  const Component = as as any
  const isControlled = typeof collapsed === 'boolean'
  const collapsedState = ref(isControlled ? !!collapsed : !!defaultCollapsed)
  const belowState = ref(false)
  const viewportWidth = ref(getViewportWidth())
  const collapsedSize = resolveSize(collapsedWidth, 80)
  const expandedSize = resolveSize(width, 240)
  let rootElement: HTMLElement | null = null
  let bodyElement: HTMLDivElement | null = null
  let footerElement: HTMLDivElement | null = null
  let triggerElement: HTMLButtonElement | null = null

  const isZeroWidthCollapsed = (nextCollapsed: boolean) => {
    return (
      nextCollapsed &&
      (isNumeric(collapsedWidth)
        ? Number(collapsedWidth) === 0
        : collapsedSize === '0px' || collapsedSize === '0')
    )
  }

  const syncManagedDom = (nextCollapsed: boolean, nextBelow: boolean) => {
    const zeroWidth = isZeroWidthCollapsed(nextCollapsed)
    const currentWidth = nextCollapsed ? collapsedSize : expandedSize
    const hideFooter = nextCollapsed && !zeroWidth

    if (rootElement) {
      rootElement.setAttribute('data-collapsed', nextCollapsed ? 'true' : 'false')
      rootElement.setAttribute('data-below', nextBelow ? 'true' : 'false')
      rootElement.setAttribute('data-zero-width', zeroWidth ? 'true' : 'false')
      rootElement.style.flex = `0 0 ${currentWidth}`
      rootElement.style.width = currentWidth
      rootElement.style.minWidth = currentWidth
      rootElement.style.maxWidth = currentWidth
      rootElement.style.opacity = zeroWidth ? '0' : '1'
      rootElement.classList.toggle('pointer-events-none', zeroWidth)
      rootElement.classList.toggle('border-transparent', zeroWidth)
      rootElement.classList.toggle('shadow-none', zeroWidth)
    }

    if (bodyElement) {
      bodyElement.classList.toggle('items-center', nextCollapsed && !zeroWidth)
      bodyElement.classList.toggle('px-2', nextCollapsed && !zeroWidth)
    }

    if (footerElement) {
      footerElement.setAttribute('aria-hidden', hideFooter ? 'true' : 'false')
      footerElement.style.display = hideFooter ? 'none' : ''
      footerElement.classList.toggle('px-2', nextCollapsed && !zeroWidth)
      footerElement.classList.toggle('text-center', nextCollapsed && !zeroWidth)
    }

    if (triggerElement) {
      triggerElement.setAttribute('aria-label', nextCollapsed ? '展开侧边栏' : '收起侧边栏')
      triggerElement.setAttribute('data-rue-layout-sider-trigger', zeroWidth ? 'zero' : 'default')
      triggerElement.classList.toggle('pointer-events-auto', zeroWidth)
      triggerElement.classList.toggle('right-3', !zeroWidth && triggerPosition !== 'start')
      triggerElement.classList.toggle('left-3', !zeroWidth && triggerPosition === 'start')
      triggerElement.classList.toggle('bottom-3', !zeroWidth)
      triggerElement.classList.toggle('right-0', zeroWidth)
      triggerElement.classList.toggle('top-6', zeroWidth)
      triggerElement.classList.toggle('bottom-auto', zeroWidth)
      triggerElement.classList.toggle('translate-x-1/2', zeroWidth)
      triggerElement.classList.toggle('rounded-full', zeroWidth)

      const triggerInlineStyle = mergeStyle(zeroWidth ? zeroWidthTriggerStyle : triggerStyle)
      if (triggerInlineStyle) {
        triggerElement.setAttribute('style', triggerInlineStyle)
      } else {
        triggerElement.removeAttribute('style')
      }

      const arrowElement = triggerElement.querySelector(
        '[data-rue-layout-trigger-arrow="true"]',
      ) as HTMLElement | null
      const labelElement = triggerElement.querySelector(
        '[data-rue-layout-trigger-label="true"]',
      ) as HTMLElement | null

      if (arrowElement) {
        arrowElement.textContent = resolveChevron(nextCollapsed, reverseArrow)
      }

      if (labelElement) {
        labelElement.textContent = nextCollapsed ? '展开' : '收起'
      }
    }
  }

  const handleCollapse = (nextCollapsed: boolean, type: LayoutCollapseType) => {
    if (!isControlled) {
      collapsedState.value = nextCollapsed
    }
    onCollapse?.(nextCollapsed, type)
  }

  const syncResponsiveState = () => {
    viewportWidth.value = getViewportWidth()
    if (!breakpoint) return

    const broken = viewportWidth.value <= BREAKPOINT_MAX_WIDTH[breakpoint]
    if (broken === belowState.value) return

    belowState.value = broken
    onBreakpoint?.(broken)
    handleCollapse(broken, 'responsive')
  }

  const toggle = () => {
    handleCollapse(!collapsedState.value, 'clickTrigger')
  }

  onMounted(() => {
    syncResponsiveState()
    syncManagedDom(collapsedState.value, belowState.value)
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncResponsiveState)
    }
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', syncResponsiveState)
    }
  })

  watch(
    () => collapsed,
    value => {
      if (typeof value === 'boolean') {
        collapsedState.value = value
      }
    },
    { immediate: true },
  )

  watch(
    () => collapsedState.value,
    (nextCollapsed: boolean) => {
      syncManagedDom(nextCollapsed, belowState.value)
    },
    { immediate: true },
  )

  watch(
    () => belowState.value,
    (nextBelow: boolean) => {
      syncManagedDom(collapsedState.value, nextBelow)
    },
    { immediate: true },
  )

  watch(
    () => breakpoint,
    () => {
      syncResponsiveState()
    },
    { immediate: true },
  )
  const meta: LayoutSiderTriggerRenderMeta = {
    collapsed: collapsedState.value,
    below: belowState.value,
    zeroWidth:
      collapsedState.value &&
      (isNumeric(collapsedWidth)
        ? Number(collapsedWidth) === 0
        : collapsedSize === '0px' || collapsedSize === '0'),
    toggle,
  }

  const renderedTrigger =
    trigger === null
      ? null
      : typeof trigger === 'function'
        ? trigger(meta)
        : (trigger ?? (
            <Trigger>
              <span data-rue-layout-trigger-arrow="true">
                {resolveChevron(collapsedState.value, reverseArrow)}
              </span>
              <span data-rue-layout-trigger-label="true">
                {collapsedState.value ? '展开' : '收起'}
              </span>
            </Trigger>
          ))

  return (
    <Component
      {...rest}
      ref={(element: HTMLElement | null) => {
        rootElement = element
        if (element) {
          syncManagedDom(collapsedState.value, belowState.value)
        }
      }}
      className={joinClassName(
        'rue-layout-sider relative flex min-h-0 shrink-0 flex-col overflow-hidden rounded-[1.75rem] border shadow-[0_28px_70px_-42px_rgba(15,23,42,0.5)] transition-[width,flex-basis,max-width,min-width,transform,opacity] duration-300 ease-out',
        resolveThemeClassName(theme),
        collapsedState.value &&
          (isNumeric(collapsedWidth)
            ? Number(collapsedWidth) === 0
            : collapsedSize === '0px' || collapsedSize === '0') &&
          'pointer-events-none border-transparent shadow-none',
        className,
      )}
      style={mergeStyle(
        {
          flex: `0 0 ${collapsedState.value ? collapsedSize : expandedSize}`,
          width: collapsedState.value ? collapsedSize : expandedSize,
          minWidth: collapsedState.value ? collapsedSize : expandedSize,
          maxWidth: collapsedState.value ? collapsedSize : expandedSize,
          opacity:
            collapsedState.value &&
            (isNumeric(collapsedWidth)
              ? Number(collapsedWidth) === 0
              : collapsedSize === '0px' || collapsedSize === '0')
              ? 0
              : 1,
        },
        style,
      )}
      data-rue-layout-sider="true"
      data-collapsed={collapsedState.value ? 'true' : 'false'}
      data-below={belowState.value ? 'true' : 'false'}
      data-zero-width={
        collapsedState.value &&
        (isNumeric(collapsedWidth)
          ? Number(collapsedWidth) === 0
          : collapsedSize === '0px' || collapsedSize === '0')
          ? 'true'
          : 'false'
      }
      data-theme={theme}
    >
      <div
        ref={(element: HTMLDivElement | null) => {
          bodyElement = element
          if (element) {
            syncManagedDom(collapsedState.value, belowState.value)
          }
        }}
        className={joinClassName(
          'rue-layout-sider-body flex min-h-0 flex-1 flex-col gap-4 p-4 transition-[padding] duration-300 ease-out',
          resolveSiderBodyClassName(theme),
          collapsedState.value &&
            !(
              collapsedState.value &&
              (isNumeric(collapsedWidth)
                ? Number(collapsedWidth) === 0
                : collapsedSize === '0px' || collapsedSize === '0')
            ) &&
            'items-center px-2',
          bodyClassName,
        )}
        style={mergeStyle(bodyStyle)}
      >
        {children}
      </div>

      {hasRenderableContent(footer) ? (
        <div
          ref={(element: HTMLDivElement | null) => {
            footerElement = element
            if (element) {
              syncManagedDom(collapsedState.value, belowState.value)
            }
          }}
          className={joinClassName(
            'rue-layout-sider-footer border-t border-current/10 px-4 py-3 text-xs opacity-80',
            collapsedState.value &&
              !(
                collapsedState.value &&
                (isNumeric(collapsedWidth)
                  ? Number(collapsedWidth) === 0
                  : collapsedSize === '0px' || collapsedSize === '0')
              ) &&
              'px-2 text-center',
            footerClassName,
          )}
          style={mergeStyle(footerStyle)}
        >
          {footer}
        </div>
      ) : null}

      {collapsible && renderedTrigger ? (
        <button
          ref={(element: HTMLButtonElement | null) => {
            triggerElement = element
            if (element) {
              syncManagedDom(collapsedState.value, belowState.value)
            }
          }}
          type="button"
          onClick={toggle}
          className={joinClassName(
            'rue-layout-sider-trigger-button absolute z-10 inline-flex items-center',
            triggerPosition === 'start'
              ? 'left-3 bottom-3 justify-start'
              : 'right-3 bottom-3 justify-end',
            collapsedState.value &&
              (isNumeric(collapsedWidth)
                ? Number(collapsedWidth) === 0
                : collapsedSize === '0px' || collapsedSize === '0') &&
              'pointer-events-auto right-0 top-6 bottom-auto translate-x-1/2 rounded-full',
            triggerClassName,
          )}
          style={mergeStyle(
            collapsedState.value &&
              (isNumeric(collapsedWidth)
                ? Number(collapsedWidth) === 0
                : collapsedSize === '0px' || collapsedSize === '0')
              ? zeroWidthTriggerStyle
              : triggerStyle,
          )}
          aria-label={collapsedState.value ? '展开侧边栏' : '收起侧边栏'}
          data-rue-layout-sider-trigger={
            collapsedState.value &&
            (isNumeric(collapsedWidth)
              ? Number(collapsedWidth) === 0
              : collapsedSize === '0px' || collapsedSize === '0')
              ? 'zero'
              : 'default'
          }
        >
          {renderedTrigger}
        </button>
      ) : null}
    </Component>
  )
}

const Layout = Object.assign(LayoutRoot, {
  Header,
  Content,
  Footer,
  Sider,
  Trigger,
}) as LayoutCompound

export default Layout
