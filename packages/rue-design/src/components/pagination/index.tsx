/*
Pagination 组件概述
- 保留 Rue 当前基于 join + btn 的视觉风格，同时补齐更接近成熟组件库的分页能力。
- 同时支持静态组合模式（`Pagination.Item`）与数据驱动模式（`total/current/pageSize`）。
*/
import type { FC } from '@rue-js/rue'
import { ref, useRef } from '@rue-js/rue'

export type PaginationDirection = 'horizontal' | 'vertical'
export type PaginationAlign = 'start' | 'center' | 'end'
export type PaginationSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'large'
export type PaginationItemType = 'page' | 'prev' | 'next' | 'jump-prev' | 'jump-next'

export interface PaginationSimpleConfig {
  readOnly?: boolean
}

export interface PaginationLocale {
  prev?: any
  next?: any
  jumpPrev?: any
  jumpNext?: any
  pageSuffix?: any
  itemsPerPage?: any
  pageTitle?: (page: number) => string
  jumpTo?: any
  previousPage?: any
  nextPage?: any
  jumpPrevTitle?: any
  jumpNextTitle?: any
}

export type PaginationItemRender = (page: number, type: PaginationItemType, originalElement: any) => any
export type PaginationShowTotal = (total: number, range: [number, number]) => any

export interface PaginationProps {
  direction?: PaginationDirection
  align?: PaginationAlign
  size?: PaginationSize
  className?: string
  children?: any
  current?: number
  defaultCurrent?: number
  total?: number
  pageSize?: number
  defaultPageSize?: number
  disabled?: boolean
  simple?: boolean | PaginationSimpleConfig
  showSizeChanger?: boolean
  pageSizeOptions?: Array<number | string>
  showQuickJumper?: boolean | { goButton?: any }
  showLessItems?: boolean
  hideOnSinglePage?: boolean
  showTitle?: boolean
  showTotal?: PaginationShowTotal
  itemRender?: PaginationItemRender
  onChange?: (page: number, pageSize: number) => void
  onShowSizeChange?: (current: number, pageSize: number) => void
  locale?: PaginationLocale
  [key: string]: any
}

export interface PaginationItemProps {
  tag?: any
  active?: boolean
  disabled?: boolean
  size?: PaginationSize
  className?: string
  children?: any
  [key: string]: any
}

interface PaginationDisplayItem {
  type: PaginationItemType
  page: number
  label: any
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const appendClassName = (...values: Array<string | undefined | false>) => {
  return values.filter(Boolean).join(' ')
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max)
}

const normalizePositiveInt = (value: any, fallback: number) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.floor(numeric)
}

const resolveSizeToken = (size?: PaginationSize) => {
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

const resolveAlignClassName = (align?: PaginationAlign) => {
  switch (align) {
    case 'center':
      return 'justify-center'
    case 'end':
      return 'justify-end'
    default:
      return 'justify-start'
  }
}

const buildJoinClassName = (direction?: PaginationDirection) => {
  let cls = 'join'
  if (direction) cls += ` join-${direction}`
  return cls
}

const buildButtonClassName = (size?: PaginationSize, active?: boolean, disabled?: boolean, className?: string) => {
  const resolvedSize = resolveSizeToken(size)
  let cls = 'join-item btn'
  if (resolvedSize) cls += ` btn-${resolvedSize}`
  if (active) cls += ' btn-active'
  if (disabled) cls += ' btn-disabled'
  if (className) cls += ` ${className}`
  return cls
}

const buildSelectClassName = (size?: PaginationSize, className?: string) => {
  const resolvedSize = resolveSizeToken(size)
  let cls = 'select select-bordered'
  if (resolvedSize) cls += ` select-${resolvedSize}`
  if (className) cls += ` ${className}`
  return cls
}

const buildInputClassName = (size?: PaginationSize, className?: string) => {
  const resolvedSize = resolveSizeToken(size)
  let cls = 'input input-bordered'
  if (resolvedSize) cls += ` input-${resolvedSize}`
  if (className) cls += ` ${className}`
  return cls
}

const buildNumberInputClassName = (size?: PaginationSize, className?: string) => {
  return appendClassName(
    buildInputClassName(size),
    'appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
    className,
  )
}

const resolveNumberInputWidthClass = (pageCount: number, mode: 'simple' | 'quick') => {
  const digits = String(Math.max(1, pageCount)).length

  if (mode === 'simple') {
    if (digits <= 2) return 'w-10'
    if (digits === 3) return 'w-12'
    return 'w-14'
  }

  if (digits <= 2) return 'w-14'
  if (digits === 3) return 'w-16'
  return 'w-20'
}

const resolvePageSizeSelectWidthClass = (options: Array<number | string>) => {
  const maxDigits = options.reduce((result, option) => {
    return Math.max(result, String(option).length)
  }, 2)

  if (maxDigits <= 2) return 'w-16'
  if (maxDigits === 3) return 'w-18'
  return 'w-20'
}

const isDataMode = (props: PaginationProps) => {
  return (
    props.current !== undefined ||
    props.defaultCurrent !== undefined ||
    props.total !== undefined ||
    props.pageSize !== undefined ||
    props.defaultPageSize !== undefined ||
    props.simple !== undefined ||
    props.showSizeChanger !== undefined ||
    props.showQuickJumper !== undefined ||
    props.showLessItems !== undefined ||
    props.hideOnSinglePage !== undefined ||
    props.showTotal !== undefined ||
    props.itemRender !== undefined ||
    props.align !== undefined ||
    props.size !== undefined ||
    props.disabled !== undefined ||
    props.onChange !== undefined ||
    props.onShowSizeChange !== undefined ||
    props.pageSizeOptions !== undefined ||
    props.locale !== undefined
  )
}

const getRange = (current: number, pageSize: number, total: number): [number, number] => {
  if (total <= 0) return [0, 0]
  const start = (current - 1) * pageSize + 1
  const end = Math.min(total, current * pageSize)
  return [start, end]
}

const getDisplayItems = (current: number, pageCount: number, showLessItems?: boolean): PaginationDisplayItem[] => {
  if (pageCount <= 0) return []

  const items: PaginationDisplayItem[] = []
  const pageBuffer = showLessItems ? 1 : 2
  const jumpStep = showLessItems ? 3 : 5

  if (pageCount <= 5 + pageBuffer * 2) {
    for (let page = 1; page <= pageCount; page += 1) {
      items.push({ type: 'page', page, label: String(page) })
    }
    return items
  }

  const left = Math.max(1, current - pageBuffer)
  const right = Math.min(pageCount, current + pageBuffer)

  items.push({ type: 'page', page: 1, label: '1' })

  if (left > 2) {
    items.push({
      type: 'jump-prev',
      page: Math.max(1, current - jumpStep),
      label: '•••',
    })
  } else {
    for (let page = 2; page < left; page += 1) {
      items.push({ type: 'page', page, label: String(page) })
    }
  }

  for (let page = Math.max(2, left); page <= Math.min(pageCount - 1, right); page += 1) {
    items.push({ type: 'page', page, label: String(page) })
  }

  if (right < pageCount - 1) {
    items.push({
      type: 'jump-next',
      page: Math.min(pageCount, current + jumpStep),
      label: '•••',
    })
  } else {
    for (let page = right + 1; page < pageCount; page += 1) {
      items.push({ type: 'page', page, label: String(page) })
    }
  }

  items.push({ type: 'page', page: pageCount, label: String(pageCount) })
  return items
}

const Item: FC<PaginationItemProps> = ({
  tag = 'button',
  active,
  disabled,
  size,
  className,
  children,
  ...rest
}) => {
  const Tag = tag as any
  const props: Record<string, any> = {
    ...rest,
    className: buildButtonClassName(size, active, disabled, className),
  }

  if (active) {
    props['aria-current'] = rest['aria-current'] ?? 'page'
  }

  if (disabled) {
    props['aria-disabled'] = rest['aria-disabled'] ?? true
    if (tag === 'button' || tag === 'input') {
      props.disabled = rest.disabled ?? true
    } else {
      props.role = rest.role ?? 'button'
      props.tabIndex = rest.tabIndex ?? -1
    }
  }

  return <Tag {...props}>{children}</Tag>
}

const Root: FC<PaginationProps> = ({
  direction,
  align,
  size,
  className,
  children,
  current,
  defaultCurrent,
  total,
  pageSize,
  defaultPageSize,
  disabled,
  simple,
  showSizeChanger,
  pageSizeOptions,
  showQuickJumper,
  showLessItems,
  hideOnSinglePage,
  showTitle = true,
  showTotal,
  itemRender,
  onChange,
  onShowSizeChange,
  locale,
  ...rest
}) => {
  if (!isDataMode({ direction, align, size, className, children, current, defaultCurrent, total, pageSize, defaultPageSize, disabled, simple, showSizeChanger, pageSizeOptions, showQuickJumper, showLessItems, hideOnSinglePage, showTotal, itemRender, onChange, onShowSizeChange, locale })) {
    return (
      <div {...rest} className={mergeClassName(buildJoinClassName(direction), className)}>
        {children}
      </div>
    )
  }

  const uncontrolledCurrent = ref(normalizePositiveInt(defaultCurrent ?? current ?? 1, 1))
  const uncontrolledPageSize = ref(normalizePositiveInt(defaultPageSize ?? pageSize ?? 10, 10))
  const mergedPageSize = normalizePositiveInt(pageSize ?? uncontrolledPageSize.value, 10)
  const normalizedTotal = Math.max(0, Number(total) || 0)
  const pageCount = Math.max(1, Math.ceil(normalizedTotal / mergedPageSize))
  const mergedCurrent = clamp(normalizePositiveInt(current ?? uncontrolledCurrent.value, 1), 1, pageCount)
  const totalRange = getRange(mergedCurrent, mergedPageSize, normalizedTotal)
  const sizeOptions =
    pageSizeOptions && pageSizeOptions.length > 0
      ? pageSizeOptions.map(option => normalizePositiveInt(option, mergedPageSize))
      : [10, 20, 50, 100]
  const simpleConfig = typeof simple === 'object' ? simple : simple ? {} : undefined
  const quickJumperConfig =
    typeof showQuickJumper === 'object' && showQuickJumper ? showQuickJumper : showQuickJumper ? {} : undefined
  const pagerItems = getDisplayItems(mergedCurrent, pageCount, showLessItems)
  const inputDraftRef = useRef<{
    page: number
    simple: string
    quick: string
  }>()
  if (!inputDraftRef.current) {
    const initialValue = String(mergedCurrent)
    inputDraftRef.current = {
      page: mergedCurrent,
      simple: initialValue,
      quick: initialValue,
    }
  } else if (inputDraftRef.current.page !== mergedCurrent) {
    const syncedValue = String(mergedCurrent)
    inputDraftRef.current.page = mergedCurrent
    inputDraftRef.current.simple = syncedValue
    inputDraftRef.current.quick = syncedValue
  }

  const inputDraft = inputDraftRef.current
  const labels: Required<PaginationLocale> = {
    prev: locale?.prev ?? '‹',
    next: locale?.next ?? '›',
    jumpPrev: locale?.jumpPrev ?? '•••',
    jumpNext: locale?.jumpNext ?? '•••',
    pageSuffix: locale?.pageSuffix ?? '/ page',
    itemsPerPage: locale?.itemsPerPage ?? 'items / page',
    pageTitle: locale?.pageTitle ?? (page => `Page ${page}`),
    jumpTo: locale?.jumpTo ?? 'Go to',
    previousPage: locale?.previousPage ?? 'Previous Page',
    nextPage: locale?.nextPage ?? 'Next Page',
    jumpPrevTitle: locale?.jumpPrevTitle ?? 'Jump Previous Pages',
    jumpNextTitle: locale?.jumpNextTitle ?? 'Jump Next Pages',
  }

  if (hideOnSinglePage && pageCount <= 1) {
    return null
  }

  const updatePage = (nextPage: number, nextPageSize = mergedPageSize) => {
    const normalizedPageCount = Math.max(1, Math.ceil(normalizedTotal / nextPageSize))
    const resolvedNextPage = clamp(normalizePositiveInt(nextPage, 1), 1, normalizedPageCount)

    if (current === undefined) {
      uncontrolledCurrent.value = resolvedNextPage
    }
    if (pageSize === undefined && nextPageSize !== mergedPageSize) {
      uncontrolledPageSize.value = nextPageSize
    }
    if (onChange) {
      onChange(resolvedNextPage, nextPageSize)
    }
  }

  const updatePageSize = (nextPageSize: number) => {
    const normalizedNextPageSize = normalizePositiveInt(nextPageSize, mergedPageSize)
    const nextPageCount = Math.max(1, Math.ceil(normalizedTotal / normalizedNextPageSize))
    const nextCurrent = clamp(mergedCurrent, 1, nextPageCount)

    if (pageSize === undefined) {
      uncontrolledPageSize.value = normalizedNextPageSize
    }
    if (current === undefined) {
      uncontrolledCurrent.value = nextCurrent
    }
    if (onShowSizeChange) {
      onShowSizeChange(nextCurrent, normalizedNextPageSize)
    }
    if (onChange) {
      onChange(nextCurrent, normalizedNextPageSize)
    }
  }

  const renderItem = (
    page: number,
    type: PaginationItemType,
    label: any,
    options?: {
      active?: boolean
      disabled?: boolean
      title?: string
    },
  ) => {
    const renderedDisabled = !!disabled || !!options?.disabled
    const fallbackContent = label
    const renderedContent = itemRender ? itemRender(page, type, fallbackContent) : fallbackContent
    return (
      <Pagination.Item
        size={size}
        active={options?.active}
        disabled={renderedDisabled}
        aria-label={type === 'page' ? labels.pageTitle(page) : undefined}
        title={showTitle ? options?.title ?? (type === 'page' ? labels.pageTitle(page) : undefined) : undefined}
        onClick={() => {
          if (renderedDisabled || options?.active) return
          updatePage(page)
        }}
      >
        {renderedContent}
      </Pagination.Item>
    )
  }

  const pagerNode = simpleConfig ? (
    <div className={buildJoinClassName()}>
      {renderItem(
        Math.max(1, mergedCurrent - 1),
        'prev',
        labels.prev,
        {
          disabled: mergedCurrent <= 1,
          title: labels.previousPage,
        },
      )}
      <div className={buildInputClassName(size, 'join-item inline-flex shrink-0 items-center gap-1 px-2 text-sm')}>
        {simpleConfig.readOnly ? (
          <span className="tabular-nums">{mergedCurrent}</span>
        ) : (
          <input
            key={`simple-${mergedCurrent}-${pageCount}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min="1"
            max={String(pageCount)}
            value={inputDraft.simple}
            disabled={disabled}
            className={appendClassName(
              'border-0 bg-transparent p-0 text-right outline-none appearance-none [appearance:textfield] tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
              resolveNumberInputWidthClass(pageCount, 'simple'),
            )}
            onInput={event => {
              inputDraft.simple = (event.currentTarget as HTMLInputElement).value
            }}
            onKeyDown={event => {
              if ((event as KeyboardEvent).key !== 'Enter') return
              const target = event.currentTarget as HTMLInputElement
              updatePage(Number(target.value))
            }}
            onBlur={event => {
              if (disabled) return
              const target = event.currentTarget as HTMLInputElement
              if (target.value === '') {
                target.value = String(mergedCurrent)
                inputDraft.simple = target.value
                return
              }
              updatePage(Number(target.value))
            }}
          />
        )}
        <span className="inline-flex items-center opacity-60">
          {labels.pageSuffix === '/ page' ? `/ ${pageCount}` : `${labels.pageSuffix} ${pageCount}`}
        </span>
      </div>
      {renderItem(
        Math.min(pageCount, mergedCurrent + 1),
        'next',
        labels.next,
        {
          disabled: mergedCurrent >= pageCount,
          title: labels.nextPage,
        },
      )}
    </div>
  ) : (
    <div className={buildJoinClassName(direction)}>
      {renderItem(
        Math.max(1, mergedCurrent - 1),
        'prev',
        labels.prev,
        {
          disabled: mergedCurrent <= 1,
          title: labels.previousPage,
        },
      )}
      {pagerItems.map(item => {
        const label =
          item.type === 'jump-prev'
            ? labels.jumpPrev
            : item.type === 'jump-next'
              ? labels.jumpNext
              : item.label

        return renderItem(item.page, item.type, label, {
          active: item.type === 'page' && item.page === mergedCurrent,
          disabled: item.type !== 'page' ? !!disabled : false,
          title:
            item.type === 'page'
              ? labels.pageTitle(item.page)
              : item.type === 'jump-prev'
                ? labels.jumpPrevTitle
                : labels.jumpNextTitle,
        })
      })}
      {renderItem(
        Math.min(pageCount, mergedCurrent + 1),
        'next',
        labels.next,
        {
          disabled: mergedCurrent >= pageCount,
          title: labels.nextPage,
        },
      )}
    </div>
  )

  return (
    <div
      {...rest}
      className={appendClassName(
        'flex flex-wrap items-center gap-3',
        resolveAlignClassName(align),
        className,
      )}
    >
      {showTotal ? (
        <div className="text-sm opacity-70" aria-live="polite">
          {showTotal(normalizedTotal, totalRange)}
        </div>
      ) : null}
      {pagerNode}
      {showSizeChanger ? (
        <label className="flex items-center gap-2 text-sm opacity-80">
          <select
            value={String(mergedPageSize)}
            disabled={disabled}
            className={buildSelectClassName(
              size,
              `${resolvePageSizeSelectWidthClass(sizeOptions)} text-center tabular-nums`,
            )}
            onChange={event => updatePageSize(Number((event.target as HTMLSelectElement).value))}
          >
            {sizeOptions.map(option => (
              <option key={option} value={String(option)}>
                {option}
              </option>
            ))}
          </select>
          <span>{labels.itemsPerPage}</span>
        </label>
      ) : null}
      {quickJumperConfig ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="opacity-70">{labels.jumpTo}</span>
          <input
            key={`quick-${mergedCurrent}-${pageCount}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min="1"
            max={String(pageCount)}
            value={inputDraft.quick}
            disabled={disabled}
            className={buildNumberInputClassName(
              size,
              `${resolveNumberInputWidthClass(pageCount, 'quick')} text-center tabular-nums`,
            )}
            onInput={event => {
              inputDraft.quick = (event.currentTarget as HTMLInputElement).value
            }}
            onKeyDown={event => {
              if ((event as KeyboardEvent).key !== 'Enter') return
              const target = event.currentTarget as HTMLInputElement
              updatePage(Number(target.value))
            }}
          />
          {quickJumperConfig.goButton != null ? (
            <button
              type="button"
              disabled={disabled}
              className={appendClassName('btn', resolveSizeToken(size) ? `btn-${resolveSizeToken(size)}` : undefined)}
              onClick={event => {
                const wrapper = (event.currentTarget as HTMLButtonElement).parentElement
                const input = wrapper?.querySelector('input') as HTMLInputElement | null
                if (!input) return
                updatePage(Number(input.value))
              }}
            >
              {quickJumperConfig.goButton}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

type PaginationCompound = FC<PaginationProps> & {
  Item: FC<PaginationItemProps>
}

const Pagination: PaginationCompound = Object.assign(Root, {
  Item,
})

export default Pagination
