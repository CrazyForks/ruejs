/*
Descriptions 组件概述
- 支持描述列表组件的核心心智，兼容 items 与 Descriptions.Item 两套写法。
- 能力覆盖标题区、边框模式、纵向布局、响应式列数、span/fill 与语义化样式扩展。
- 视觉保持 Rue 当前偏柔和的卡片式信息呈现，不直接复刻特定组件库的表格外观。
*/
import type { FC } from '@rue-js/rue'
import {
  Fragment,
  Slot,
  getCurrentInstance,
  onMounted,
  onUnmounted,
  ref,
  render as renderRue,
  useRef,
  watch,
} from '@rue-js/rue'

/** DescriptionsSize 尺寸类型。 */
export type DescriptionsSize = 'small' | 'default' | 'middle' | 'large' | 'sm' | 'md' | 'lg'
/** DescriptionsLayout 类型。 */
export type DescriptionsLayout = 'horizontal' | 'vertical'
/** DescriptionsBreakpoint 类型。 */
export type DescriptionsBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
/** DescriptionsResponsiveValue 值类型。 */
export type DescriptionsResponsiveValue<T> = Partial<Record<DescriptionsBreakpoint, T>>
/** DescriptionsSpan 类型。 */
export type DescriptionsSpan = number | 'filled' | DescriptionsResponsiveValue<number>

/** DescriptionsClassNames 局部类名配置。 */
export interface DescriptionsClassNames {
  /** 根节点区域配置。 */
  root?: string
  /** 头部区域内容。 */
  header?: string
  /** 标题内容。 */
  title?: string
  /** 额外操作或补充内容。 */
  extra?: string
  /** 主体区域配置。 */
  body?: string
  /** row 配置项。 */
  row?: string
  /** item 区域配置。 */
  item?: string
  /** 展示标签。 */
  label?: string
  /** 主体内容。 */
  content?: string
}

/** DescriptionsStyles 局部样式配置。 */
export interface DescriptionsStyles {
  /** 根节点区域配置。 */
  root?: Record<string, any>
  /** 头部区域内容。 */
  header?: Record<string, any>
  /** 标题内容。 */
  title?: Record<string, any>
  /** 额外操作或补充内容。 */
  extra?: Record<string, any>
  /** 主体区域配置。 */
  body?: Record<string, any>
  /** row 配置项。 */
  row?: Record<string, any>
  /** item 区域配置。 */
  item?: Record<string, any>
  /** 展示标签。 */
  label?: Record<string, any>
  /** 主体内容。 */
  content?: Record<string, any>
}

/** DescriptionsItemClassNames 局部类名配置。 */
export interface DescriptionsItemClassNames {
  /** item 区域配置。 */
  item?: string
  /** 展示标签。 */
  label?: string
  /** 主体内容。 */
  content?: string
}

/** DescriptionsItemStyles 局部样式配置。 */
export interface DescriptionsItemStyles {
  /** item 区域配置。 */
  item?: Record<string, any>
  /** 展示标签。 */
  label?: Record<string, any>
  /** 主体内容。 */
  content?: Record<string, any>
}

/** DescriptionsItemProps 组件属性。 */
export interface DescriptionsItemProps {
  /** 数据项唯一标识。 */
  key?: string | number
  /** 展示标签。 */
  label?: any
  /** 组件子内容。 */
  children?: any
  /** 主体内容。 */
  content?: any
  /** span 配置项。 */
  span?: DescriptionsSpan
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: Record<string, any>
  /** labelClassName 附加类名。 */
  labelClassName?: string
  /** labelStyle 内联样式。 */
  labelStyle?: Record<string, any>
  /** contentClassName 附加类名。 */
  contentClassName?: string
  /** contentStyle 内联样式。 */
  contentStyle?: Record<string, any>
  /** 按局部区域覆盖的类名集合。 */
  classNames?: DescriptionsItemClassNames
  /** 按局部区域覆盖的内联样式集合。 */
  styles?: DescriptionsItemStyles
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** DescriptionsProps 组件属性。 */
export interface DescriptionsProps {
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: Record<string, any>
  /** 标题内容。 */
  title?: any
  /** 额外操作或补充内容。 */
  extra?: any
  /** bordered 配置项。 */
  bordered?: boolean
  /** 组件尺寸。 */
  size?: DescriptionsSize
  /** 组件子内容。 */
  children?: any
  /** layout 配置项。 */
  layout?: DescriptionsLayout
  /** colon 配置项。 */
  colon?: boolean
  /** column 配置项。 */
  column?: number | DescriptionsResponsiveValue<number>
  /** labelStyle 内联样式。 */
  labelStyle?: Record<string, any>
  /** contentStyle 内联样式。 */
  contentStyle?: Record<string, any>
  /** 按局部区域覆盖的类名集合。 */
  classNames?: DescriptionsClassNames
  /** 按局部区域覆盖的内联样式集合。 */
  styles?: DescriptionsStyles
  /** 数据驱动渲染项。 */
  items?: DescriptionsItemProps[]
  /** 元素或数据项标识。 */
  id?: string
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

interface NormalizedDescriptionsItem extends Omit<DescriptionsItemProps, 'children' | 'span'> {
  keyText: string
  content: any
  span: number
  filled: boolean
}

type DescriptionsCompound = FC<DescriptionsProps> & {
  Item: FC<DescriptionsItemProps>
}

interface DescriptionsSizeConfig {
  titleClassName: string
  cellPaddingClassName: string
  verticalLabelPaddingClassName: string
  verticalContentPaddingClassName: string
  labelClassName: string
  inlineLabelClassName: string
  contentClassName: string
  inlineLayoutClassName: string
}

/** RUE_COMPONENT_TYPE_KEY 内部常量。 */
const RUE_COMPONENT_TYPE_KEY = '__rue_component_type'
/** RUE_SLOT_KEY 内部常量。 */
const RUE_SLOT_KEY = '__rue_slots'
/** RUE_PROXY_ATTR 内部常量。 */
const RUE_PROXY_ATTR = 'data-rue-descriptions-proxy'
/** RUE_PROXY_LABEL_ATTR 内部常量。 */
const RUE_PROXY_LABEL_ATTR = 'data-rue-descriptions-proxy-label'
/** RUE_PROXY_CONTENT_ATTR 内部常量。 */
const RUE_PROXY_CONTENT_ATTR = 'data-rue-descriptions-proxy-content'
/** BREAKPOINT_SEQUENCE 内部常量。 */
const BREAKPOINT_SEQUENCE: DescriptionsBreakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl']
/** BREAKPOINT_MIN_WIDTH 内部常量。 */
const BREAKPOINT_MIN_WIDTH: Record<DescriptionsBreakpoint, number> = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
}
const viewportSubscribers = new Set<() => void>()
const descriptionsProxyMetaMap = new WeakMap<HTMLElement, DescriptionsItemProps>()

/** Descriptions Item 的内部工具函数。 */
const DescriptionsItem: FC<DescriptionsItemProps> = ({
  key,
  label,
  children,
  content,
  span,
  className,
  style,
  labelClassName,
  labelStyle,
  contentClassName,
  contentStyle,
  classNames,
  styles,
}) => {
  const slotSource = ((getCurrentInstance() as { propsRO?: Record<string, unknown> } | null)
    ?.propsRO ?? {
    children,
  }) as Record<string, unknown>
  const resolvedContent =
    content !== undefined ? content : resolveDefaultSlotChildren(slotSource, children)

  const applyProxyRef = (element: HTMLElement | null) => {
    if (!element) return

    descriptionsProxyMetaMap.set(element, {
      key,
      label,
      content: resolvedContent,
      span,
      className,
      style,
      labelClassName,
      labelStyle,
      contentClassName,
      contentStyle,
      classNames,
      styles,
    })
  }

  return (
    <div
      ref={applyProxyRef}
      className="hidden"
      aria-hidden="true"
      data-rue-descriptions-proxy="true"
    >
      <div data-rue-descriptions-proxy-label="true">{label}</div>
      <div data-rue-descriptions-proxy-content="true">
        {content !== undefined ? content : <Slot source={slotSource} />}
      </div>
    </div>
  )
}

/** join Class Name 的内部工具函数。 */
const joinClassName = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

/** merge Styles 的内部工具函数。 */
const mergeStyles = (...parts: Array<Record<string, any> | undefined>) => {
  const next = Object.assign({}, ...parts.filter(part => part && typeof part === 'object'))
  return Object.keys(next).length ? next : undefined
}

/** 判断 Renderable Node 的内部工具函数。 */
const isRenderableNode = (value: unknown): value is Record<string, any> => {
  return !!value && typeof value === 'object'
}

/** 归一化 Children 的内部工具函数。 */
const normalizeChildren = (children: any, result: any[] = []) => {
  if (children == null || typeof children === 'boolean') return result
  if (typeof children === 'function' && (children as { kind?: unknown }).kind === 'block-factory') {
    normalizeChildren(children(), result)
    return result
  }
  if (Array.isArray(children)) {
    children.forEach(child => normalizeChildren(child, result))
    return result
  }
  if (isRenderableNode(children) && children.type === 'fragment') {
    normalizeChildren(children.props?.children, result)
    return result
  }
  result.push(children)
  return result
}

/** 判断 Responsive Map 的内部工具函数。 */
const isResponsiveMap = <T,>(value: unknown): value is DescriptionsResponsiveValue<T> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.keys(value).some(key => BREAKPOINT_SEQUENCE.includes(key as DescriptionsBreakpoint))
}

/** clamp Positive Integer 的内部工具函数。 */
const clampPositiveInteger = (value: unknown, fallback: number) => {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  const normalized = Math.max(1, Math.floor(next))
  return normalized || fallback
}

/** 读取 Viewport Width 的内部工具函数。 */
const getViewportWidth = () => {
  if (typeof window === 'undefined') return BREAKPOINT_MIN_WIDTH.xl
  return window.innerWidth || document.documentElement?.clientWidth || BREAKPOINT_MIN_WIDTH.xl
}

/** notify Viewport Subscribers 的内部工具函数。 */
const notifyViewportSubscribers = () => {
  viewportSubscribers.forEach(notify => notify())
}

/** subscribe Viewport 的内部工具函数。 */
const subscribeViewport = (notify: () => void) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  if (viewportSubscribers.size === 0) {
    window.addEventListener('resize', notifyViewportSubscribers)
  }

  viewportSubscribers.add(notify)

  return () => {
    viewportSubscribers.delete(notify)
    if (viewportSubscribers.size === 0) {
      window.removeEventListener('resize', notifyViewportSubscribers)
    }
  }
}

/** 解析 Responsive Value 的内部工具函数。 */
const resolveResponsiveValue = <T,>(
  value: T | DescriptionsResponsiveValue<T> | undefined,
  width: number,
) => {
  if (!isResponsiveMap<T>(value)) {
    return value as T | undefined
  }

  let resolved: T | undefined
  for (const breakpoint of BREAKPOINT_SEQUENCE) {
    if (width >= BREAKPOINT_MIN_WIDTH[breakpoint] && value[breakpoint] !== undefined) {
      resolved = value[breakpoint]
    }
  }
  return resolved
}

/** 解析 Column Count 的内部工具函数。 */
const resolveColumnCount = (
  column: number | DescriptionsResponsiveValue<number> | undefined,
  width: number,
) => {
  const resolved = resolveResponsiveValue(column, width)
  return clampPositiveInteger(resolved ?? 3, 3)
}

/** 创建 Key Text 的内部工具函数。 */
const createKeyText = (key: string | number | undefined, index: number) => {
  if (key == null) return `index:${index}`
  return `${typeof key}:${String(key)}`
}

/** 解析 Item Span 的内部工具函数。 */
const resolveItemSpan = (span: DescriptionsSpan | undefined, width: number) => {
  if (span === 'filled') {
    return {
      span: 1,
      filled: true,
    }
  }

  const resolved = resolveResponsiveValue<number>(
    span as number | DescriptionsResponsiveValue<number>,
    width,
  )
  return {
    span: clampPositiveInteger(resolved ?? span ?? 1, 1),
    filled: false,
  }
}

/** 解析 Default Slot Children 的内部工具函数。 */
const resolveDefaultSlotChildren = (source: Record<string, unknown>, fallback: any) => {
  const slots = source[RUE_SLOT_KEY]
  if (slots && typeof slots === 'object' && 'default' in (slots as Record<string, unknown>)) {
    return (slots as Record<string, unknown>).default
  }
  if ('children' in source) {
    return source.children
  }
  return fallback
}

/** collect Child Items 的内部工具函数。 */
const collectChildItems = (children?: any) => {
  return normalizeChildren(children).flatMap<DescriptionsItemProps>((child, index) => {
    if (!isRenderableNode(child)) return []
    const type = (child as any).type
    if (
      (child as any)[RUE_COMPONENT_TYPE_KEY] !== DescriptionsItem &&
      type !== DescriptionsItem &&
      (type as any)?.[RUE_COMPONENT_TYPE_KEY] !== DescriptionsItem
    ) {
      return []
    }
    const props = ((child as any).props ?? {}) as DescriptionsItemProps
    return [
      {
        ...props,
        key: (child as any).key ?? props.key ?? index,
      },
    ]
  })
}

/** 归一化 Items 的内部工具函数。 */
const normalizeItems = (
  items: DescriptionsItemProps[] | undefined,
  children: any,
  width: number,
) => {
  const source = items ?? collectChildItems(children)
  return source.map<NormalizedDescriptionsItem>((item, index) => {
    const span = resolveItemSpan(item.span, width)
    return {
      ...item,
      keyText: createKeyText(item.key, index),
      content: item.content !== undefined ? item.content : item.children,
      span: span.span,
      filled: span.filled,
    }
  })
}

/** group Rows 的内部工具函数。 */
const groupRows = (items: NormalizedDescriptionsItem[], columnCount: number) => {
  let rows: NormalizedDescriptionsItem[][] = []
  let currentRow: NormalizedDescriptionsItem[] = []
  let count = 0

  items.forEach(item => {
    if (item.filled) {
      currentRow.push({
        ...item,
        span: 1,
      })
      rows.push(currentRow)
      currentRow = []
      count = 0
      return
    }

    const normalizedSpan = Math.min(columnCount, Math.max(1, item.span))
    const restSpan = Math.max(1, columnCount - count)
    count += normalizedSpan

    if (count >= columnCount) {
      currentRow.push({
        ...item,
        span: count > columnCount ? restSpan : normalizedSpan,
      })
      rows.push(currentRow)
      currentRow = []
      count = 0
      return
    }

    currentRow.push({
      ...item,
      span: normalizedSpan,
    })
  })

  if (currentRow.length > 0) {
    rows.push(currentRow)
  }

  rows = rows.map(row => {
    const normalizedRow = row.map(item => ({ ...item }))
    const rowSpan = normalizedRow.reduce((total, item) => total + item.span, 0)
    if (rowSpan >= columnCount || normalizedRow.length === 0) return normalizedRow

    const lastItem = normalizedRow[normalizedRow.length - 1]
    lastItem.span += columnCount - rowSpan
    return normalizedRow
  })

  return rows
}

/** 解析 Size Config 的内部工具函数。 */
const resolveSizeConfig = (size?: DescriptionsSize): DescriptionsSizeConfig => {
  switch (size) {
    case 'small':
    case 'sm':
      return {
        titleClassName: 'text-base',
        cellPaddingClassName: 'px-4 py-3',
        verticalLabelPaddingClassName: 'px-4 pt-3 pb-1.5',
        verticalContentPaddingClassName: 'px-4 pb-3 pt-0',
        labelClassName: 'text-[0.68rem] font-semibold tracking-[0.02em] text-base-content/50',
        inlineLabelClassName: 'sm:max-w-28',
        contentClassName: 'text-sm leading-6 text-base-content/85',
        inlineLayoutClassName: 'gap-2.5 sm:gap-3',
      }
    case 'large':
    case 'lg':
      return {
        titleClassName: 'text-xl',
        cellPaddingClassName: 'px-6 py-5',
        verticalLabelPaddingClassName: 'px-6 pt-5 pb-2',
        verticalContentPaddingClassName: 'px-6 pb-5 pt-0',
        labelClassName: 'text-[0.72rem] font-semibold tracking-[0.02em] text-base-content/48',
        inlineLabelClassName: 'sm:max-w-40',
        contentClassName: 'text-[0.97rem] leading-7 text-base-content/88',
        inlineLayoutClassName: 'gap-3 sm:gap-4',
      }
    default:
      return {
        titleClassName: 'text-lg',
        cellPaddingClassName: 'px-5 py-4',
        verticalLabelPaddingClassName: 'px-5 pt-4 pb-2',
        verticalContentPaddingClassName: 'px-5 pb-4 pt-0',
        labelClassName: 'text-[0.7rem] font-semibold tracking-[0.02em] text-base-content/48',
        inlineLabelClassName: 'sm:max-w-32',
        contentClassName: 'text-sm leading-6 text-base-content/86',
        inlineLayoutClassName: 'gap-3',
      }
  }
}

/** 渲染 Label Content 的内部工具函数。 */
const renderLabelContent = (
  item: NormalizedDescriptionsItem,
  showColon: boolean,
  sizeConfig: DescriptionsSizeConfig,
  rootClassNames?: DescriptionsClassNames,
  rootStyles?: DescriptionsStyles,
  labelStyle?: Record<string, any>,
  contentStyle?: Record<string, any>,
) => {
  const labelNode =
    item.label != null ? (
      <div
        data-rue-descriptions-node="label"
        className={joinClassName(
          sizeConfig.labelClassName,
          sizeConfig.inlineLabelClassName,
          rootClassNames?.label,
          item.classNames?.label,
          item.labelClassName,
        )}
        style={mergeStyles(rootStyles?.label, labelStyle, item.styles?.label, item.labelStyle)}
      >
        {item.label}
        {showColon ? <span className="ml-1.5 opacity-45">:</span> : null}
      </div>
    ) : null

  const contentNode = (
    <div
      data-rue-descriptions-node="content"
      className={joinClassName(
        'min-w-0 flex-1',
        sizeConfig.contentClassName,
        rootClassNames?.content,
        item.classNames?.content,
        item.contentClassName,
      )}
      style={mergeStyles(
        rootStyles?.content,
        contentStyle,
        item.styles?.content,
        item.contentStyle,
      )}
    >
      {item.content}
    </div>
  )

  return {
    labelNode,
    contentNode,
  }
}

/** clone Element Children 的内部工具函数。 */
const cloneElementChildren = (element?: Element | null) => {
  if (!element) return undefined

  const nodes = Array.from(element.childNodes)
    .map(node => node.cloneNode(true))
    .filter(node => {
      if (node.nodeType !== 8) return true
      return (node as Comment).data !== 'rue:slot:anchor'
    })

  if (nodes.length === 0) return undefined
  if (nodes.length === 1) return nodes[0]
  return nodes
}

/** Descriptions 的内部工具函数。 */
const Descriptions: FC<DescriptionsProps> = ({
  title,
  extra,
  column,
  colon = true,
  bordered = false,
  layout = 'horizontal',
  className,
  style,
  size,
  labelStyle,
  contentStyle,
  classNames,
  styles,
  items,
  children,
  ...rest
}) => {
  const slotSource = ((getCurrentInstance() as { propsRO?: Record<string, unknown> } | null)
    ?.propsRO ?? {
    children,
  }) as Record<string, unknown>
  const viewportWidth = ref(getViewportWidth())
  const unsubscribeRef = ref<(() => void) | null>(null)
  const collectedItemsRef = ref<DescriptionsItemProps[]>([])
  const collectorRef = useRef<HTMLElement | null>(null)
  const collectorObserverRef = useRef<MutationObserver | undefined>(undefined)
  const tableHostRef = useRef<HTMLElement | null>(null)
  const rawChildren = resolveDefaultSlotChildren(slotSource, children)
  const headerSizeConfig = resolveSizeConfig(size)

  const scheduleCollectedItemsSync = () => {
    Promise.resolve().then(() => {
      syncCollectedItems()
    })
  }

  const syncCollectedItems = () => {
    const host = collectorRef.current
    if (!host) {
      collectedItemsRef.value = []
      return
    }

    const nextItems = Array.from(host.querySelectorAll(`[${RUE_PROXY_ATTR}="true"]`)).map(
      (element, index) => {
        const proxy = element as HTMLElement
        const meta = descriptionsProxyMetaMap.get(proxy) ?? {}
        const labelElement = proxy.querySelector(`[${RUE_PROXY_LABEL_ATTR}="true"]`)
        const contentElement = proxy.querySelector(`[${RUE_PROXY_CONTENT_ATTR}="true"]`)

        return {
          ...meta,
          key: meta.key ?? index,
          label: meta.label ?? cloneElementChildren(labelElement),
          content: meta.content ?? cloneElementChildren(contentElement),
        } satisfies DescriptionsItemProps
      },
    )

    collectedItemsRef.value = nextItems
    if (items === undefined) {
      syncTableView()
    }
  }

  const renderTableView = () => {
    const mergedColumn = resolveColumnCount(column, viewportWidth.value)
    const mergedItems = normalizeItems(
      items ?? collectedItemsRef.value,
      rawChildren,
      viewportWidth.value,
    )
    const rows = groupRows(mergedItems, mergedColumn)
    const vertical = layout === 'vertical'
    const sizeConfig = resolveSizeConfig(size)
    const tableKey = `${vertical ? 'vertical' : 'horizontal'}:${bordered ? 'bordered' : 'plain'}:${mergedColumn}:${rows.length}`

    return (
      <table key={tableKey} className="w-full table-fixed border-separate border-spacing-0">
        <tbody>
          {rows.map((row, rowIndex) => {
            const isLastRow = rowIndex === rows.length - 1
            const rowClassName = joinClassName('align-top', classNames?.row)

            if (vertical) {
              return (
                <Fragment key={`group-${rowIndex}`}>
                  <tr
                    data-rue-descriptions-row={String(rowIndex)}
                    data-rue-descriptions-row-type="vertical-label"
                    className={rowClassName}
                    style={styles?.row}
                  >
                    {row.map((item, itemIndex) => {
                      const isLastItem = itemIndex === row.length - 1
                      const rendered = renderLabelContent(
                        item,
                        false,
                        sizeConfig,
                        classNames,
                        styles,
                        labelStyle,
                        contentStyle,
                      )

                      return (
                        <th
                          key={`label-${item.keyText}`}
                          colSpan={item.span}
                          data-rue-descriptions-item={item.keyText}
                          data-rue-descriptions-part="label"
                          className={joinClassName(
                            'text-left align-top',
                            bordered ? 'bg-base-200/52' : 'bg-transparent',
                            sizeConfig.verticalLabelPaddingClassName,
                            bordered && !isLastItem && 'border-r border-base-300/65',
                            bordered && 'border-b border-base-300/55',
                            classNames?.item,
                            item.classNames?.item,
                            item.className,
                          )}
                          style={mergeStyles(styles?.item, item.styles?.item, item.style)}
                        >
                          {rendered.labelNode}
                        </th>
                      )
                    })}
                  </tr>
                  <tr
                    data-rue-descriptions-row={String(rowIndex)}
                    data-rue-descriptions-row-type="vertical-content"
                    className={rowClassName}
                    style={styles?.row}
                  >
                    {row.map((item, itemIndex) => {
                      const isLastItem = itemIndex === row.length - 1
                      const rendered = renderLabelContent(
                        item,
                        false,
                        sizeConfig,
                        classNames,
                        styles,
                        labelStyle,
                        contentStyle,
                      )

                      return (
                        <td
                          key={`content-${item.keyText}`}
                          colSpan={item.span}
                          data-rue-descriptions-item={item.keyText}
                          data-rue-descriptions-part="content"
                          className={joinClassName(
                            'align-middle',
                            sizeConfig.verticalContentPaddingClassName,
                            !isLastRow && 'border-b border-base-300/45',
                            !bordered && row.length > 0 && 'border-b border-base-300/42',
                            bordered && !isLastItem && 'border-r border-base-300/65',
                            classNames?.item,
                            item.classNames?.item,
                            item.className,
                          )}
                          style={mergeStyles(styles?.item, item.styles?.item, item.style)}
                        >
                          {rendered.contentNode}
                        </td>
                      )
                    })}
                  </tr>
                </Fragment>
              )
            }

            return (
              <tr
                key={`group-${rowIndex}`}
                data-rue-descriptions-row={String(rowIndex)}
                data-rue-descriptions-row-type="horizontal"
                className={rowClassName}
                style={styles?.row}
              >
                {row.map((item, itemIndex) => {
                  const isLastItem = itemIndex === row.length - 1
                  const rendered = renderLabelContent(
                    item,
                    colon,
                    sizeConfig,
                    classNames,
                    styles,
                    labelStyle,
                    contentStyle,
                  )

                  if (!bordered) {
                    return (
                      <Fragment key={`item-${item.keyText}`}>
                        <td
                          colSpan={item.span}
                          data-rue-descriptions-item={item.keyText}
                          data-rue-descriptions-part="item"
                          className={joinClassName(
                            'align-top',
                            sizeConfig.cellPaddingClassName,
                            !isLastRow && 'border-b border-base-300/42',
                            classNames?.item,
                            item.classNames?.item,
                            item.className,
                          )}
                          style={mergeStyles(styles?.item, item.styles?.item, item.style)}
                        >
                          <div
                            className={joinClassName(
                              'flex min-w-0 flex-col sm:flex-row sm:items-start',
                              sizeConfig.inlineLayoutClassName,
                            )}
                          >
                            {rendered.labelNode}
                            {rendered.contentNode}
                          </div>
                        </td>
                      </Fragment>
                    )
                  }

                  return (
                    <Fragment key={`item-${item.keyText}`}>
                      <th
                        colSpan={1}
                        data-rue-descriptions-item={item.keyText}
                        data-rue-descriptions-part="label"
                        className={joinClassName(
                          'bg-base-200/52 text-left align-top',
                          sizeConfig.cellPaddingClassName,
                          'border-r border-base-300/65',
                          !isLastRow && 'border-b border-base-300/55',
                          classNames?.item,
                          item.classNames?.item,
                          item.className,
                        )}
                        style={mergeStyles(styles?.item, item.styles?.item, item.style)}
                      >
                        {rendered.labelNode}
                      </th>
                      <td
                        colSpan={Math.max(1, item.span * 2 - 1)}
                        data-rue-descriptions-item={item.keyText}
                        data-rue-descriptions-part="content"
                        className={joinClassName(
                          'align-top',
                          sizeConfig.cellPaddingClassName,
                          !isLastRow && 'border-b border-base-300/55',
                          !isLastItem && 'border-r border-base-300/65',
                          classNames?.item,
                          item.classNames?.item,
                          item.className,
                        )}
                        style={mergeStyles(styles?.item, item.styles?.item, item.style)}
                      >
                        {rendered.contentNode}
                      </td>
                    </Fragment>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  const syncTableView = () => {
    if (!tableHostRef.current) return
    renderRue(null, tableHostRef.current)
    renderRue(renderTableView(), tableHostRef.current)
  }

  const applyTableHostRef = (element: HTMLElement | null) => {
    tableHostRef.current = element
    if (element) {
      syncTableView()
    }
  }

  onMounted(() => {
    unsubscribeRef.value = subscribeViewport(() => {
      viewportWidth.value = getViewportWidth()
      syncTableView()
    })

    if (items === undefined && typeof MutationObserver === 'function' && collectorRef.current) {
      collectorObserverRef.current = new MutationObserver(() => {
        scheduleCollectedItemsSync()
      })
      collectorObserverRef.current.observe(collectorRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }

    if (items === undefined) {
      scheduleCollectedItemsSync()
    }

    syncTableView()
  })

  onUnmounted(() => {
    unsubscribeRef.value?.()
    unsubscribeRef.value = null
    collectorObserverRef.current?.disconnect()
    collectorObserverRef.current = undefined
    if (tableHostRef.current) {
      renderRue(null, tableHostRef.current)
      tableHostRef.current = null
    }
  })

  watch(
    () => items === undefined,
    enabled => {
      if (!enabled) {
        collectedItemsRef.value = []
        syncTableView()
      } else {
        scheduleCollectedItemsSync()
      }
    },
    { immediate: true },
  )

  return (
    <div
      {...rest}
      data-rue-descriptions="true"
      className={joinClassName('rue-descriptions text-base-content', classNames?.root, className)}
      style={mergeStyles(styles?.root, style)}
    >
      {title != null || extra != null ? (
        <div
          className={joinClassName(
            'mb-4 flex flex-wrap items-start justify-between gap-3',
            classNames?.header,
          )}
          style={styles?.header}
        >
          {title != null ? (
            <div
              className={joinClassName(
                'font-semibold tracking-[0.01em] text-base-content',
                headerSizeConfig.titleClassName,
                classNames?.title,
              )}
              style={styles?.title}
            >
              {title}
            </div>
          ) : (
            <div />
          )}
          {extra != null ? (
            <div
              className={joinClassName('shrink-0 text-sm text-base-content/70', classNames?.extra)}
              style={styles?.extra}
            >
              {extra}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={joinClassName(
          'rue-descriptions-body overflow-x-auto',
          bordered
            ? 'border border-base-300/75 bg-base-100 shadow-[0_20px_60px_-46px_rgba(15,23,42,0.35)]'
            : 'bg-transparent',
          classNames?.body,
        )}
        style={styles?.body}
      >
        <div ref={applyTableHostRef} />
      </div>

      {items === undefined ? (
        <div ref={collectorRef} className="hidden" aria-hidden="true">
          <Slot source={slotSource} />
        </div>
      ) : null}
    </div>
  )
}

;(DescriptionsItem as any)[RUE_COMPONENT_TYPE_KEY] = DescriptionsItem

const DescriptionsCompound: DescriptionsCompound = Object.assign(Descriptions, {
  Item: DescriptionsItem,
})

/** 默认导出描述列表组件。 */
export default DescriptionsCompound
