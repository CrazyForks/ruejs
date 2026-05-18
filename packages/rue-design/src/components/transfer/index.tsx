/*
Transfer 组件概述
- 提供接近成熟组件库的双栏穿梭能力，覆盖受控 / 非受控、搜索、分页、单向模式与自定义渲染。
- 视觉上延续 Rue 当前的轻量卡片语言，不直接照搬 ant-design，而是以 badge / card / btn / checkbox 语义重组交互。
- 数据模型保持 `dataSource + targetKeys + selectedKeys` 主线，便于和 antd Transfer 的使用心智保持一致。
*/
import type { FC } from '@rue-js/rue'
import { h, onMounted, ref, render as renderRue, useRef, watch } from '@rue-js/rue'

export type TransferKey = string | number
export type TransferDirection = 'left' | 'right'
export type TransferStatus = 'warning' | 'error'
export type TransferSize = 'small' | 'default' | 'middle' | 'large' | 'sm' | 'md' | 'lg'

export interface TransferItem {
  key?: TransferKey
  title?: any
  description?: any
  disabled?: boolean
  [key: string]: any
}

export interface TransferRenderResultObject {
  label: any
  value?: string
  description?: any
}

export type TransferRenderResult = TransferRenderResultObject | string | number | any | null
export type TransferRender<RecordType> = (item: RecordType) => TransferRenderResult

export interface TransferLocale {
  titles?: any[]
  notFoundContent?: any | any[]
  searchPlaceholder?: any
  itemUnit?: string
  itemsUnit?: string
  remove?: any
  selectAll?: any
  deselectAll?: any
  selectInvert?: any
  clearSelection?: any
  removeSelected?: any
}

export interface TransferSearchConfig {
  placeholder?: string
  defaultValue?: string
}

export interface TransferPaginationConfig {
  pageSize?: number
}

export interface TransferListStyleInfo {
  direction: TransferDirection
}

export interface TransferClassNames {
  root?: string
  panel?: string
  header?: string
  search?: string
  body?: string
  list?: string
  item?: string
  operations?: string
  footer?: string
  empty?: string
  pager?: string
}

export interface TransferStyles {
  root?: Record<string, any>
  panel?: Record<string, any>
  header?: Record<string, any>
  search?: Record<string, any>
  body?: Record<string, any>
  list?: Record<string, any>
  item?: Record<string, any>
  operations?: Record<string, any>
  footer?: Record<string, any>
  empty?: Record<string, any>
  pager?: Record<string, any>
}

export interface TransferRenderListItem<RecordType = TransferItem> {
  key: TransferKey
  record: RecordType
  disabled: boolean
  label: any
  description?: any
  searchText: string
}

export interface TransferRenderListProps<RecordType = TransferItem> {
  direction: TransferDirection
  disabled: boolean
  items: TransferRenderListItem<RecordType>[]
  filteredItems: TransferRenderListItem<RecordType>[]
  selectedKeys: TransferKey[]
  searchValue: string
  onItemSelect: (key: TransferKey, selected: boolean) => void
  onItemSelectAll: (keys: TransferKey[], selected: boolean) => void
}

export interface TransferProps<RecordType = TransferItem> {
  className?: string
  style?: Record<string, any>
  disabled?: boolean
  size?: TransferSize
  status?: TransferStatus
  dataSource?: RecordType[]
  targetKeys?: TransferKey[]
  defaultTargetKeys?: TransferKey[]
  selectedKeys?: TransferKey[]
  defaultSelectedKeys?: TransferKey[]
  render?: TransferRender<RecordType>
  onChange?: (
    targetKeys: TransferKey[],
    direction: TransferDirection,
    moveKeys: TransferKey[],
  ) => void
  onSelectChange?: (sourceSelectedKeys: TransferKey[], targetSelectedKeys: TransferKey[]) => void
  titles?: any[]
  operations?: any[]
  actions?: any[]
  showSearch?: boolean | TransferSearchConfig
  filterOption?: (inputValue: string, item: RecordType, direction: TransferDirection) => boolean
  locale?: TransferLocale
  footer?: (
    props: TransferRenderListProps<RecordType>,
    info: { direction: TransferDirection },
  ) => any
  renderList?: (props: TransferRenderListProps<RecordType>) => any
  rowKey?: (record: RecordType) => TransferKey
  onSearch?: (direction: TransferDirection, value: string) => void
  onScroll?: (direction: TransferDirection, event: Event) => void
  children?: (props: TransferRenderListProps<RecordType>) => any
  showSelectAll?: boolean
  selectAllLabels?: Array<any | ((info: { selectedCount: number; totalCount: number }) => any)>
  oneWay?: boolean
  pagination?: boolean | TransferPaginationConfig
  listStyle?: Record<string, any> | ((info: TransferListStyleInfo) => Record<string, any>)
  operationStyle?: Record<string, any>
  classNames?: TransferClassNames
  styles?: TransferStyles
  [key: string]: any
}

interface NormalizedTransferItem<RecordType> extends TransferRenderListItem<RecordType> {
  keyText: string
}

interface TransferPageSlice<RecordType> {
  currentPage: number
  pageCount: number
  items: NormalizedTransferItem<RecordType>[]
}

interface TransferStateSnapshot<RecordType> {
  mergedTargetKeys: TransferKey[]
  mergedSelectedKeys: TransferKey[]
  sourceSelectedKeys: TransferKey[]
  targetSelectedKeys: TransferKey[]
  sourceItems: NormalizedTransferItem<RecordType>[]
  targetItems: NormalizedTransferItem<RecordType>[]
}

type TransferSelectAllLabel = NonNullable<TransferProps<any>['selectAllLabels']>[number]

const resolveDisplayLabel = <RecordType,>(item: NormalizedTransferItem<RecordType>) => {
  if (typeof item.label === 'string' || typeof item.label === 'number') return item.label
  return resolveFallbackLabel(item.record, item.key)
}

const defaultLocale: Required<TransferLocale> = {
  titles: ['待选择', '已加入'],
  notFoundContent: '暂无条目',
  searchPlaceholder: '搜索条目',
  itemUnit: '项',
  itemsUnit: '项',
  remove: '移出',
  selectAll: '全选',
  deselectAll: '取消全选',
  selectInvert: '反选',
  clearSelection: '清空选择',
  removeSelected: '移出已选',
}

const TRANSFER_REENTRANT_RENDER_ERROR =
  'Reentrant render detected on the same target. This usually means render logic triggered a nested render or state update while that target was already rendering.'

const appendClassName = (base?: string, className?: string) => {
  if (!base) return className ?? ''
  return className ? `${base} ${className}` : base
}

const toKeyText = (key: TransferKey) => `${typeof key}:${String(key)}`

const uniqKeys = (keys?: ReadonlyArray<TransferKey>) => {
  const next: TransferKey[] = []
  const seen = new Set<string>()

  ;(keys ?? []).forEach(key => {
    const keyText = toKeyText(key)
    if (seen.has(keyText)) return
    seen.add(keyText)
    next.push(key)
  })

  return next
}

const hasKey = (keys: ReadonlyArray<TransferKey>, key: TransferKey) => {
  const keyText = toKeyText(key)
  return keys.some(current => toKeyText(current) === keyText)
}

const removeKeys = (keys: ReadonlyArray<TransferKey>, keysToRemove: ReadonlyArray<TransferKey>) => {
  const removeSet = new Set(keysToRemove.map(toKeyText))
  return keys.filter(key => !removeSet.has(toKeyText(key)))
}

const stringifySearchPart = (value: any): string => {
  if (value == null || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    return value
      .map(item => stringifySearchPart(item))
      .filter(Boolean)
      .join(' ')
  }
  if (typeof value === 'object') {
    const candidateFields = ['value', 'title', 'label', 'name', 'description', 'text', 'children']
    return candidateFields
      .map(field => stringifySearchPart(value[field]))
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

const resolveFallbackLabel = (record: any, key: TransferKey) => {
  const candidates = [record?.title, record?.label, record?.name, record?.text, record?.description]
  const matched = candidates.find(candidate => candidate !== undefined && candidate !== null)
  return matched ?? String(key)
}

const normalizeRenderResult = <RecordType,>(
  record: RecordType,
  key: TransferKey,
  render?: TransferRender<RecordType>,
) => {
  const rendered = render ? render(record) : undefined

  if (rendered && typeof rendered === 'object' && !Array.isArray(rendered) && 'label' in rendered) {
    const result = rendered as TransferRenderResultObject
    return {
      label: result.label,
      description: result.description,
      searchText:
        stringifySearchPart(result.value) ||
        stringifySearchPart(result.label) ||
        stringifySearchPart((record as any)?.description) ||
        stringifySearchPart(resolveFallbackLabel(record, key)),
    }
  }

  if (rendered !== undefined && rendered !== null) {
    return {
      label: rendered,
      description: (record as any)?.description,
      searchText:
        stringifySearchPart(rendered) ||
        stringifySearchPart((record as any)?.description) ||
        stringifySearchPart(resolveFallbackLabel(record, key)),
    }
  }

  return {
    label: resolveFallbackLabel(record, key),
    description: (record as any)?.description,
    searchText: [
      stringifySearchPart((record as any)?.title),
      stringifySearchPart((record as any)?.label),
      stringifySearchPart((record as any)?.name),
      stringifySearchPart((record as any)?.description),
      stringifySearchPart(key),
    ]
      .filter(Boolean)
      .join(' '),
  }
}

const resolveRecordKey = <RecordType,>(
  record: RecordType,
  index: number,
  rowKey?: (record: RecordType) => TransferKey,
) => {
  if (typeof rowKey === 'function') return rowKey(record)
  if ((record as any)?.key !== undefined && (record as any)?.key !== null)
    return (record as any).key
  return index
}

const normalizeDataSource = <RecordType,>(
  dataSource: RecordType[] | undefined,
  rowKey?: (record: RecordType) => TransferKey,
  render?: TransferRender<RecordType>,
) => {
  const seen = new Set<string>()

  return (dataSource ?? []).flatMap<NormalizedTransferItem<RecordType>>((record, index) => {
    const key = resolveRecordKey(record, index, rowKey)
    const keyText = toKeyText(key)
    if (seen.has(keyText)) return []
    seen.add(keyText)

    const result = normalizeRenderResult(record, key, render)
    return [
      {
        key,
        keyText,
        record,
        disabled: !!(record as any)?.disabled,
        label: result.label,
        description: result.description,
        searchText: result.searchText,
      },
    ]
  })
}

const resolveTitles = (titles?: any[], localeTitles?: any[]) => {
  const resolved = titles ?? localeTitles ?? defaultLocale.titles
  return [resolved[0] ?? defaultLocale.titles[0], resolved[1] ?? defaultLocale.titles[1]]
}

const resolveNotFoundContent = (
  notFoundContent: any | any[] | undefined,
  direction: TransferDirection,
) => {
  if (Array.isArray(notFoundContent)) {
    return notFoundContent[direction === 'left' ? 0 : 1] ?? defaultLocale.notFoundContent
  }
  return notFoundContent ?? defaultLocale.notFoundContent
}

const normalizeSearchConfig = (showSearch?: boolean | TransferSearchConfig) => {
  if (!showSearch)
    return { enabled: false, placeholder: defaultLocale.searchPlaceholder, defaultValue: '' }
  if (typeof showSearch === 'object') {
    return {
      enabled: true,
      placeholder: showSearch.placeholder ?? defaultLocale.searchPlaceholder,
      defaultValue: showSearch.defaultValue ?? '',
    }
  }
  return { enabled: true, placeholder: defaultLocale.searchPlaceholder, defaultValue: '' }
}

const normalizePagination = (pagination?: boolean | TransferPaginationConfig) => {
  if (!pagination) return null
  if (pagination === true) return { pageSize: 10 }
  return { pageSize: Math.max(1, Math.floor(pagination.pageSize ?? 10)) }
}

const resolveListStyle = (
  listStyle: TransferProps['listStyle'],
  direction: TransferDirection,
): Record<string, any> | undefined => {
  if (!listStyle) return undefined
  if (typeof listStyle === 'function') return listStyle({ direction })
  return listStyle
}

const partitionSelectedKeys = <RecordType,>(
  keys: ReadonlyArray<TransferKey>,
  targetKeySet: Set<string>,
  itemMap: Map<string, NormalizedTransferItem<RecordType>>,
) => {
  const left: TransferKey[] = []
  const right: TransferKey[] = []

  keys.forEach(key => {
    const keyText = toKeyText(key)
    if (!itemMap.has(keyText)) return
    if (targetKeySet.has(keyText)) right.push(key)
    else left.push(key)
  })

  return { left, right }
}

const filterItems = <RecordType,>(
  items: NormalizedTransferItem<RecordType>[],
  inputValue: string,
  direction: TransferDirection,
  filterOption?: (inputValue: string, item: RecordType, direction: TransferDirection) => boolean,
) => {
  const trimmedValue = inputValue.trim()
  if (!trimmedValue) return items

  return items.filter(item => {
    if (filterOption) return filterOption(trimmedValue, item.record, direction)
    return item.searchText.toLowerCase().includes(trimmedValue.toLowerCase())
  })
}

const paginateItems = <RecordType,>(
  items: NormalizedTransferItem<RecordType>[],
  page: number,
  pageSize?: number,
): TransferPageSlice<RecordType> => {
  if (!pageSize) {
    return {
      currentPage: 1,
      pageCount: 1,
      items,
    }
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), pageCount)
  const start = (currentPage - 1) * pageSize

  return {
    currentPage,
    pageCount,
    items: items.slice(start, start + pageSize),
  }
}

const resolveUnitLabel = (total: number, locale: Required<TransferLocale>) => {
  return total === 1 ? locale.itemUnit : locale.itemsUnit
}

const resolveSelectAllLabel = (
  label: TransferSelectAllLabel | undefined,
  info: { selectedCount: number; totalCount: number },
) => {
  if (typeof label === 'function') return label(info)
  return label
}

const resolveSizeConfig = (size?: TransferSize) => {
  switch (size) {
    case 'small':
    case 'sm':
      return {
        inputClass: 'input-sm',
        buttonClass: 'btn-sm',
        checkboxSize: 'sm' as const,
        itemClass: 'px-3 py-2 text-sm',
        panelMinHeightClass: 'min-h-[19rem]',
      }
    case 'large':
    case 'lg':
      return {
        inputClass: 'input-md',
        buttonClass: 'btn-md',
        checkboxSize: 'md' as const,
        itemClass: 'px-4 py-3.5 text-[0.95rem]',
        panelMinHeightClass: 'min-h-[23rem]',
      }
    default:
      return {
        inputClass: 'input-sm',
        buttonClass: 'btn-sm',
        checkboxSize: 'sm' as const,
        itemClass: 'px-3.5 py-2.5 text-sm',
        panelMinHeightClass: 'min-h-[21rem]',
      }
  }
}

const resolveStatusClassName = (status?: TransferStatus) => {
  switch (status) {
    case 'error':
      return 'border-error/55 shadow-[0_0_0_1px_rgba(248,113,113,0.14)]'
    case 'warning':
      return 'border-warning/55 shadow-[0_0_0_1px_rgba(251,191,36,0.14)]'
    default:
      return ''
  }
}

const resolveCheckboxClassName = (size?: 'sm' | 'md') => {
  if (size === 'md') return 'checkbox checkbox-md'
  return 'checkbox checkbox-sm'
}

const ArrowRightIcon: FC = () => {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m13 6 6 6-6 6" />
    </svg>
  )
}

const ArrowLeftIcon: FC = () => {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m11 18-6-6 6-6" />
    </svg>
  )
}

const CloseIcon: FC = () => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-3.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

interface TransferManagedPanelProps {
  direction: TransferDirection
  rawItems: NormalizedTransferItem<any>[]
  sideSelectedKeys: TransferKey[]
  searchValue: string
  currentPage: number
  disabled?: boolean
  filterOption?: TransferProps<any>['filterOption']
  footer?: TransferProps<any>['footer']
  listStyle?: TransferProps<any>['listStyle']
  oneWay?: boolean
  onScroll?: TransferProps<any>['onScroll']
  selectAllLabels: NonNullable<TransferProps<any>['selectAllLabels']>
  showSelectAll: boolean
  status?: TransferStatus
  classNames?: TransferClassNames
  styles?: TransferStyles
  paginationPageSize?: number
  searchEnabled: boolean
  sizeConfig: ReturnType<typeof resolveSizeConfig>
  mergedLocale: Required<TransferLocale>
  title: any
  sharedSearchPlaceholder: string
  customListRenderer?: (props: TransferRenderListProps<any>) => any
  getTransferStateSnapshot: () => TransferStateSnapshot<any>
  onItemSelect: (key: TransferKey, selected: boolean) => void
  onItemSelectAll: (keys: TransferKey[], selected: boolean) => void
  onReplaceSideSelection: (nextSideSelectedKeys: TransferKey[]) => void
  onMoveItems: (direction: TransferDirection, moveKeys: TransferKey[]) => void
  onSearchInput: (value: string) => void
  assignSearchInputRef: (element: HTMLInputElement | null) => void
  searchComposingRef: { current: boolean }
  runManagedRenderCallback: <T>(runner: () => T) => T
  setCurrentPage: (nextPage: number) => void
}

const TransferManagedPanel: FC<TransferManagedPanelProps> = ({
  direction,
  rawItems,
  sideSelectedKeys,
  searchValue,
  currentPage,
  disabled,
  filterOption,
  footer,
  listStyle,
  oneWay,
  onScroll,
  selectAllLabels,
  showSelectAll,
  status,
  classNames,
  styles,
  paginationPageSize,
  searchEnabled,
  sizeConfig,
  mergedLocale,
  title,
  sharedSearchPlaceholder,
  customListRenderer,
  getTransferStateSnapshot,
  onItemSelect,
  onItemSelectAll,
  onReplaceSideSelection,
  onMoveItems,
  onSearchInput,
  assignSearchInputRef,
  searchComposingRef,
  runManagedRenderCallback,
  setCurrentPage,
}) => {
  const sideIndex = direction === 'left' ? 0 : 1
  const filteredItems = filterItems(rawItems, searchValue, direction, filterOption)
  const pagedItems = paginateItems(filteredItems, currentPage, paginationPageSize)

  const visibleItems = pagedItems.items
  const visibleSelectableKeys = visibleItems
    .filter(item => !disabled && !item.disabled)
    .map(item => item.key)
  const visibleSelectedCount = visibleSelectableKeys.filter(key =>
    hasKey(sideSelectedKeys, key),
  ).length
  const visibleAllSelected =
    visibleSelectableKeys.length > 0 && visibleSelectedCount === visibleSelectableKeys.length
  const visiblePartiallySelected = visibleSelectedCount > 0 && !visibleAllSelected
  const filteredSelectableKeys = filteredItems
    .filter(item => !disabled && !item.disabled)
    .map(item => item.key)
  const snapshot = getTransferStateSnapshot()
  const removableSelectedKeys =
    direction === 'right'
      ? snapshot.targetItems
          .filter(item => hasKey(snapshot.targetSelectedKeys, item.key) && !item.disabled)
          .map(item => item.key)
      : []

  const listRenderProps: TransferRenderListProps<any> = {
    direction,
    disabled: !!disabled,
    items: visibleItems.map(item => ({
      key: item.key,
      record: item.record,
      disabled: item.disabled,
      label: resolveDisplayLabel(item),
      description: item.description,
      searchText: item.searchText,
    })),
    filteredItems: filteredItems.map(item => ({
      key: item.key,
      record: item.record,
      disabled: item.disabled,
      label: resolveDisplayLabel(item),
      description: item.description,
      searchText: item.searchText,
    })),
    selectedKeys: sideSelectedKeys,
    searchValue,
    onItemSelect,
    onItemSelectAll,
  }

  const selectionBadge = resolveSelectAllLabel(selectAllLabels[sideIndex], {
    selectedCount: visibleSelectedCount,
    totalCount: visibleSelectableKeys.length,
  })

  const panelClassName = appendClassName(
    appendClassName(
      `relative overflow-hidden rounded-[1.35rem] border border-base-300/70 bg-gradient-to-b from-base-100 via-base-100 to-base-200/35 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] ${sizeConfig.panelMinHeightClass}`,
      resolveStatusClassName(status),
    ),
    classNames?.panel,
  )

  const panelStyle = {
    ...styles?.panel,
    ...resolveListStyle(listStyle, direction),
  }

  const defaultListContent = visibleItems.length ? (
    <ul role="listbox" aria-multiselectable="true" className="space-y-2">
      {visibleItems.map(item => {
        const checked = hasKey(sideSelectedKeys, item.key)
        const removable = oneWay && direction === 'right' && !disabled && !item.disabled

        return (
          <li key={item.keyText}>
            <label
              className={appendClassName(
                appendClassName(
                  appendClassName(
                    `flex w-full items-start gap-3 rounded-2xl border border-base-300/75 bg-base-100/80 ${sizeConfig.itemClass} transition duration-200 ease-out hover:border-base-300 hover:bg-base-100 hover:shadow-sm`,
                    checked
                      ? 'border-primary/45 bg-primary/6 shadow-[0_14px_28px_-24px_rgba(59,130,246,0.75)]'
                      : '',
                  ),
                  disabled || item.disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                ),
                classNames?.item,
              )}
              style={styles?.item}
            >
              <span className="shrink-0 pt-0.5">
                <input
                  type="checkbox"
                  className={resolveCheckboxClassName(sizeConfig.checkboxSize)}
                  checked={checked}
                  disabled={disabled || item.disabled}
                  onChange={(event: Event) =>
                    onItemSelect(item.key, (event.currentTarget as HTMLInputElement).checked)
                  }
                />
              </span>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="min-w-0 truncate font-medium leading-5 text-base-content">
                    {resolveDisplayLabel(item)}
                  </div>
                  {item.description ? (
                    <div className="mt-1 text-xs leading-5 text-base-content/60">
                      {item.description}
                    </div>
                  ) : null}
                </div>
                {removable ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs -mt-1 -mr-1 rounded-full text-base-content/55 hover:text-base-content"
                    aria-label={String(mergedLocale.remove)}
                    onClick={(event: MouseEvent) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onMoveItems('left', [item.key])
                    }}
                  >
                    <CloseIcon />
                  </button>
                ) : null}
              </div>
            </label>
          </li>
        )
      })}
    </ul>
  ) : (
    <div
      className={appendClassName(
        'grid h-full place-items-center px-6 py-8 text-center text-sm text-base-content/55',
        classNames?.empty,
      )}
      style={styles?.empty}
    >
      <div>
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-base-200/80 text-base-content/35">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="size-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M7 4h10l1 3H6l1-3Z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 10v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7"
            />
          </svg>
        </div>
        <div>{resolveNotFoundContent(mergedLocale.notFoundContent, direction)}</div>
      </div>
    </div>
  )

  return (
    <section className={panelClassName} style={panelStyle} data-rue-transfer-panel={direction}>
      <div
        className={appendClassName(
          'flex min-h-16 flex-wrap items-start justify-between gap-3 border-b border-base-300/70 px-4 py-4',
          classNames?.header,
        )}
        style={styles?.header}
      >
        <div
          className="min-w-0 flex-1"
          style={direction === 'right' && oneWay ? { flex: 4 } : undefined}
        >
          <div className="flex flex-wrap items-center gap-2">
            {showSelectAll ? (
              <label
                className={appendClassName(
                  'mr-1 inline-flex items-center',
                  disabled || visibleSelectableKeys.length === 0
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer',
                )}
              >
                <input
                  ref={(element: HTMLInputElement | null) => {
                    if (element) element.indeterminate = visiblePartiallySelected
                  }}
                  type="checkbox"
                  className={resolveCheckboxClassName(sizeConfig.checkboxSize)}
                  checked={visibleAllSelected}
                  disabled={disabled || visibleSelectableKeys.length === 0}
                  aria-label={`${String(title)}全选`}
                  onChange={(event: Event) =>
                    onItemSelectAll(
                      visibleSelectableKeys,
                      (event.currentTarget as HTMLInputElement).checked,
                    )
                  }
                />
              </label>
            ) : null}
            <h3 className="m-0 truncate text-sm font-semibold text-base-content md:text-[0.95rem]">
              {title}
            </h3>
            <span className="badge badge-ghost badge-sm rounded-full px-2.5">
              {sideSelectedKeys.length}/{rawItems.length}{' '}
              {resolveUnitLabel(rawItems.length, mergedLocale)}
            </span>
            {filteredItems.length !== rawItems.length ? (
              <span className="text-xs text-base-content/55">匹配 {filteredItems.length}</span>
            ) : null}
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-1.5 text-xs md:w-auto md:justify-end">
          {selectionBadge ? (
            <span className="badge badge-outline badge-sm">{selectionBadge}</span>
          ) : null}
          {showSelectAll && visibleSelectableKeys.length > 0 ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-xs min-h-0 rounded-full px-2"
                disabled={disabled}
                onClick={() => onItemSelectAll(filteredSelectableKeys, true)}
              >
                {mergedLocale.selectAll}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs min-h-0 rounded-full px-2"
                disabled={disabled}
                onClick={() => {
                  const invertedKeys = filteredSelectableKeys.filter(
                    key => !hasKey(sideSelectedKeys, key),
                  )
                  onReplaceSideSelection([
                    ...removeKeys(sideSelectedKeys, filteredSelectableKeys),
                    ...invertedKeys,
                  ])
                }}
              >
                {mergedLocale.selectInvert}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs min-h-0 rounded-full px-2"
                disabled={disabled || sideSelectedKeys.length === 0}
                onClick={() => onItemSelectAll(sideSelectedKeys, false)}
              >
                {mergedLocale.clearSelection}
              </button>
            </>
          ) : null}
          {oneWay && direction === 'right' ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs min-h-0 rounded-full px-2"
              disabled={disabled || removableSelectedKeys.length === 0}
              onClick={() => onMoveItems('left', removableSelectedKeys)}
            >
              {mergedLocale.removeSelected}
            </button>
          ) : null}
        </div>
      </div>

      {searchEnabled ? (
        <div
          className={appendClassName('border-b border-base-300/70 px-4 py-3', classNames?.search)}
          style={styles?.search}
        >
          <label className="input input-bordered flex w-full items-center gap-2 rounded-2xl border-base-300/80 bg-base-100/85 px-3 shadow-sm focus-within:border-primary/45 focus-within:outline-none">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="size-4 text-base-content/50"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={assignSearchInputRef}
              type="text"
              value={searchValue}
              placeholder={sharedSearchPlaceholder}
              className={appendClassName(
                `grow bg-transparent ${sizeConfig.inputClass}`,
                'border-none px-0 outline-none',
              )}
              onCompositionStart={() => {
                searchComposingRef.current = true
              }}
              onCompositionEnd={(event: Event) => {
                searchComposingRef.current = false
                onSearchInput((event.currentTarget as HTMLInputElement).value)
              }}
              onInput={(event: Event) =>
                searchComposingRef.current
                  ? undefined
                  : onSearchInput((event.currentTarget as HTMLInputElement).value)
              }
            />
          </label>
        </div>
      ) : null}

      <div className={appendClassName('flex flex-col', classNames?.body)} style={styles?.body}>
        <div
          className={appendClassName('h-80 overflow-auto px-3 py-3', classNames?.list)}
          style={styles?.list}
          onScroll={(event: Event) => {
            if (onScroll) onScroll(direction, event)
          }}
        >
          {customListRenderer ? (
            <>{runManagedRenderCallback(() => customListRenderer(listRenderProps))}</>
          ) : (
            <>{defaultListContent}</>
          )}
        </div>

        {paginationPageSize != null && filteredItems.length > 0 ? (
          <div
            className={appendClassName(
              'flex items-center justify-between border-t border-base-300/70 px-4 py-3 text-xs text-base-content/65',
              classNames?.pager,
            )}
            style={styles?.pager}
          >
            <span>
              第 {pagedItems.currentPage} / {pagedItems.pageCount} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-xs rounded-full"
                disabled={pagedItems.currentPage <= 1}
                onClick={() => setCurrentPage(pagedItems.currentPage - 1)}
              >
                上一页
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs rounded-full"
                disabled={pagedItems.currentPage >= pagedItems.pageCount}
                onClick={() => setCurrentPage(pagedItems.currentPage + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        ) : null}

        {footer ? (
          <div
            className={appendClassName('border-t border-base-300/70 px-4 py-3', classNames?.footer)}
            style={styles?.footer}
          >
            <>
              {runManagedRenderCallback(() =>
                footer(
                  {
                    ...listRenderProps,
                    items: [...listRenderProps.items],
                    filteredItems: [...listRenderProps.filteredItems],
                    selectedKeys: [...listRenderProps.selectedKeys],
                  },
                  { direction },
                ),
              )}
            </>
          </div>
        ) : null}
      </div>
    </section>
  )
}

const Transfer: FC<TransferProps<any>> = ({
  className,
  style,
  disabled,
  size,
  status,
  dataSource,
  targetKeys,
  defaultTargetKeys,
  selectedKeys,
  defaultSelectedKeys,
  render,
  onChange,
  onSelectChange,
  titles,
  operations,
  actions,
  showSearch,
  filterOption,
  locale,
  footer,
  renderList,
  rowKey,
  onSearch,
  onScroll,
  children: _children,
  showSelectAll = true,
  selectAllLabels = [],
  oneWay,
  pagination,
  listStyle,
  operationStyle,
  classNames,
  styles,
  ...rest
}: TransferProps<any>) => {
  const mergedLocale: Required<TransferLocale> = {
    ...defaultLocale,
    ...locale,
  }
  const searchConfig = normalizeSearchConfig(showSearch)
  const paginationConfig = normalizePagination(pagination)
  const sizeConfig = resolveSizeConfig(size)

  const uncontrolledTargetKeysRef = ref(uniqKeys(defaultTargetKeys ?? targetKeys))
  const uncontrolledSelectedKeysRef = ref(uniqKeys(defaultSelectedKeys ?? selectedKeys))
  const leftSearchValueRef = ref(searchConfig.defaultValue)
  const rightSearchValueRef = ref(searchConfig.defaultValue)
  const leftPageRef = ref(1)
  const rightPageRef = ref(1)
  const leftSearchInputRef = useRef<HTMLInputElement>()
  const rightSearchInputRef = useRef<HTMLInputElement>()
  const leftSearchComposingRef = useRef(false)
  const rightSearchComposingRef = useRef(false)
  const activeManagedRenderRef = useRef<TransferDirection | 'operations' | null>(null)
  const leftPanelHostRef = useRef<HTMLElement>()
  const operationsHostRef = useRef<HTMLElement>()
  const rightPanelHostRef = useRef<HTMLElement>()

  const normalizedItems = normalizeDataSource(dataSource, rowKey, render)
  const itemMap = new Map(normalizedItems.map(item => [item.keyText, item]))

  const mergedActions = actions ?? operations ?? ['加入', '移出']
  const mergedTitles = resolveTitles(titles, mergedLocale.titles)
  const sharedSearchPlaceholder = searchConfig.placeholder || String(mergedLocale.searchPlaceholder)
  const customListRenderer =
    typeof renderList === 'function'
      ? renderList
      : typeof _children === 'function' &&
          (_children as { kind?: unknown }).kind !== 'block-factory'
        ? (_children as (props: TransferRenderListProps<any>) => any)
        : undefined

  const getTransferStateSnapshot = () => {
    const mergedTargetKeys = (
      targetKeys !== undefined ? uniqKeys(targetKeys) : uncontrolledTargetKeysRef.value
    ).filter(key => itemMap.has(toKeyText(key)))
    const targetKeySet = new Set(mergedTargetKeys.map(toKeyText))
    const mergedSelectedKeys = (
      selectedKeys !== undefined ? uniqKeys(selectedKeys) : uncontrolledSelectedKeysRef.value
    ).filter(key => itemMap.has(toKeyText(key)))
    const selectedPartitions = partitionSelectedKeys(mergedSelectedKeys, targetKeySet, itemMap)
    const sourceItems = normalizedItems.filter(item => !targetKeySet.has(item.keyText))
    const targetItems = mergedTargetKeys
      .map(key => itemMap.get(toKeyText(key)))
      .filter(Boolean) as NormalizedTransferItem<any>[]

    return {
      mergedTargetKeys,
      mergedSelectedKeys,
      sourceSelectedKeys: selectedPartitions.left,
      targetSelectedKeys: selectedPartitions.right,
      sourceItems,
      targetItems,
    }
  }

  const emitSelectChange = (
    nextSelectedKeys: TransferKey[],
    nextTargetKeys = getTransferStateSnapshot().mergedTargetKeys,
  ) => {
    if (!onSelectChange) return
    const nextTargetSet = new Set(nextTargetKeys.map(toKeyText))
    const partitions = partitionSelectedKeys(nextSelectedKeys, nextTargetSet, itemMap)
    onSelectChange(partitions.left, partitions.right)
  }

  const managedPanelSharedProps = {
    disabled,
    filterOption,
    footer,
    listStyle,
    oneWay,
    onScroll,
    selectAllLabels,
    showSelectAll,
    status,
    classNames,
    styles,
  }

  const reportManagedRenderMutationError = (mutation: string) => {
    const activeRegion = activeManagedRenderRef.current ?? 'unknown'
    const error = new Error(
      `${TRANSFER_REENTRANT_RENDER_ERROR} Transfer blocked ${mutation} while the ${activeRegion} managed region was rendering.`,
    )
    const runtime =
      (globalThis as { __rue_active?: { handleError?: (error: Error, instance?: any) => void } })
        .__rue_active ??
      (
        globalThis as {
          __rue_vapor_preferred?: { handleError?: (error: Error, instance?: any) => void }
        }
      ).__rue_vapor_preferred ??
      (globalThis as { __rue?: { handleError?: (error: Error, instance?: any) => void } }).__rue

    try {
      runtime?.handleError?.(error, null)
    } catch {
      // Ignore secondary error reporting failures and preserve the original error.
    }
  }

  const renderManagedTarget = (
    region: TransferDirection | 'operations',
    node: any,
    host: HTMLElement,
  ) => {
    const previousRegion = activeManagedRenderRef.current
    activeManagedRenderRef.current = region
    try {
      renderRue(node, host)
    } finally {
      activeManagedRenderRef.current = previousRegion
    }
  }

  const runManagedRenderCallback = <T,>(region: TransferDirection, runner: () => T) => {
    const previousRegion = activeManagedRenderRef.current
    activeManagedRenderRef.current = region
    try {
      return runner()
    } finally {
      activeManagedRenderRef.current = previousRegion
    }
  }

  const renderManagedRegions = () => {
    const activeElement =
      typeof document !== 'undefined' ? (document.activeElement as HTMLInputElement | null) : null
    const restoreFocusState =
      activeElement === leftSearchInputRef.current
        ? {
            direction: 'left' as const,
            selectionStart: activeElement.selectionStart,
            selectionEnd: activeElement.selectionEnd,
          }
        : activeElement === rightSearchInputRef.current
          ? {
              direction: 'right' as const,
              selectionStart: activeElement.selectionStart,
              selectionEnd: activeElement.selectionEnd,
            }
          : null

    const snapshot = getTransferStateSnapshot()

    if (leftPanelHostRef.current) {
      renderManagedTarget(
        'left',
        h(TransferManagedPanel, {
          ...managedPanelSharedProps,
          direction: 'left',
          rawItems: snapshot.sourceItems,
          sideSelectedKeys: snapshot.sourceSelectedKeys,
          searchValue: leftSearchValueRef.value,
          currentPage: leftPageRef.value,
          paginationPageSize: paginationConfig?.pageSize,
          searchEnabled: searchConfig.enabled,
          sizeConfig,
          mergedLocale,
          title: mergedTitles[0],
          sharedSearchPlaceholder,
          customListRenderer,
          getTransferStateSnapshot,
          onItemSelect: (key: TransferKey, selected: boolean) =>
            handleItemSelect('left', key, selected),
          onItemSelectAll: (keys: TransferKey[], selected: boolean) =>
            handleItemSelectAll('left', keys, selected),
          onReplaceSideSelection: (nextSideSelectedKeys: TransferKey[]) =>
            mergeSideSelection('left', nextSideSelectedKeys),
          onMoveItems: moveItems,
          onSearchInput: (value: string) => handleSearchInput('left', value),
          assignSearchInputRef: (element: HTMLInputElement | null) => {
            leftSearchInputRef.current = element ?? undefined
          },
          searchComposingRef: leftSearchComposingRef,
          runManagedRenderCallback: <T,>(runner: () => T) =>
            runManagedRenderCallback('left', runner),
          setCurrentPage: (nextPage: number) => {
            leftPageRef.value = nextPage
          },
        }),
        leftPanelHostRef.current,
      )
    }

    if (operationsHostRef.current) {
      renderManagedTarget('operations', renderOperations(), operationsHostRef.current)
    }

    if (rightPanelHostRef.current) {
      renderManagedTarget(
        'right',
        h(TransferManagedPanel, {
          ...managedPanelSharedProps,
          direction: 'right',
          rawItems: snapshot.targetItems,
          sideSelectedKeys: snapshot.targetSelectedKeys,
          searchValue: rightSearchValueRef.value,
          currentPage: rightPageRef.value,
          paginationPageSize: paginationConfig?.pageSize,
          searchEnabled: searchConfig.enabled,
          sizeConfig,
          mergedLocale,
          title: mergedTitles[1],
          sharedSearchPlaceholder,
          customListRenderer,
          getTransferStateSnapshot,
          onItemSelect: (key: TransferKey, selected: boolean) =>
            handleItemSelect('right', key, selected),
          onItemSelectAll: (keys: TransferKey[], selected: boolean) =>
            handleItemSelectAll('right', keys, selected),
          onReplaceSideSelection: (nextSideSelectedKeys: TransferKey[]) =>
            mergeSideSelection('right', nextSideSelectedKeys),
          onMoveItems: moveItems,
          onSearchInput: (value: string) => handleSearchInput('right', value),
          assignSearchInputRef: (element: HTMLInputElement | null) => {
            rightSearchInputRef.current = element ?? undefined
          },
          searchComposingRef: rightSearchComposingRef,
          runManagedRenderCallback: <T,>(runner: () => T) =>
            runManagedRenderCallback('right', runner),
          setCurrentPage: (nextPage: number) => {
            rightPageRef.value = nextPage
          },
        }),
        rightPanelHostRef.current,
      )
    }

    if (restoreFocusState) {
      const restoreManagedSearchFocus = () => {
        const nextInput =
          restoreFocusState.direction === 'left'
            ? leftSearchInputRef.current
            : rightSearchInputRef.current
        if (!nextInput) {
          return false
        }

        nextInput.focus()
        if (restoreFocusState.selectionStart != null && restoreFocusState.selectionEnd != null) {
          try {
            nextInput.setSelectionRange(
              restoreFocusState.selectionStart,
              restoreFocusState.selectionEnd,
            )
          } catch {
            // Ignore selection restore failures for browsers that do not support it.
          }
        }

        return document.activeElement === nextInput
      }

      queueMicrotask(() => {
        if (restoreManagedSearchFocus()) {
          return
        }

        setTimeout(() => {
          restoreManagedSearchFocus()
        }, 0)
      })
    }
  }

  onMounted(() => {
    renderManagedRegions()
  })

  watch(
    () => [
      normalizedItems.map(item => item.keyText).join('|'),
      uncontrolledTargetKeysRef.value.map(toKeyText).join('|'),
      uncontrolledSelectedKeysRef.value.map(toKeyText).join('|'),
      targetKeys ? uniqKeys(targetKeys).map(toKeyText).join('|') : '',
      selectedKeys ? uniqKeys(selectedKeys).map(toKeyText).join('|') : '',
      leftSearchValueRef.value,
      rightSearchValueRef.value,
      leftPageRef.value,
      rightPageRef.value,
      disabled,
      oneWay,
      showSelectAll,
      paginationConfig?.pageSize ?? 0,
    ],
    () => {
      renderManagedRegions()
    },
  )

  const commitSelectedKeys = (
    nextSelectedKeys: TransferKey[],
    nextTargetKeys = getTransferStateSnapshot().mergedTargetKeys,
  ) => {
    if (activeManagedRenderRef.current) {
      reportManagedRenderMutationError('selection mutation')
      return
    }

    const cleanedKeys = uniqKeys(nextSelectedKeys).filter(key => itemMap.has(toKeyText(key)))
    if (selectedKeys === undefined) {
      uncontrolledSelectedKeysRef.value = cleanedKeys
    }
    emitSelectChange(cleanedKeys, nextTargetKeys)
  }

  const commitTargetKeys = (
    nextTargetKeys: TransferKey[],
    direction: TransferDirection,
    moveKeys: TransferKey[],
    nextSelectedKeys: TransferKey[],
  ) => {
    const cleanedTargetKeys = uniqKeys(nextTargetKeys).filter(key => itemMap.has(toKeyText(key)))
    if (targetKeys === undefined) {
      uncontrolledTargetKeysRef.value = cleanedTargetKeys
    }
    commitSelectedKeys(nextSelectedKeys, cleanedTargetKeys)
    if (onChange) onChange(cleanedTargetKeys, direction, moveKeys)
  }

  const mergeSideSelection = (
    direction: TransferDirection,
    nextSideSelectedKeys: TransferKey[],
  ) => {
    const snapshot = getTransferStateSnapshot()
    const normalizedNextSideSelectedKeys = uniqKeys(nextSideSelectedKeys)
    const nextSelectedKeys =
      direction === 'left'
        ? [...normalizedNextSideSelectedKeys, ...snapshot.targetSelectedKeys]
        : [...snapshot.sourceSelectedKeys, ...normalizedNextSideSelectedKeys]

    commitSelectedKeys(nextSelectedKeys)
  }

  const handleItemSelect = (direction: TransferDirection, key: TransferKey, selected: boolean) => {
    const item = itemMap.get(toKeyText(key))
    if (!item || disabled || item.disabled) return

    const snapshot = getTransferStateSnapshot()
    const currentKeys =
      direction === 'left' ? snapshot.sourceSelectedKeys : snapshot.targetSelectedKeys
    const nextKeys = selected
      ? uniqKeys([...currentKeys, key])
      : currentKeys.filter(current => toKeyText(current) !== toKeyText(key))

    mergeSideSelection(direction, nextKeys)
  }

  const handleItemSelectAll = (
    direction: TransferDirection,
    keys: TransferKey[],
    selected: boolean,
  ) => {
    const snapshot = getTransferStateSnapshot()
    const currentKeys =
      direction === 'left' ? snapshot.sourceSelectedKeys : snapshot.targetSelectedKeys
    const nextKeys = selected ? uniqKeys([...currentKeys, ...keys]) : removeKeys(currentKeys, keys)
    mergeSideSelection(direction, nextKeys)
  }

  const moveItems = (direction: TransferDirection, moveKeys: TransferKey[]) => {
    if (!moveKeys.length) return
    const snapshot = getTransferStateSnapshot()
    if (direction === 'right') {
      const nextTargetKeys = uniqKeys([...snapshot.mergedTargetKeys, ...moveKeys])
      const nextSelectedKeys = removeKeys(snapshot.mergedSelectedKeys, moveKeys)
      commitTargetKeys(nextTargetKeys, 'right', moveKeys, nextSelectedKeys)
      return
    }

    const moveKeySet = new Set(moveKeys.map(toKeyText))
    const nextTargetKeys = snapshot.mergedTargetKeys.filter(key => !moveKeySet.has(toKeyText(key)))
    const nextSelectedKeys = removeKeys(snapshot.mergedSelectedKeys, moveKeys)
    commitTargetKeys(nextTargetKeys, 'left', moveKeys, nextSelectedKeys)
  }

  const moveToRight = () => {
    const snapshot = getTransferStateSnapshot()
    const moveKeys = snapshot.sourceItems
      .filter(item => hasKey(snapshot.sourceSelectedKeys, item.key) && !item.disabled)
      .map(item => item.key)
    moveItems('right', moveKeys)
  }

  const moveToLeft = () => {
    const snapshot = getTransferStateSnapshot()
    const moveKeys = snapshot.targetItems
      .filter(item => hasKey(snapshot.targetSelectedKeys, item.key) && !item.disabled)
      .map(item => item.key)
    moveItems('left', moveKeys)
  }

  const handleSearchInput = (direction: TransferDirection, value: string) => {
    const currentValue = direction === 'left' ? leftSearchValueRef.value : rightSearchValueRef.value
    const currentPage = direction === 'left' ? leftPageRef.value : rightPageRef.value

    if (currentValue === value && currentPage === 1) {
      return
    }

    if (direction === 'left') {
      leftSearchValueRef.value = value
      leftPageRef.value = 1
    } else {
      rightSearchValueRef.value = value
      rightPageRef.value = 1
    }
    if (onSearch) onSearch(direction, value)
  }

  const renderOperationButton = (
    direction: TransferDirection,
    content: any,
    buttonDisabled: boolean,
  ) => {
    const baseClassName = appendClassName(
      `btn btn-outline ${sizeConfig.buttonClass} min-w-24 rounded-2xl shadow-sm`,
      direction === 'right'
        ? 'border-primary/25 hover:border-primary hover:bg-primary/6'
        : 'border-base-300',
    )

    return h(
      'button',
      {
        type: 'button',
        disabled: buttonDisabled,
        className: baseClassName,
        onClick: direction === 'right' ? moveToRight : moveToLeft,
      },
      h(
        'span',
        { className: 'inline-flex items-center gap-2' },
        direction === 'left' && !oneWay ? h(ArrowLeftIcon, null) : null,
        h('span', null, content),
        direction === 'right' ? h(ArrowRightIcon, null) : null,
      ),
    )
  }

  const renderOperations = () => {
    const snapshot = getTransferStateSnapshot()
    const canMoveRight = snapshot.sourceItems.some(
      item => hasKey(snapshot.sourceSelectedKeys, item.key) && !item.disabled,
    )
    const canMoveLeft = snapshot.targetItems.some(
      item => hasKey(snapshot.targetSelectedKeys, item.key) && !item.disabled,
    )

    return h(
      'div',
      {
        className: appendClassName(
          'flex flex-row items-center justify-center gap-2 lg:flex-col',
          classNames?.operations,
        ),
        style: { ...styles?.operations, ...operationStyle },
      },
      renderOperationButton(
        'right',
        mergedActions[0] ?? defaultLocale.selectAll,
        disabled || !canMoveRight,
      ),
      !oneWay
        ? renderOperationButton(
            'left',
            mergedActions[1] ?? defaultLocale.remove,
            disabled || !canMoveLeft,
          )
        : null,
    )
  }

  return h(
    'div',
    {
      ...rest,
      className: appendClassName(
        appendClassName(
          'rue-transfer grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch',
          classNames?.root,
        ),
        className,
      ),
      style: { ...styles?.root, ...style },
      'data-rue-transfer': 'true',
    },
    h('div', { ref: leftPanelHostRef }),
    h('div', { ref: operationsHostRef }),
    h('div', { ref: rightPanelHostRef }),
  )
}

export default Transfer
