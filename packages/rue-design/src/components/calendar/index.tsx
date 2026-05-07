/*
Calendar 组件概述
- 默认导出为 Rue 自己的可控日历面板，支持 month/year 两种视图与受控/非受控状态。
- 保留 Cally 与 Pikaday 的轻量包装作为子组件，兼容原有 demo 与第三方接入方式。
- 视觉层继续使用 Rue 当前的 daisyUI/Tailwind 体系，不引入额外样式文件。
*/
import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'

export type CalendarMode = 'month' | 'year'
export type CalendarSelectSource = 'year' | 'month' | 'date' | 'customize'
export type CalendarValue = Date | string | number
export type CalendarWeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface CalendarSelectInfo {
  source: CalendarSelectSource
}

export interface CalendarCellRenderInfo {
  type: 'date' | 'month'
  originNode: any
  today: Date
  selected: boolean
  isToday: boolean
  inView: boolean
  disabled: boolean
  row: number
  column: number
  week?: number
}

export interface CalendarMonthOption {
  value: number
  label: string
  disabled?: boolean
}

export interface CalendarHeaderRenderConfig {
  value: Date
  type: CalendarMode
  yearOptions: number[]
  monthOptions: CalendarMonthOption[]
  onChange: (date: CalendarValue) => void
  onTypeChange: (mode: CalendarMode) => void
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
}

interface CalendarHostProps {
  className?: string
  children?: any
  [key: string]: any
}

interface CalendarPikaSingleProps extends CalendarHostProps {
  type?: string
}

export interface CalendarProps extends CalendarHostProps {
  value?: CalendarValue
  defaultValue?: CalendarValue
  mode?: CalendarMode
  fullscreen?: boolean
  showWeek?: boolean
  locale?: string
  weekStartsOn?: CalendarWeekStart
  validRange?: [CalendarValue, CalendarValue]
  disabledDate?: (date: Date) => boolean
  dateFullCellRender?: (date: Date) => any
  dateCellRender?: (date: Date) => any
  monthFullCellRender?: (date: Date) => any
  monthCellRender?: (date: Date) => any
  cellRender?: (date: Date, info: CalendarCellRenderInfo) => any
  fullCellRender?: (date: Date, info: CalendarCellRenderInfo) => any
  headerRender?: (config: CalendarHeaderRenderConfig) => any
  onChange?: (date: Date) => void
  onPanelChange?: (date: Date, mode: CalendarMode) => void
  onSelect?: (date: Date, info: CalendarSelectInfo) => void
}

interface CalendarDateCell {
  key: string
  date: Date
  inView: boolean
}

interface CalendarDateRow {
  key: string
  week: number
  cells: CalendarDateCell[]
}

interface CalendarRange {
  start: Date
  end: Date
}

const mergeClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

const clampWeekStart = (value?: number): CalendarWeekStart => {
  if (typeof value === 'number' && value >= 0 && value <= 6) {
    return value as CalendarWeekStart
  }
  return 1
}

const cloneDate = (value: Date) => new Date(value.getTime())

const createDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month, day)
  date.setHours(12, 0, 0, 0)
  return date
}

const startOfDay = (value: Date) => {
  const date = cloneDate(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const startOfMonth = (value: Date) => createDate(value.getFullYear(), value.getMonth(), 1)
const endOfMonth = (value: Date) => createDate(value.getFullYear(), value.getMonth() + 1, 0)
const startOfYear = (value: Date) => createDate(value.getFullYear(), 0, 1)
const endOfYear = (value: Date) => createDate(value.getFullYear(), 11, 31)
const addDays = (value: Date, amount: number) =>
  createDate(value.getFullYear(), value.getMonth(), value.getDate() + amount)

const isValidDate = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime())

const normalizeDate = (value: CalendarValue | undefined, fallback = new Date()) => {
  if (isValidDate(value)) {
    return cloneDate(value)
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (isValidDate(parsed)) {
      return parsed
    }
  }
  return cloneDate(fallback)
}

const normalizeRange = (range?: [CalendarValue, CalendarValue]): CalendarRange | null => {
  if (!range) {
    return null
  }

  const start = startOfDay(normalizeDate(range[0]))
  const end = startOfDay(normalizeDate(range[1]))
  if (start.getTime() <= end.getTime()) {
    return { start, end }
  }

  return { start: end, end: start }
}

const isSameYear = (left: Date, right: Date) => left.getFullYear() === right.getFullYear()
const isSameMonth = (left: Date, right: Date) =>
  isSameYear(left, right) && left.getMonth() === right.getMonth()
const isSameDate = (left: Date, right: Date) =>
  isSameMonth(left, right) && left.getDate() === right.getDate()

const addMonths = (value: Date, amount: number) => {
  const base = createDate(value.getFullYear(), value.getMonth() + amount, 1)
  const maxDay = endOfMonth(base).getDate()
  return createDate(base.getFullYear(), base.getMonth(), Math.min(value.getDate(), maxDay))
}

const addYears = (value: Date, amount: number) => {
  const base = createDate(value.getFullYear() + amount, value.getMonth(), 1)
  const maxDay = endOfMonth(base).getDate()
  return createDate(base.getFullYear(), base.getMonth(), Math.min(value.getDate(), maxDay))
}

const setCalendarYear = (value: Date, year: number) => addYears(value, year - value.getFullYear())
const setCalendarMonth = (value: Date, month: number) => addMonths(value, month - value.getMonth())

const formatDateKey = (value: Date) => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isDateSelectable = (
  value: Date,
  range: CalendarRange | null,
  disabledDate?: (date: Date) => boolean,
) => {
  const date = startOfDay(value)
  if (range) {
    if (date.getTime() < range.start.getTime() || date.getTime() > range.end.getTime()) {
      return false
    }
  }
  return !disabledDate?.(cloneDate(date))
}

const monthHasSelectableDate = (
  value: Date,
  range: CalendarRange | null,
  disabledDate?: (date: Date) => boolean,
) => {
  const start = startOfMonth(value)
  const end = endOfMonth(value)
  if (range) {
    if (end.getTime() < range.start.getTime() || start.getTime() > range.end.getTime()) {
      return false
    }
  }

  let cursor = start
  while (cursor.getTime() <= end.getTime()) {
    if (isDateSelectable(cursor, range, disabledDate)) {
      return true
    }
    cursor = addDays(cursor, 1)
  }
  return false
}

const yearHasSelectableDate = (
  value: Date,
  range: CalendarRange | null,
  disabledDate?: (date: Date) => boolean,
) => {
  const start = startOfYear(value)
  const end = endOfYear(value)
  if (range) {
    if (end.getTime() < range.start.getTime() || start.getTime() > range.end.getTime()) {
      return false
    }
  }

  return Array.from({ length: 12 }, (_, month) => createDate(value.getFullYear(), month, 1)).some(
    date => monthHasSelectableDate(date, range, disabledDate),
  )
}

const getISOWeek = (value: Date) => {
  const date = startOfDay(value)
  const day = (date.getDay() + 6) % 7
  const thursday = addDays(date, 3 - day)
  const firstThursday = createDate(thursday.getFullYear(), 0, 4)
  const firstThursdayDay = (firstThursday.getDay() + 6) % 7
  const firstWeekStart = addDays(firstThursday, -firstThursdayDay)
  return 1 + Math.round((date.getTime() - firstWeekStart.getTime()) / 604800000)
}

const getWeekdayLabels = (locale: string, weekStartsOn: CalendarWeekStart) => {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const anchor = createDate(2026, 2, 1)
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(addDays(anchor, (weekStartsOn + index) % 7)),
  )
}

const getYearOptions = (value: Date, range: CalendarRange | null) => {
  const current = value.getFullYear()
  if (!range) {
    return Array.from({ length: 13 }, (_, index) => current - 6 + index)
  }

  const startYear = range.start.getFullYear()
  const endYear = range.end.getFullYear()
  if (endYear - startYear <= 24) {
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index)
  }

  const start = Math.max(startYear, current - 6)
  const end = Math.min(endYear, current + 6)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

const getMonthOptions = (
  locale: string,
  value: Date,
  range: CalendarRange | null,
  disabledDate?: (date: Date) => boolean,
): CalendarMonthOption[] => {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short' })
  return Array.from({ length: 12 }, (_, month) => {
    const date = createDate(value.getFullYear(), month, 1)
    return {
      value: month,
      label: formatter.format(date),
      disabled: !monthHasSelectableDate(date, range, disabledDate),
    }
  })
}

const getVisibleDateRows = (value: Date, weekStartsOn: CalendarWeekStart): CalendarDateRow[] => {
  const monthStart = startOfMonth(value)
  const offset = (monthStart.getDay() - weekStartsOn + 7) % 7
  const gridStart = addDays(monthStart, -offset)

  return Array.from({ length: 6 }, (_, rowIndex) => {
    const rowStart = addDays(gridStart, rowIndex * 7)
    return {
      key: `${value.getFullYear()}-${value.getMonth()}-${rowIndex}`,
      week: getISOWeek(rowStart),
      cells: Array.from({ length: 7 }, (_, columnIndex) => {
        const date = addDays(rowStart, columnIndex)
        return {
          key: formatDateKey(date),
          date,
          inView: date.getMonth() === value.getMonth(),
        }
      }),
    }
  })
}

const CalendarPanel: FC<CalendarProps> = ({
  value,
  defaultValue,
  mode,
  fullscreen = true,
  showWeek,
  locale,
  weekStartsOn,
  validRange,
  disabledDate,
  dateFullCellRender,
  dateCellRender,
  monthFullCellRender,
  monthCellRender,
  cellRender,
  fullCellRender,
  headerRender,
  className,
  onChange,
  onPanelChange,
  onSelect,
  ...rest
}) => {
  const uncontrolledValue = ref(normalizeDate(value ?? defaultValue ?? new Date()))
  const uncontrolledMode = ref<CalendarMode>(mode ?? 'month')
  const currentValue = value !== undefined ? normalizeDate(value, uncontrolledValue.value) : uncontrolledValue.value
  const currentMode = mode ?? uncontrolledMode.value
  const today = startOfDay(new Date())
  const range = normalizeRange(validRange)
  const resolvedLocale = locale ?? (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN')
  const resolvedWeekStart = clampWeekStart(weekStartsOn)
  const isZhLocale = resolvedLocale.toLowerCase().startsWith('zh')
  const weekdayLabels = getWeekdayLabels(resolvedLocale, resolvedWeekStart)
  const dateRows = getVisibleDateRows(currentValue, resolvedWeekStart)
  const yearOptions = getYearOptions(currentValue, range)
  const monthOptions = getMonthOptions(resolvedLocale, currentValue, range, disabledDate)
  const rootClassName = mergeClassName(
    `overflow-hidden border border-base-300 bg-gradient-to-b from-base-100 via-base-100 to-base-200/70 text-base-content shadow-sm ${fullscreen ? 'rounded-[1.75rem]' : 'max-w-[24rem] rounded-[1.5rem]'}`,
    className,
  )
  const rowClassName = showWeek
    ? 'grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-2'
    : 'grid grid-cols-7 gap-2'
  const headerTitle = currentMode === 'month'
    ? new Intl.DateTimeFormat(resolvedLocale, { year: 'numeric', month: 'long' }).format(currentValue)
    : new Intl.DateTimeFormat(resolvedLocale, { year: 'numeric' }).format(currentValue)
  const todayLabel = new Intl.DateTimeFormat(resolvedLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(today)
  const todayButtonLabel = isZhLocale ? '今天' : 'Today'
  const monthButtonLabel = isZhLocale ? '月' : 'Month'
  const yearButtonLabel = isZhLocale ? '年' : 'Year'
  const weekButtonLabel = isZhLocale ? '周' : 'Week'
  const todayMarkerLabel = isZhLocale ? '今' : 'Today'
  const viewLabel = currentMode === 'month'
    ? isZhLocale
      ? '月视图'
      : 'Month view'
    : isZhLocale
      ? '年视图'
      : 'Year view'
  const previousDisabled = currentMode === 'month'
    ? !monthHasSelectableDate(addMonths(currentValue, -1), range, disabledDate)
    : !yearHasSelectableDate(addYears(currentValue, -1), range, disabledDate)
  const nextDisabled = currentMode === 'month'
    ? !monthHasSelectableDate(addMonths(currentValue, 1), range, disabledDate)
    : !yearHasSelectableDate(addYears(currentValue, 1), range, disabledDate)
  const todayDisabled = !isDateSelectable(today, range, disabledDate)

  const triggerChange = (nextInput: CalendarValue, source: CalendarSelectSource) => {
    const nextDate = startOfDay(normalizeDate(nextInput, currentValue))
    const changed = !isSameDate(nextDate, currentValue)
    const panelChanged = currentMode === 'month'
      ? !isSameMonth(nextDate, currentValue)
      : !isSameYear(nextDate, currentValue)

    if (value === undefined) {
      uncontrolledValue.value = nextDate
    }

    if (changed) {
      onChange?.(cloneDate(nextDate))
    }
    if (panelChanged) {
      onPanelChange?.(cloneDate(nextDate), currentMode)
    }

    onSelect?.(cloneDate(nextDate), { source })
  }

  const triggerModeChange = (nextMode: CalendarMode) => {
    if (nextMode === currentMode) {
      return
    }
    if (mode === undefined) {
      uncontrolledMode.value = nextMode
    }
    onPanelChange?.(cloneDate(currentValue), nextMode)
  }

  const headerConfig: CalendarHeaderRenderConfig = {
    value: cloneDate(currentValue),
    type: currentMode,
    yearOptions,
    monthOptions,
    onChange: nextDate => triggerChange(nextDate, 'customize'),
    onTypeChange: triggerModeChange,
    onYearChange: year => triggerChange(setCalendarYear(currentValue, year), 'customize'),
    onMonthChange: month => triggerChange(setCalendarMonth(currentValue, month), 'customize'),
  }

  const renderDateCell = (row: CalendarDateRow, rowIndex: number, cell: CalendarDateCell, columnIndex: number) => {
    const selected = isSameDate(cell.date, currentValue)
    const isToday = isSameDate(cell.date, today)
    const disabled = !isDateSelectable(cell.date, range, disabledDate)
    const bareNode = (
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-sm font-semibold ${cell.inView ? '' : 'opacity-60'}`}>
            {cell.date.getDate()}
          </span>
          {isToday ? (
            <span
              className={`badge badge-xs ${selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}`}
            >
              {todayMarkerLabel}
            </span>
          ) : null}
        </div>
      </div>
    )
    const content = cellRender?.(cloneDate(cell.date), {
      type: 'date',
      originNode: bareNode,
      today: cloneDate(today),
      selected,
      isToday,
      inView: cell.inView,
      disabled,
      row: rowIndex,
      column: columnIndex,
      week: row.week,
    }) ?? dateCellRender?.(cloneDate(cell.date))
    const originNode = (
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-sm font-semibold ${cell.inView ? '' : 'opacity-60'}`}>
            {cell.date.getDate()}
          </span>
          {isToday ? (
            <span
              className={`badge badge-xs ${selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}`}
            >
              {todayMarkerLabel}
            </span>
          ) : null}
        </div>
        <div className={`min-h-[1.85rem] text-[0.68rem] leading-4 ${selected ? 'opacity-90' : 'opacity-75'}`}>
          {content}
        </div>
      </div>
    )
    const rendered = fullCellRender?.(cloneDate(cell.date), {
      type: 'date',
      originNode,
      today: cloneDate(today),
      selected,
      isToday,
      inView: cell.inView,
      disabled,
      row: rowIndex,
      column: columnIndex,
      week: row.week,
    }) ?? dateFullCellRender?.(cloneDate(cell.date)) ?? originNode

    let buttonClassName = `group relative flex min-h-[5.35rem] w-full flex-col rounded-[1.2rem] border px-2.5 py-2.5 text-left transition duration-150 ${fullscreen ? '' : 'min-h-[4.7rem] rounded-[1rem] px-2 py-2'}`
    if (selected) {
      buttonClassName += ' border-primary bg-primary text-primary-content shadow-md shadow-primary/15'
    } else if (disabled) {
      buttonClassName += ' border-base-300/70 bg-base-200/50 text-base-content/35'
    } else if (cell.inView) {
      buttonClassName += ' border-base-300/80 bg-base-100 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm'
    } else {
      buttonClassName += ' border-base-300/60 bg-base-200/60 text-base-content/55 hover:border-primary/20'
    }
    if (isToday && !selected) {
      buttonClassName += ' ring-1 ring-primary/20'
    }

    return (
      <button
        type="button"
        key={cell.key}
        role="gridcell"
        data-rue-calendar-cell={cell.key}
        data-rue-calendar-in-view={cell.inView ? 'true' : 'false'}
        aria-pressed={selected ? 'true' : 'false'}
        aria-current={isToday ? 'date' : undefined}
        disabled={disabled}
        className={buttonClassName}
        onClick={() => triggerChange(cell.date, 'date')}
      >
        {rendered}
      </button>
    )
  }

  const renderMonthCell = (monthOption: CalendarMonthOption, columnIndex: number) => {
    const monthDate = createDate(currentValue.getFullYear(), monthOption.value, 1)
    const selected = isSameMonth(monthDate, currentValue)
    const isToday = isSameMonth(monthDate, today)
    const disabled = monthOption.disabled === true
    const bareNode = (
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{monthOption.label}</span>
          {isToday ? (
            <span className={`badge badge-xs ${selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}`}>
              {todayMarkerLabel}
            </span>
          ) : null}
        </div>
      </div>
    )
    const content = cellRender?.(cloneDate(monthDate), {
      type: 'month',
      originNode: bareNode,
      today: cloneDate(today),
      selected,
      isToday,
      inView: true,
      disabled,
      row: Math.floor(columnIndex / 4),
      column: columnIndex % 4,
    }) ?? monthCellRender?.(cloneDate(monthDate))
    const originNode = (
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{monthOption.label}</span>
          {isToday ? (
            <span className={`badge badge-xs ${selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}`}>
              {todayMarkerLabel}
            </span>
          ) : null}
        </div>
        <div className={`min-h-[2.1rem] text-xs leading-5 ${selected ? 'opacity-90' : 'opacity-75'}`}>
          {content}
        </div>
      </div>
    )
    const rendered = fullCellRender?.(cloneDate(monthDate), {
      type: 'month',
      originNode,
      today: cloneDate(today),
      selected,
      isToday,
      inView: true,
      disabled,
      row: Math.floor(columnIndex / 4),
      column: columnIndex % 4,
    }) ?? monthFullCellRender?.(cloneDate(monthDate)) ?? originNode

    let buttonClassName = `group relative flex min-h-[6.1rem] w-full flex-col rounded-[1.2rem] border px-3 py-3 text-left transition duration-150 ${fullscreen ? '' : 'min-h-[5.5rem] rounded-[1rem] px-2.5 py-2.5'}`
    if (selected) {
      buttonClassName += ' border-primary bg-primary text-primary-content shadow-md shadow-primary/15'
    } else if (disabled) {
      buttonClassName += ' border-base-300/70 bg-base-200/50 text-base-content/35'
    } else {
      buttonClassName += ' border-base-300/80 bg-base-100 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm'
    }
    if (isToday && !selected) {
      buttonClassName += ' ring-1 ring-primary/20'
    }

    return (
      <button
        type="button"
        key={`${currentValue.getFullYear()}-${monthOption.value}`}
        data-rue-calendar-month={`${currentValue.getFullYear()}-${`${monthOption.value + 1}`.padStart(2, '0')}`}
        aria-pressed={selected ? 'true' : 'false'}
        disabled={disabled}
        className={buttonClassName}
        onClick={() => triggerChange(monthDate, 'month')}
      >
        {rendered}
      </button>
    )
  }

  return (
    <div
      {...rest}
      data-rue-calendar-root="true"
      data-rue-calendar-mode={currentMode}
      className={rootClassName}
    >
      {headerRender ? (
        headerRender(headerConfig)
      ) : (
        <div
          className={`border-b border-base-300/70 ${fullscreen ? 'flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between' : 'flex flex-col gap-3 px-3 py-3'}`}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/55">
              {isZhLocale ? 'Rue Calendar' : 'Rue Calendar'}
            </div>
            <div className="mt-1 text-xl font-semibold leading-tight">{headerTitle}</div>
            <div className="mt-1 text-xs text-base-content/60">{todayLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div className="join">
              <button
                type="button"
                className="btn btn-sm join-item"
                aria-label={isZhLocale ? '上一页' : 'Previous'}
                disabled={previousDisabled}
                onClick={() =>
                  triggerChange(
                    currentMode === 'month' ? addMonths(currentValue, -1) : addYears(currentValue, -1),
                    'customize',
                  )
                }
              >
                <span aria-hidden="true">&lt;</span>
              </button>
              <button
                type="button"
                className="btn btn-sm join-item btn-ghost"
                disabled={todayDisabled}
                onClick={() => triggerChange(today, 'customize')}
              >
                {todayButtonLabel}
              </button>
              <button
                type="button"
                className="btn btn-sm join-item"
                aria-label={isZhLocale ? '下一页' : 'Next'}
                disabled={nextDisabled}
                onClick={() =>
                  triggerChange(
                    currentMode === 'month' ? addMonths(currentValue, 1) : addYears(currentValue, 1),
                    'customize',
                  )
                }
              >
                <span aria-hidden="true">&gt;</span>
              </button>
            </div>
            <select
              className="select select-sm min-w-24"
              value={currentValue.getFullYear()}
              onChange={event =>
                headerConfig.onYearChange(Number((event.currentTarget as HTMLSelectElement).value))
              }
            >
              {yearOptions.map(year => (
                <option
                  key={year}
                  value={year}
                  disabled={!yearHasSelectableDate(createDate(year, currentValue.getMonth(), 1), range, disabledDate)}
                >
                  {year}
                </option>
              ))}
            </select>
            <select
              className="select select-sm min-w-24"
              value={currentValue.getMonth()}
              disabled={currentMode === 'year'}
              onChange={event =>
                headerConfig.onMonthChange(Number((event.currentTarget as HTMLSelectElement).value))
              }
            >
              {monthOptions.map(option => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="join">
              <button
                type="button"
                className={`btn btn-sm join-item ${currentMode === 'month' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => triggerModeChange('month')}
              >
                {monthButtonLabel}
              </button>
              <button
                type="button"
                className={`btn btn-sm join-item ${currentMode === 'year' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => triggerModeChange('year')}
              >
                {yearButtonLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={fullscreen ? 'space-y-3 px-4 py-4' : 'space-y-3 px-3 py-3'}>
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="badge badge-outline badge-sm">{viewLabel}</div>
          {showWeek && currentMode === 'month' ? (
            <div className="badge badge-soft badge-sm">{weekButtonLabel}</div>
          ) : null}
        </div>

        {currentMode === 'month' ? (
          <div className="space-y-2">
            <div className={rowClassName}>
              {showWeek ? (
                <div className="px-2 py-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-base-content/45">
                  {weekButtonLabel}
                </div>
              ) : null}
              {weekdayLabels.map(label => (
                <div
                  key={label}
                  className="px-2 py-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-base-content/45"
                >
                  {label}
                </div>
              ))}
            </div>

            <div role="grid" className="space-y-2">
              {dateRows.map((row, rowIndex) => (
                <div key={row.key} role="row" className={rowClassName}>
                  {showWeek ? (
                    <div
                      className="flex items-center justify-center rounded-[1rem] border border-base-300/70 bg-base-200/60 text-sm font-semibold text-base-content/60"
                      data-rue-calendar-week={row.week}
                    >
                      {row.week}
                    </div>
                  ) : null}
                  {row.cells.map((cell, columnIndex) => renderDateCell(row, rowIndex, cell, columnIndex))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {monthOptions.map((monthOption, index) => renderMonthCell(monthOption, index))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Cally web component 容器 */
const Cally: FC<CalendarHostProps> = ({ className, children, ...rest }) => {
  return (
    <calendar-date {...rest} className={mergeClassName('cally', className)}>
      {children}
    </calendar-date>
  )
}

/** Cally 的月份节点 */
const Month: FC<CalendarHostProps> = ({ className, children, ...rest }) => {
  return (
    <calendar-month {...rest} className={className}>
      {children}
    </calendar-month>
  )
}

/** Pikaday 输入框样式包装 */
const PikaSingle: FC<CalendarPikaSingleProps> = ({ type = 'text', className, ...rest }) => {
  return <input {...rest} type={type} className={mergeClassName('pika-single', className)} />
}

type CalendarCompound = FC<CalendarProps> & {
  Cally: FC<CalendarHostProps>
  Month: FC<CalendarHostProps>
  PikaSingle: FC<CalendarPikaSingleProps>
}

const CalendarCompound: CalendarCompound = Object.assign(CalendarPanel, {
  Cally,
  Month,
  PikaSingle,
})

export default CalendarCompound