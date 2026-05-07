/*
List 组件概述
- 保留 Rue/daisyUI 的 list 视觉与 Row/ColGrow/ColWrap 组合 API。
- 增强 Ant Design 风格的数据 API：dataSource/renderItem、header/footer、loading、pagination、grid、empty。
- Item 支持 actions、extra、Meta，便于组织更完整的信息列表。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, render as renderRue, useRef, watch } from '@rue-js/rue'

export type ListSize = 'small' | 'default' | 'large' | 'sm' | 'md' | 'lg'
export type ListItemLayout = 'horizontal' | 'vertical'
export type ListPaginationPosition = 'top' | 'bottom' | 'both'
export type ListPaginationAlign = 'start' | 'center' | 'end'
export type ListKey = string | number

export interface ListGridType {
  gutter?: number | string
  column?: number
  xs?: number
  sm?: number
  md?: number
  lg?: number
  xl?: number
  xxl?: number
  xxxl?: number
}

export interface ListPaginationConfig {
  current?: number
  defaultCurrent?: number
  pageSize?: number
  defaultPageSize?: number
  total?: number
  position?: ListPaginationPosition
  align?: ListPaginationAlign
  hideOnSinglePage?: boolean
  showTotal?: (total: number, range: [number, number]) => any
  onChange?: (page: number, pageSize: number) => void
}

export interface ListLoadingConfig {
  spinning?: boolean
  tip?: any
  indicator?: any
}

export interface ListLocale {
  emptyText?: any
}

export interface ListColDataItem {
  type: 'grow' | 'wrap'
  as?: 'div' | 'p' | 'span'
  className?: string
  content?: any
}

export interface ListDataItem {
  key?: ListKey
  type?: 'row' | 'item'
  normal?: boolean
  className?: string
  content?: any
  cols?: ReadonlyArray<ListColDataItem>
  title?: any
  description?: any
  avatar?: any
  actions?: any[]
  extra?: any
}

export interface ListProps<T = any> {
  bordered?: boolean
  className?: string
  children?: any
  dataSource?: ReadonlyArray<T>
  emptyText?: any
  footer?: any
  grid?: ListGridType
  header?: any
  itemLayout?: ListItemLayout
  items?: ReadonlyArray<ListDataItem>
  loading?: boolean | ListLoadingConfig
  loadMore?: any
  locale?: ListLocale
  pagination?: boolean | ListPaginationConfig | false
  renderItem?: (item: T, index: number) => any
  rowKey?: keyof T | ((item: T, index: number) => ListKey)
  size?: ListSize
  split?: boolean
  style?: Record<string, any>
  [key: string]: any
}

export interface ListRowProps {
  normal?: boolean
  className?: string
  children?: any
  [key: string]: any
}

export interface ListColProps {
  as?: 'div' | 'p' | 'span'
  className?: string
  children?: any
  [key: string]: any
}

export interface ListItemMetaProps {
  avatar?: any
  className?: string
  description?: any
  title?: any
  children?: any
  [key: string]: any
}

export interface ListItemProps {
  actions?: any[]
  className?: string
  classNames?: {
    actions?: string
    extra?: string
    meta?: string
  }
  extra?: any
  itemLayout?: ListItemLayout
  styles?: {
    actions?: Record<string, any>
    extra?: Record<string, any>
    meta?: Record<string, any>
  }
  children?: any
  [key: string]: any
}

interface NormalizedLoadingConfig {
  spinning: boolean
  tip?: any
  indicator?: any
}

interface NormalizedPaginationConfig extends ListPaginationConfig {
  current: number
  pageSize: number
  total: number
  position: ListPaginationPosition
  align: ListPaginationAlign
}

const mergeClassNames = (...parts: Array<string | false | null | undefined>) => {
  const cls = parts.filter(Boolean).join(' ').trim()
  return cls || undefined
}

const asCssSize = (value?: number | string) => {
  if (typeof value === 'number') return `${value}px`
  return value
}

const clampPage = (page: number, pageCount: number) => {
  if (page <= 1) return 1
  if (page >= pageCount) return pageCount
  return page
}

const isLegacyListDataItem = (item: any): item is ListDataItem => {
  return !!(
    item &&
    typeof item === 'object' &&
    (item.type === 'item' ||
      item.type === 'row' ||
      item.cols ||
      item.content !== undefined ||
      item.normal !== undefined ||
      item.title !== undefined ||
      item.description !== undefined ||
      item.avatar !== undefined ||
      item.actions !== undefined ||
      item.extra !== undefined)
  )
}

const resolveRenderableItemContent = (item: any) => {
  if (item == null || typeof item === 'boolean') {
    return item
  }

  if (Array.isArray(item)) {
    return item
  }

  if (typeof item !== 'object') {
    return item
  }

  const candidateFields = ['content', 'children', 'title', 'label', 'text', 'name', 'description']

  for (const field of candidateFields) {
    const value = item[field]
    if (value !== undefined && value !== null) {
      return value
    }
  }

  try {
    return JSON.stringify(item)
  } catch {
    return String(item)
  }
}

const isEmptyNode = (value: any) => {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0)
}

const resolveSizeClass = (size?: ListSize) => {
  switch (size) {
    case 'small':
    case 'sm':
      return 'text-sm'
    case 'large':
    case 'lg':
      return 'text-lg'
    default:
      return undefined
  }
}

const normalizeLoading = (loading?: boolean | ListLoadingConfig): NormalizedLoadingConfig => {
  if (typeof loading === 'object') {
    return {
      spinning: loading.spinning !== false,
      tip: loading.tip,
      indicator: loading.indicator,
    }
  }
  return {
    spinning: !!loading,
  }
}

const getRecordKey = <T,>(
  item: T,
  index: number,
  rowKey?: keyof T | ((item: T, index: number) => ListKey),
) => {
  if (typeof rowKey === 'function') return rowKey(item, index)
  if (rowKey && item && typeof item === 'object') return (item as any)[rowKey]
  if (item && typeof item === 'object' && (item as any).key != null) return (item as any).key
  return `list-item-${index}`
}

const getGridColumnCount = (grid?: ListGridType) => {
  if (!grid) return undefined
  return grid.xxxl ?? grid.xxl ?? grid.xl ?? grid.lg ?? grid.md ?? grid.sm ?? grid.xs ?? grid.column
}

const getGridStyle = (grid?: ListGridType, style?: Record<string, any>) => {
  if (!grid) return style
  const columnCount = getGridColumnCount(grid)
  return {
    ...style,
    display: 'grid',
    gridTemplateColumns: columnCount ? `repeat(${columnCount}, minmax(0, 1fr))` : undefined,
    gap: asCssSize(grid.gutter),
  }
}

const resolvePagination = (
  pagination: boolean | ListPaginationConfig | false | undefined,
  total: number,
  currentValue: number,
  pageSizeValue: number,
): NormalizedPaginationConfig | null => {
  if (!pagination) return null
  const config = typeof pagination === 'object' ? pagination : {}
  const pageSize = Math.max(1, config.pageSize ?? pageSizeValue ?? config.defaultPageSize ?? 10)
  const pageCount = Math.max(1, Math.ceil((config.total ?? total) / pageSize))
  const current = clampPage(config.current ?? currentValue ?? config.defaultCurrent ?? 1, pageCount)

  return {
    ...config,
    current,
    pageSize,
    total: config.total ?? total,
    position: config.position ?? 'bottom',
    align: config.align ?? 'end',
  }
}

const renderCols = (cols?: ReadonlyArray<ListColDataItem>) => {
  if (!cols) return null
  return cols.map((col, index) => {
    if (col.type === 'grow') {
      return (
        <ColGrow as={col.as} className={col.className} key={index}>
          {col.content}
        </ColGrow>
      )
    }
    return (
      <ColWrap as={col.as} className={col.className} key={index}>
        {col.content}
      </ColWrap>
    )
  })
}

const renderLegacyItem = (item: ListDataItem, index: number) => {
  const key = item.key ?? index
  const type =
    item.type ??
    (item.cols || item.title !== undefined || item.description !== undefined || item.avatar !== undefined || item.actions !== undefined || item.extra !== undefined
      ? 'row'
      : 'item')
  if (type === 'item') {
    return (
      <Item className={item.className} key={key}>
        {item.content}
      </Item>
    )
  }

  if (item.title || item.description || item.avatar || item.actions || item.extra) {
    return (
      <Item actions={item.actions} className={item.className} extra={item.extra} key={key}>
        <Meta avatar={item.avatar} title={item.title} description={item.description}>
          {item.content}
        </Meta>
        {renderCols(item.cols)}
      </Item>
    )
  }

  return (
    <Row normal={item.normal} className={item.className} key={key}>
      {item.content}
      {renderCols(item.cols)}
    </Row>
  )
}

const renderLoading = (loading: NormalizedLoadingConfig) => {
  if (!loading.spinning) return null
  return (
    <li className="flex min-h-24 items-center justify-center gap-3 p-6 text-sm opacity-70">
      {loading.indicator ?? <span className="loading loading-spinner loading-sm" />}
      {loading.tip ? <span>{loading.tip}</span> : null}
    </li>
  )
}

const renderEmpty = (emptyText: any) => {
  return <li className="p-8 text-center text-sm opacity-60">{emptyText ?? 'No data'}</li>
}

const renderSection = (content: any, className: string) => {
  if (isEmptyNode(content)) return null
  return <li className={className}>{content}</li>
}

const renderPager = (
  config: NormalizedPaginationConfig | null,
  onChange: (page: number) => void,
  as: 'li' | 'div' = 'li',
) => {
  if (!config) return null
  const Component = as as any
  const pageCount = Math.max(1, Math.ceil(config.total / config.pageSize))
  if (config.hideOnSinglePage && pageCount <= 1) return null
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)
  const start = config.total === 0 ? 0 : (config.current - 1) * config.pageSize + 1
  const end = Math.min(config.current * config.pageSize, config.total)
  const alignClass =
    config.align === 'start'
      ? 'justify-start'
      : config.align === 'center'
        ? 'justify-center'
        : 'justify-end'

  return (
    <Component className={mergeClassNames('flex flex-wrap items-center gap-3 p-3', alignClass)}>
      {config.showTotal ? (
        <span className="mr-auto text-xs opacity-60">
          {config.showTotal(config.total, [start, end])}
        </span>
      ) : null}
      <div className="join">
        <button
          className={mergeClassNames('join-item btn btn-sm', config.current <= 1 && 'btn-disabled')}
          disabled={config.current <= 1}
          onClick={() => onChange(config.current - 1)}
          type="button"
        >
          Prev
        </button>
        {pages.map(page => (
          <button
            className={mergeClassNames(
              'join-item btn btn-sm',
              page === config.current && 'btn-active',
            )}
            key={page}
            onClick={() => onChange(page)}
            type="button"
          >
            {page}
          </button>
        ))}
        <button
          className={mergeClassNames(
            'join-item btn btn-sm',
            config.current >= pageCount && 'btn-disabled',
          )}
          disabled={config.current >= pageCount}
          onClick={() => onChange(config.current + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </Component>
  )
}

/** 列表组件：children、items 与 dataSource 三种渲染方式。 */
const List: FC<ListProps> = ({
  bordered,
  className,
  children,
  dataSource,
  emptyText,
  footer,
  grid,
  header,
  itemLayout = 'horizontal',
  items,
  loading,
  loadMore,
  locale,
  pagination,
  renderItem,
  rowKey,
  size,
  split = true,
  style,
  ...rest
}) => {
  const loadingConfig = normalizeLoading(loading)
  const currentRef = ref(
    typeof pagination === 'object' ? (pagination.defaultCurrent ?? pagination.current ?? 1) : 1,
  )
  const pageSizeRef = ref(
    typeof pagination === 'object' ? (pagination.defaultPageSize ?? pagination.pageSize ?? 10) : 10,
  )
  const itemsHostRef = useRef<HTMLElement>()
  const topPagerHostRef = useRef<HTMLElement>()
  const bottomPagerHostRef = useRef<HTMLElement>()
  const hasDataSource = Array.isArray(dataSource)
  const dataItems = hasDataSource ? dataSource : items
  const hasPagination = !!pagination

  let cls = 'list'
  if (bordered) cls += ' border border-base-300 rounded-box overflow-hidden'
  if (grid) cls += ' grid'
  if (!split) cls += ' list-no-split'
  if (itemLayout === 'vertical') cls += ' list-vertical'
  cls = mergeClassNames(cls, resolveSizeClass(size), className) ?? 'list'

  const renderPageItems = (
    pageData: ReadonlyArray<any> | undefined,
    pager: NormalizedPaginationConfig | null,
  ) =>
    pageData?.map((item: any, index: number) => {
      const absoluteIndex = pager ? (pager.current - 1) * pager.pageSize + index : index
      const key = getRecordKey(item, absoluteIndex, rowKey as any)
      if (hasDataSource && renderItem) {
        return renderItem(item, absoluteIndex)
      }
      if (isLegacyListDataItem(item)) return renderLegacyItem(item, absoluteIndex)
      const fallbackContent = resolveRenderableItemContent(item)
      return (
        <Item key={key} itemLayout={itemLayout}>
          {fallbackContent}
        </Item>
      )
    })

  const getPagerSnapshot = () =>
    resolvePagination(pagination, dataItems?.length ?? 0, currentRef.value, pageSizeRef.value)

  const getPageDataSnapshot = (pager: NormalizedPaginationConfig | null) => {
    if (!dataItems) return dataItems
    if (!pager) return dataItems
    return dataItems.slice((pager.current - 1) * pager.pageSize, pager.current * pager.pageSize)
  }

  const renderPaginatedContent = () => {
    if (!hasPagination) return
    const pager = getPagerSnapshot()
    const listContent = loadingConfig.spinning
      ? renderLoading(loadingConfig)
      : dataItems && dataItems.length === 0
        ? renderEmpty(locale?.emptyText ?? emptyText)
        : renderPageItems(getPageDataSnapshot(pager), pager)

    if (itemsHostRef.current) {
      renderRue(listContent ?? null, itemsHostRef.current)
    }
    if (topPagerHostRef.current) {
      renderRue(
        pager && (pager.position === 'top' || pager.position === 'both')
          ? renderPager(pager, handlePageChange, 'div')
          : null,
        topPagerHostRef.current,
      )
    }
    if (bottomPagerHostRef.current) {
      renderRue(
        pager && (pager.position === 'bottom' || pager.position === 'both')
          ? renderPager(pager, handlePageChange, 'div')
          : null,
        bottomPagerHostRef.current,
      )
    }
  }

  const handlePageChange = (nextPage: number) => {
    const pager = getPagerSnapshot()
    if (!pager) return
    const pageCount = Math.max(1, Math.ceil(pager.total / pager.pageSize))
    const safePage = clampPage(nextPage, pageCount)
    if (typeof pagination === 'object' && pagination.current === undefined) {
      currentRef.value = safePage
    }
    pageSizeRef.value = pager.pageSize
    if (pager.onChange) pager.onChange(safePage, pager.pageSize)
    renderPaginatedContent()
  }

  onMounted(renderPaginatedContent)

  watch(
    () => [currentRef.value, pageSizeRef.value, dataItems?.length, loadingConfig.spinning],
    renderPaginatedContent,
  )

  if (hasPagination) {
    const wrapperCls = mergeClassNames(
      'rue-list',
      bordered && 'border border-base-300 rounded-box overflow-hidden',
      className,
    )
    const listCls = mergeClassNames(
      'list',
      grid && 'grid',
      !split && 'list-no-split',
      itemLayout === 'vertical' && 'list-vertical',
      resolveSizeClass(size),
    )

    return (
      <div {...rest} className={wrapperCls} style={!grid ? style : undefined}>
        <div ref={topPagerHostRef} />
        {isEmptyNode(header) ? null : (
          <div className="p-4 pb-2 text-sm font-medium opacity-70">{header}</div>
        )}
        <ul
          ref={itemsHostRef}
          className={listCls}
          style={getGridStyle(grid, grid ? style : undefined)}
        />
        {isEmptyNode(footer) ? null : <div className="p-4 pt-2 text-sm opacity-70">{footer}</div>}
        {isEmptyNode(loadMore) ? null : <div className="p-3 text-center">{loadMore}</div>}
        <div ref={bottomPagerHostRef} />
      </div>
    )
  }

  return (
    <ul {...rest} className={cls} style={getGridStyle(grid, style)}>
      {renderSection(header, 'p-4 pb-2 text-sm font-medium opacity-70')}
      {loadingConfig.spinning ? renderLoading(loadingConfig) : null}
      {!loadingConfig.spinning && dataItems && dataItems.length === 0
        ? renderEmpty(locale?.emptyText ?? emptyText)
        : null}
      {!loadingConfig.spinning &&
        dataItems &&
        dataItems.length > 0 &&
        renderPageItems(dataItems, null)}
      {!hasDataSource && !items ? children : null}
      {renderSection(footer, 'p-4 pt-2 text-sm opacity-70')}
      {renderSection(loadMore, 'p-3 text-center')}
    </ul>
  )
}

/** 行组件：normal 时为普通 li，否则为 list-row。 */
const Row: FC<ListRowProps> = ({ normal, className, children, ...rest }) => {
  if (normal) {
    return (
      <li {...rest} className={className || undefined}>
        {children}
      </li>
    )
  }
  return (
    <li {...rest} className={mergeClassNames('list-row', className)}>
      {children}
    </li>
  )
}

/** 列：可伸展区域。 */
const ColGrow: FC<ListColProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={mergeClassNames('list-col-grow', className)}>
      {children}
    </Component>
  )
}

/** 列：包裹区域。 */
const ColWrap: FC<ListColProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={mergeClassNames('list-col-wrap', className)}>
      {children}
    </Component>
  )
}

const Meta: FC<ListItemMetaProps> = ({
  avatar,
  className,
  description,
  title,
  children,
  ...rest
}) => {
  return (
    <div {...rest} className={mergeClassNames('flex min-w-0 flex-1 items-start gap-3', className)}>
      {avatar ? <div className="shrink-0">{avatar}</div> : null}
      <div className="min-w-0 flex-1">
        {title ? <div className="font-medium">{title}</div> : null}
        {description ? <div className="text-sm opacity-70">{description}</div> : null}
        {children}
      </div>
    </div>
  )
}

/** 项组件：默认保持普通 li；传入 actions/extra 时自动组织为信息行。 */
const Item: FC<ListItemProps> = ({
  actions,
  className,
  classNames,
  extra,
  itemLayout = 'horizontal',
  styles,
  children,
  ...rest
}) => {
  const hasActions = !!actions && actions.length > 0
  const hasExtra = !isEmptyNode(extra)
  if (!hasActions && !hasExtra) {
    return (
      <li {...rest} className={className || undefined}>
        {children}
      </li>
    )
  }

  const vertical = itemLayout === 'vertical'
  return (
    <li
      {...rest}
      className={mergeClassNames(
        'list-row',
        vertical && 'items-start',
        hasExtra && !vertical && 'grid-cols-[1fr_auto]',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {children}
        {hasActions ? (
          <ul
            className={mergeClassNames(
              'mt-3 flex flex-wrap items-center gap-2 text-sm opacity-80',
              classNames?.actions,
            )}
            style={styles?.actions}
          >
            {actions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {hasExtra ? (
        <div className={mergeClassNames('list-col-wrap', classNames?.extra)} style={styles?.extra}>
          {extra}
        </div>
      ) : null}
    </li>
  )
}

type ListCompound = FC<ListProps> & {
  Row: FC<ListRowProps>
  ColGrow: FC<ListColProps>
  ColWrap: FC<ListColProps>
  Item: FC<ListItemProps> & {
    Meta: FC<ListItemMetaProps>
  }
}

const ItemCompound = Object.assign(Item, {
  Meta,
})

const ListCompound: ListCompound = Object.assign(List, {
  Row,
  ColGrow,
  ColWrap,
  Item: ItemCompound,
})

export default ListCompound
