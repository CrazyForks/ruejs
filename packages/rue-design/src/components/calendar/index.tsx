/*
Calendar 组件概述
- 默认导出为 Rue 自己的可控日历面板，支持 month/year 两种视图与受控/非受控状态。
- 保留 Cally 与 Pikaday 的轻量包装作为子组件，兼容原有 demo 与第三方接入方式。
- 视觉层继续使用 Rue 当前的 daisyUI/Tailwind 体系，不引入额外样式文件。
*/
import type { FC } from '@rue-js/rue'
import { onUnmounted, ref, renderAnchor, useRef, useSetup, vapor } from '@rue-js/rue'
import { _$vaporMarkComponentRenderReactive } from '@rue-js/rue/vapor'

/** CalendarMode 类型。 */
export type CalendarMode = 'month' | 'year'
/** CalendarSelectSource 类型。 */
export type CalendarSelectSource = 'year' | 'month' | 'date' | 'customize'
/** CalendarValue 值类型。 */
export type CalendarValue = Date | string | number
/** CalendarWeekStart 类型。 */
export type CalendarWeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** CalendarSelectInfo 接口。 */
export interface CalendarSelectInfo {
  /** source 配置项。 */
  source: CalendarSelectSource
}

/** CalendarCellRenderInfo 接口。 */
export interface CalendarCellRenderInfo {
  /** 组件类型或语义类型。 */
  type: 'date' | 'month'
  /** originNode 配置项。 */
  originNode: any
  /** today 配置项。 */
  today: Date
  /** selected 配置项。 */
  selected: boolean
  /** isToday 配置项。 */
  isToday: boolean
  /** inView 配置项。 */
  inView: boolean
  /** 是否禁用交互。 */
  disabled: boolean
  /** row 配置项。 */
  row: number
  /** column 配置项。 */
  column: number
  /** week 配置项。 */
  week?: number
}

/** CalendarMonthOption 选项配置。 */
export interface CalendarMonthOption {
  /** 受控值。 */
  value: number
  /** 展示标签。 */
  label: string
  /** 是否禁用交互。 */
  disabled?: boolean
}

/** CalendarHeaderRenderConfig 配置对象。 */
export interface CalendarHeaderRenderConfig {
  /** 受控值。 */
  value: Date
  /** 组件类型或语义类型。 */
  type: CalendarMode
  /** yearOptions 选项配置。 */
  yearOptions: number[]
  /** monthOptions 选项配置。 */
  monthOptions: CalendarMonthOption[]
  /** 值或状态变化时触发的回调。 */
  onChange: (date: CalendarValue) => void
  /** onTypeChange 事件回调。 */
  onTypeChange: (mode: CalendarMode) => void
  /** onYearChange 事件回调。 */
  onYearChange: (year: number) => void
  /** onMonthChange 事件回调。 */
  onMonthChange: (month: number) => void
}

/** CalendarRenderProfileCell 接口。 */
export interface CalendarRenderProfileCell {
  /** 单元格类型。 */
  type: 'date' | 'month'
  /** 单元格 key。 */
  key: string
  /** 自定义渲染函数名称。 */
  renderName: string
  /** 单次自定义渲染耗时，单位 ms。 */
  duration: number
  /** 行索引。 */
  row: number
  /** 列索引。 */
  column: number
}

/** CalendarRenderProfileEvent 接口。 */
export interface CalendarRenderProfileEvent {
  /** 组件名称。 */
  component: 'Calendar'
  /** 当前视图模式。 */
  mode: CalendarMode
  /** 本次更新阶段。 */
  phase: 'html' | 'patch' | 'jsx'
  /** 总耗时，单位 ms。 */
  duration: number
  /** 本次参与更新的单元格数量。 */
  cellCount: number
  /** 自定义渲染函数总调用次数。 */
  customRenderCount: number
  /** cellRender 调用次数。 */
  cellRenderCount: number
  /** fullCellRender 调用次数。 */
  fullCellRenderCount: number
  /** dateCellRender 调用次数。 */
  dateCellRenderCount: number
  /** dateFullCellRender 调用次数。 */
  dateFullCellRenderCount: number
  /** monthCellRender 调用次数。 */
  monthCellRenderCount: number
  /** monthFullCellRender 调用次数。 */
  monthFullCellRenderCount: number
  /** 是否超过阈值。 */
  slow: boolean
  /** 慢渲染阈值，单位 ms。 */
  threshold: number
  /** 超过阈值的单元格。 */
  slowCells: CalendarRenderProfileCell[]
}

interface CalendarHostProps {
  className?: string
  children?: any
  [key: string]: any
}

interface CalendarPikaSingleProps extends CalendarHostProps {
  type?: string
}

/** CalendarProps 组件属性。 */
export interface CalendarProps extends CalendarHostProps {
  /** 受控值。 */
  value?: CalendarValue
  /** 非受控初始值。 */
  defaultValue?: CalendarValue
  /** mode 配置项。 */
  mode?: CalendarMode
  /** fullscreen 配置项。 */
  fullscreen?: boolean
  /** showWeek 配置项。 */
  showWeek?: boolean
  /** locale 配置项。 */
  locale?: string
  /** weekStartsOn 配置项。 */
  weekStartsOn?: CalendarWeekStart
  /** validRange 配置项。 */
  validRange?: [CalendarValue, CalendarValue]
  /** disabledDate 配置项。 */
  disabledDate?: (date: Date) => boolean
  /** dateFullCellRender 自定义渲染函数。 */
  dateFullCellRender?: (date: Date) => any
  /** dateCellRender 自定义渲染函数。 */
  dateCellRender?: (date: Date) => any
  /** monthFullCellRender 自定义渲染函数。 */
  monthFullCellRender?: (date: Date) => any
  /** monthCellRender 自定义渲染函数。 */
  monthCellRender?: (date: Date) => any
  /** cellRender 自定义渲染函数。 */
  cellRender?: (date: Date, info: CalendarCellRenderInfo) => any
  /** fullCellRender 自定义渲染函数。 */
  fullCellRender?: (date: Date, info: CalendarCellRenderInfo) => any
  /** headerRender 自定义渲染函数。 */
  headerRender?: (config: CalendarHeaderRenderConfig) => any
  /** Calendar 渲染诊断回调，可用于定位 cellRender 或面板更新耗时。 */
  onRenderProfile?: (event: CalendarRenderProfileEvent) => void
  /** onRenderProfile 的慢渲染阈值，单位 ms。 */
  renderProfileThreshold?: number
  /** 值或状态变化时触发的回调。 */
  onChange?: (date: Date) => void
  /** onPanelChange 事件回调。 */
  onPanelChange?: (date: Date, mode: CalendarMode) => void
  /** 选中项时触发的回调。 */
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

interface CalendarSelectabilityCaches {
  date: Map<string, boolean>
  month: Map<string, boolean>
  year: Map<string, boolean>
}

interface DefaultDateCellState {
  key: string
  dayNumber: number
  inView: boolean
  selected: boolean
  isToday: boolean
  disabled: boolean
}

interface ManagedCalendarCellContent {
  key: string
  type: 'date' | 'month'
  content: any
}

interface ManagedCalendarMount {
  host: HTMLElement
  anchor: Comment
}

interface CalendarRenderProfileState {
  enabled: boolean
  start: number
  threshold: number
  cellCount: number
  customRenderCount: number
  cellRenderCount: number
  fullCellRenderCount: number
  dateCellRenderCount: number
  dateFullCellRenderCount: number
  monthCellRenderCount: number
  monthFullCellRenderCount: number
  slowCells: CalendarRenderProfileCell[]
}

interface OptimizedCalendarYearOption {
  value: number
  disabled: boolean
}

interface OptimizedDefaultCalendarSnapshot {
  rest: Record<string, any>
  rootClassName: string
  fullscreen: boolean
  hasCustomHeader: boolean
  customHeaderContent: any
  currentMode: CalendarMode
  currentValue: Date
  headerTitle: string
  todayLabel: string
  previousDisabled: boolean
  nextDisabled: boolean
  todayDisabled: boolean
  yearOptions: OptimizedCalendarYearOption[]
  monthOptions: CalendarMonthOption[]
  weekdayLabels: string[]
  dateRows: CalendarDateRow[]
  rowClassName: string
  showWeek?: boolean
  viewLabel: string
  weekButtonLabel: string
  todayButtonLabel: string
  monthButtonLabel: string
  yearButtonLabel: string
  todayMarkerLabel: string
  dateCellStates: Map<string, DefaultDateCellState>
  managedCellContent: Map<string, ManagedCalendarCellContent>
  hasDateCustomRender: boolean
  hasMonthCustomRender: boolean
  onPrevious: () => void
  onToday: () => void
  onNext: () => void
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  onModeMonth: () => void
  onModeYear: () => void
  onDateSelect: (date: Date) => void
  onMonthSelect: (date: Date) => void
}

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

/** 创建 Selectability Caches 的内部工具函数。 */
const createSelectabilityCaches = (): CalendarSelectabilityCaches => ({
  date: new Map(),
  month: new Map(),
  year: new Map(),
})

const weekdayLabelCache = new Map<string, string[]>()
const monthLabelCache = new Map<string, string[]>()
const monthYearFormatterCache = new Map<string, Intl.DateTimeFormat>()
const yearFormatterCache = new Map<string, Intl.DateTimeFormat>()
const todayFormatterCache = new Map<string, Intl.DateTimeFormat>()

const getCalendarNow = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

const createCalendarRenderProfileState = (
  enabled: boolean,
  threshold: number,
): CalendarRenderProfileState => ({
  enabled,
  start: enabled ? getCalendarNow() : 0,
  threshold,
  cellCount: 0,
  customRenderCount: 0,
  cellRenderCount: 0,
  fullCellRenderCount: 0,
  dateCellRenderCount: 0,
  dateFullCellRenderCount: 0,
  monthCellRenderCount: 0,
  monthFullCellRenderCount: 0,
  slowCells: [],
})

const countCalendarRender = (
  profile: CalendarRenderProfileState,
  renderName:
    | 'cellRender'
    | 'fullCellRender'
    | 'dateCellRender'
    | 'dateFullCellRender'
    | 'monthCellRender'
    | 'monthFullCellRender',
) => {
  if (!profile.enabled) {
    return
  }

  profile.customRenderCount += 1
  if (renderName === 'cellRender') {
    profile.cellRenderCount += 1
  } else if (renderName === 'fullCellRender') {
    profile.fullCellRenderCount += 1
  } else if (renderName === 'dateCellRender') {
    profile.dateCellRenderCount += 1
  } else if (renderName === 'dateFullCellRender') {
    profile.dateFullCellRenderCount += 1
  } else if (renderName === 'monthCellRender') {
    profile.monthCellRenderCount += 1
  } else {
    profile.monthFullCellRenderCount += 1
  }
}

const invokeCalendarRender = <T,>(
  profile: CalendarRenderProfileState,
  renderName:
    | 'cellRender'
    | 'fullCellRender'
    | 'dateCellRender'
    | 'dateFullCellRender'
    | 'monthCellRender'
    | 'monthFullCellRender',
  cell: { type: 'date' | 'month'; key: string; row: number; column: number },
  render: () => T,
) => {
  if (!profile.enabled) {
    return render()
  }

  countCalendarRender(profile, renderName)
  const start = getCalendarNow()
  const result = render()
  const duration = getCalendarNow() - start
  if (duration >= profile.threshold) {
    profile.slowCells.push({
      type: cell.type,
      key: cell.key,
      renderName,
      duration,
      row: cell.row,
      column: cell.column,
    })
  }
  return result
}

const emitCalendarRenderProfile = (
  handler: CalendarProps['onRenderProfile'],
  profile: CalendarRenderProfileState,
  mode: CalendarMode,
  phase: CalendarRenderProfileEvent['phase'],
) => {
  if (!handler || !profile.enabled) {
    return
  }

  const duration = getCalendarNow() - profile.start
  const event: CalendarRenderProfileEvent = {
    component: 'Calendar',
    mode,
    phase,
    duration,
    cellCount: profile.cellCount,
    customRenderCount: profile.customRenderCount,
    cellRenderCount: profile.cellRenderCount,
    fullCellRenderCount: profile.fullCellRenderCount,
    dateCellRenderCount: profile.dateCellRenderCount,
    dateFullCellRenderCount: profile.dateFullCellRenderCount,
    monthCellRenderCount: profile.monthCellRenderCount,
    monthFullCellRenderCount: profile.monthFullCellRenderCount,
    slow: duration >= profile.threshold || profile.slowCells.length > 0,
    threshold: profile.threshold,
    slowCells: profile.slowCells.slice(),
  }
  const deliver = () => handler(event)
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(deliver)
  } else {
    Promise.resolve().then(deliver)
  }
}

/** 构建 Date Button Class Name 的内部工具函数。 */
const buildDateButtonClassName = (
  fullscreen: boolean,
  selected: boolean,
  disabled: boolean,
  inView: boolean,
  isToday: boolean,
) => {
  let buttonClassName = `group relative flex min-h-[5.35rem] w-full flex-col rounded-[1.2rem] border px-2.5 py-2.5 text-left transition duration-150 ${fullscreen ? '' : 'min-h-[4.7rem] rounded-[1rem] px-2 py-2'}`
  if (selected) {
    buttonClassName += ' border-primary bg-primary text-primary-content shadow-md shadow-primary/15'
  } else if (disabled) {
    buttonClassName += ' border-base-300/70 bg-base-200/50 text-base-content/35'
  } else if (inView) {
    buttonClassName +=
      ' border-base-300/80 bg-base-100 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm'
  } else {
    buttonClassName +=
      ' border-base-300/60 bg-base-200/60 text-base-content/55 hover:border-primary/20'
  }
  if (isToday && !selected) {
    buttonClassName += ' ring-1 ring-primary/20'
  }
  return buttonClassName
}

/** 构建 Month Button Class Name 的内部工具函数。 */
const buildMonthButtonClassName = (
  fullscreen: boolean,
  selected: boolean,
  disabled: boolean,
  isToday: boolean,
) => {
  let buttonClassName = `group relative flex min-h-[6.1rem] w-full flex-col rounded-[1.2rem] border px-3 py-3 text-left transition duration-150 ${fullscreen ? '' : 'min-h-[5.5rem] rounded-[1rem] px-2.5 py-2.5'}`
  if (selected) {
    buttonClassName += ' border-primary bg-primary text-primary-content shadow-md shadow-primary/15'
  } else if (disabled) {
    buttonClassName += ' border-base-300/70 bg-base-200/50 text-base-content/35'
  } else {
    buttonClassName +=
      ' border-base-300/80 bg-base-100 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm'
  }
  if (isToday && !selected) {
    buttonClassName += ' ring-1 ring-primary/20'
  }
  return buttonClassName
}

/** 渲染 Optimized Date Button Inner HTML 的内部工具函数。 */
const renderOptimizedDateButtonInnerHTML = (
  state: DefaultDateCellState,
  todayMarkerLabel: string,
) => {
  const dayClassName = `text-sm font-semibold ${state.inView ? '' : 'opacity-60'}`.trim()
  const badgeHTML = state.isToday
    ? `<span class="badge badge-xs ${state.selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}">${todayMarkerLabel}</span>`
    : ''
  return `<span class="flex items-start justify-between gap-2"><span class="${dayClassName}">${state.dayNumber}</span>${badgeHTML}</span>`
}

/** 构建 Month Selection Patch Signature 的内部工具函数。 */
/** 转义 fast HTML 渲染路径中的文本和属性值，避免用户传入内容破坏结构。 */
const escapeCalendarHtml = (value: unknown) => {
  return `${value ?? ''}`.replace(/[&<>"']/g, char => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}

/** 渲染布尔属性；仅 true 时输出属性名。 */
const renderCalendarBooleanAttr = (name: string, value: boolean | undefined) => {
  return value ? ` ${name}` : ''
}

/** 渲染可安全字符串化的 DOM 属性，跳过函数/对象/空值。 */
const renderCalendarAttr = (name: string, value: unknown) => {
  if (
    value == null ||
    value === false ||
    typeof value === 'function' ||
    typeof value === 'object'
  ) {
    return ''
  }
  if (value === true) {
    return ` ${name}`
  }
  return ` ${name}="${escapeCalendarHtml(value)}"`
}

/** 渲染透传到 Calendar 根节点的其余属性，排除 children/className 等由组件接管的字段。 */
const renderCalendarRestAttrs = (rest: Record<string, any>) => {
  return Object.entries(rest)
    .map(([name, value]) => {
      if (name === 'children' || name === 'class' || name === 'className') {
        return ''
      }
      return renderCalendarAttr(name, value)
    })
    .join('')
}

const renderManagedCalendarCellHost = (key: string) =>
  `<div data-rue-calendar-managed-cell="${escapeCalendarHtml(key)}" style="display: contents;"></div>`

const renderManagedCalendarHeaderHost = () =>
  '<div data-rue-calendar-managed-header="true" style="display: contents;"></div>'

const clearManagedCalendarMount = (mount: ManagedCalendarMount | null) => {
  if (mount) {
    renderAnchor(null, mount.host, mount.anchor as any)
  }
}

const syncManagedCalendarHeaderContent = (
  root: HTMLElement,
  mount: ManagedCalendarMount | null,
  snapshot: OptimizedDefaultCalendarSnapshot,
) => {
  const host = root.querySelector('[data-rue-calendar-managed-header="true"]') as HTMLElement | null

  if (!snapshot.hasCustomHeader || !host) {
    clearManagedCalendarMount(mount)
    return null
  }

  let nextMount = mount
  if (!nextMount || nextMount.host !== host) {
    clearManagedCalendarMount(nextMount)
    const anchor = (host.ownerDocument ?? document).createComment('rue-calendar-managed-header')
    host.appendChild(anchor)
    nextMount = { host, anchor }
  }

  renderAnchor(
    snapshot.customHeaderContent == null ? null : <>{snapshot.customHeaderContent}</>,
    host,
    nextMount.anchor as any,
  )
  return nextMount
}

const syncManagedCalendarContent = (
  root: HTMLElement,
  mounts: Map<string, ManagedCalendarMount>,
  snapshot: OptimizedDefaultCalendarSnapshot,
  keys?: Iterable<string>,
) => {
  const requestedKeys = keys ? new Set(keys) : null
  const nextKeys = requestedKeys ?? new Set(snapshot.managedCellContent.keys())

  for (const key of nextKeys) {
    const managedCell = snapshot.managedCellContent.get(key)
    const host = Array.from(root.querySelectorAll('[data-rue-calendar-managed-cell]')).find(
      node => node.getAttribute('data-rue-calendar-managed-cell') === key,
    ) as HTMLElement | undefined

    if (!managedCell || !host) {
      const stale = mounts.get(key)
      if (stale) {
        renderAnchor(null, stale.host, stale.anchor as any)
        mounts.delete(key)
      }
      continue
    }

    let mount = mounts.get(key)
    if (!mount || mount.host !== host) {
      if (mount) {
        renderAnchor(null, mount.host, mount.anchor as any)
      }
      const anchor = (host.ownerDocument ?? document).createComment('rue-calendar-managed-anchor')
      host.appendChild(anchor)
      mount = { host, anchor }
      mounts.set(key, mount)
    }

    renderAnchor(
      managedCell.content == null ? null : <>{managedCell.content}</>,
      host,
      mount.anchor as any,
    )
  }

  if (!requestedKeys) {
    for (const [key, mount] of Array.from(mounts.entries())) {
      if (snapshot.managedCellContent.has(key)) {
        continue
      }
      renderAnchor(null, mount.host, mount.anchor as any)
      mounts.delete(key)
    }
  }
}

const clearManagedCalendarContent = (mounts: Map<string, ManagedCalendarMount>) => {
  for (const mount of mounts.values()) {
    renderAnchor(null, mount.host, mount.anchor as any)
  }
  mounts.clear()
}

/** 将默认 Calendar 快路径 snapshot 序列化为 HTML，降低大面板频繁 diff 的成本。 */
const renderOptimizedDefaultCalendarHTML = (snapshot: OptimizedDefaultCalendarSnapshot) => {
  const fullscreen = snapshot.fullscreen
  const rootAttrs = renderCalendarRestAttrs(snapshot.rest)
  const headerClass = `border-b border-base-300/70 ${fullscreen ? 'flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between' : 'flex flex-col gap-3 px-3 py-3'}`
  const bodyClass = fullscreen ? 'space-y-3 px-4 py-4' : 'space-y-3 px-3 py-3'
  const headerView = snapshot.hasCustomHeader
    ? renderManagedCalendarHeaderHost()
    : `<div class="${escapeCalendarHtml(headerClass)}">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/55">Rue Calendar</div>
        <div class="mt-1 text-xl font-semibold leading-tight">${escapeCalendarHtml(snapshot.headerTitle)}</div>
        <div class="mt-1 text-xs text-base-content/60">${escapeCalendarHtml(snapshot.todayLabel)}</div>
      </div>
      <div class="flex flex-wrap items-center gap-2 lg:justify-end">
        <div class="join">
          <button type="button" class="btn btn-sm join-item" aria-label="Previous" data-rue-calendar-action="previous"${renderCalendarBooleanAttr('disabled', snapshot.previousDisabled)}><span aria-hidden="true">&lt;</span></button>
          <button type="button" class="btn btn-sm join-item btn-ghost" data-rue-calendar-action="today"${renderCalendarBooleanAttr('disabled', snapshot.todayDisabled)}>${escapeCalendarHtml(snapshot.todayButtonLabel)}</button>
          <button type="button" class="btn btn-sm join-item" aria-label="Next" data-rue-calendar-action="next"${renderCalendarBooleanAttr('disabled', snapshot.nextDisabled)}><span aria-hidden="true">&gt;</span></button>
        </div>
        <select class="select select-sm min-w-24" data-rue-calendar-select="year">
          ${snapshot.yearOptions
            .map(
              option =>
                `<option value="${option.value}"${renderCalendarBooleanAttr('selected', option.value === snapshot.currentValue.getFullYear())}${renderCalendarBooleanAttr('disabled', option.disabled)}>${option.value}</option>`,
            )
            .join('')}
        </select>
        <select class="select select-sm min-w-24" data-rue-calendar-select="month"${renderCalendarBooleanAttr('disabled', snapshot.currentMode === 'year')}>
          ${snapshot.monthOptions
            .map(
              option =>
                `<option value="${option.value}"${renderCalendarBooleanAttr('selected', option.value === snapshot.currentValue.getMonth())}${renderCalendarBooleanAttr('disabled', option.disabled)}>${escapeCalendarHtml(option.label)}</option>`,
            )
            .join('')}
        </select>
        <div class="join">
          <button type="button" data-rue-calendar-mode-switch="month" data-rue-calendar-action="mode-month" class="btn btn-sm join-item ${snapshot.currentMode === 'month' ? 'btn-primary' : 'btn-ghost'}">${escapeCalendarHtml(snapshot.monthButtonLabel)}</button>
          <button type="button" data-rue-calendar-mode-switch="year" data-rue-calendar-action="mode-year" class="btn btn-sm join-item ${snapshot.currentMode === 'year' ? 'btn-primary' : 'btn-ghost'}">${escapeCalendarHtml(snapshot.yearButtonLabel)}</button>
        </div>
      </div>
    </div>`
  const weekHeader = snapshot.showWeek
    ? `<div class="px-2 py-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-base-content/45">${escapeCalendarHtml(snapshot.weekButtonLabel)}</div>`
    : ''
  const weekdayHeaders = snapshot.weekdayLabels
    .map(
      label =>
        `<div class="px-2 py-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-base-content/45">${escapeCalendarHtml(label)}</div>`,
    )
    .join('')
  const monthView =
    snapshot.currentMode === 'month'
      ? `<div class="space-y-2">
          <div class="${escapeCalendarHtml(snapshot.rowClassName)}">${weekHeader}${weekdayHeaders}</div>
          <div role="grid" class="space-y-2">
            ${snapshot.dateRows
              .map(
                row =>
                  `<div role="row" class="${escapeCalendarHtml(snapshot.rowClassName)}">
                    ${
                      snapshot.showWeek
                        ? `<div class="flex items-center justify-center rounded-[1rem] border border-base-300/70 bg-base-200/60 text-sm font-semibold text-base-content/60" data-rue-calendar-week="${row.week}">${row.week}</div>`
                        : ''
                    }
                    ${row.cells
                      .map(cell => {
                        const state = snapshot.dateCellStates.get(cell.key)!
                        const currentAttr = state.isToday ? ' aria-current="date"' : ''
                        return `<button
                          type="button"
                          role="gridcell"
                          data-rue-calendar-cell="${escapeCalendarHtml(cell.key)}"
                          data-rue-calendar-in-view="${state.inView ? 'true' : 'false'}"
                          aria-pressed="${state.selected ? 'true' : 'false'}"${currentAttr}
                          ${renderCalendarBooleanAttr('disabled', state.disabled)}
                          class="${escapeCalendarHtml(
                            buildDateButtonClassName(
                              fullscreen,
                              state.selected,
                              state.disabled,
                              state.inView,
                              state.isToday,
                            ),
                          )}"
                        >${
                          snapshot.hasDateCustomRender
                            ? renderManagedCalendarCellHost(cell.key)
                            : renderOptimizedDateButtonInnerHTML(state, snapshot.todayMarkerLabel)
                        }</button>`
                      })
                      .join('')}
                  </div>`,
              )
              .join('')}
          </div>
        </div>`
      : `<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          ${snapshot.monthOptions
            .map(monthOption => {
              const monthDate = createDate(
                snapshot.currentValue.getFullYear(),
                monthOption.value,
                1,
              )
              const selected = isSameMonth(monthDate, snapshot.currentValue)
              const isToday = isSameMonth(monthDate, startOfDay(new Date()))
              const disabled = monthOption.disabled === true
              const monthKey = `${snapshot.currentValue.getFullYear()}-${`${monthOption.value + 1}`.padStart(2, '0')}`
              return `<button
                type="button"
                data-rue-calendar-month="${monthKey}"
                aria-pressed="${selected ? 'true' : 'false'}"
                ${renderCalendarBooleanAttr('disabled', disabled)}
                class="${escapeCalendarHtml(buildMonthButtonClassName(fullscreen, selected, disabled, isToday))}"
              >
                ${
                  snapshot.hasMonthCustomRender
                    ? renderManagedCalendarCellHost(monthKey)
                    : `<span class="flex items-center justify-between gap-2">
                        <span class="text-sm font-semibold">${escapeCalendarHtml(monthOption.label)}</span>
                        ${
                          isToday
                            ? `<span class="badge badge-xs ${selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}">${escapeCalendarHtml(snapshot.todayMarkerLabel)}</span>`
                            : ''
                        }
                      </span>`
                }
              </button>`
            })
            .join('')}
        </div>`

  return `<div${rootAttrs} data-rue-calendar-root="true" data-rue-calendar-mode="${snapshot.currentMode}" class="${escapeCalendarHtml(snapshot.rootClassName)}">
    ${headerView}
    <div class="${escapeCalendarHtml(bodyClass)}">
      <div class="flex items-center justify-between gap-3 px-1">
        <div class="badge badge-outline badge-sm">${escapeCalendarHtml(snapshot.viewLabel)}</div>
        ${
          snapshot.showWeek && snapshot.currentMode === 'month'
            ? `<div class="badge badge-soft badge-sm">${escapeCalendarHtml(snapshot.weekButtonLabel)}</div>`
            : ''
        }
      </div>
      ${monthView}
    </div>
  </div>`
}

/** 渲染 Optimized Default Calendar View 的内部工具函数。 */
const renderOptimizedDefaultCalendarView = (snapshot: OptimizedDefaultCalendarSnapshot) => {
  const fullscreen = snapshot.fullscreen

  return (
    <div
      {...snapshot.rest}
      data-rue-calendar-root="true"
      data-rue-calendar-mode={snapshot.currentMode}
      className={snapshot.rootClassName}
    >
      {snapshot.hasCustomHeader ? (
        snapshot.customHeaderContent
      ) : (
        <div
          className={`border-b border-base-300/70 ${fullscreen ? 'flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between' : 'flex flex-col gap-3 px-3 py-3'}`}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/55">
              Rue Calendar
            </div>
            <div className="mt-1 text-xl font-semibold leading-tight">{snapshot.headerTitle}</div>
            <div className="mt-1 text-xs text-base-content/60">{snapshot.todayLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div className="join">
              <button
                type="button"
                className="btn btn-sm join-item"
                aria-label="Previous"
                disabled={snapshot.previousDisabled}
                onClick={snapshot.onPrevious}
              >
                <span aria-hidden="true">&lt;</span>
              </button>
              <button
                type="button"
                className="btn btn-sm join-item btn-ghost"
                disabled={snapshot.todayDisabled}
                onClick={snapshot.onToday}
              >
                {snapshot.todayButtonLabel}
              </button>
              <button
                type="button"
                className="btn btn-sm join-item"
                aria-label="Next"
                disabled={snapshot.nextDisabled}
                onClick={snapshot.onNext}
              >
                <span aria-hidden="true">&gt;</span>
              </button>
            </div>
            <select
              className="select select-sm min-w-24"
              value={snapshot.currentValue.getFullYear()}
              onChange={(event: Event) =>
                snapshot.onYearChange(Number((event.currentTarget as HTMLSelectElement).value))
              }
            >
              {snapshot.yearOptions.map(option => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.value}
                </option>
              ))}
            </select>
            <select
              className="select select-sm min-w-24"
              value={snapshot.currentValue.getMonth()}
              disabled={snapshot.currentMode === 'year'}
              onChange={(event: Event) =>
                snapshot.onMonthChange(Number((event.currentTarget as HTMLSelectElement).value))
              }
            >
              {snapshot.monthOptions.map(option => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="join">
              <button
                type="button"
                data-rue-calendar-mode-switch="month"
                className={`btn btn-sm join-item ${snapshot.currentMode === 'month' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={snapshot.onModeMonth}
              >
                {snapshot.monthButtonLabel}
              </button>
              <button
                type="button"
                data-rue-calendar-mode-switch="year"
                className={`btn btn-sm join-item ${snapshot.currentMode === 'year' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={snapshot.onModeYear}
              >
                {snapshot.yearButtonLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={fullscreen ? 'space-y-3 px-4 py-4' : 'space-y-3 px-3 py-3'}>
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="badge badge-outline badge-sm">{snapshot.viewLabel}</div>
          {snapshot.showWeek && snapshot.currentMode === 'month' ? (
            <div className="badge badge-soft badge-sm">{snapshot.weekButtonLabel}</div>
          ) : null}
        </div>

        {snapshot.currentMode === 'month' ? (
          <div className="space-y-2">
            <div className={snapshot.rowClassName}>
              {snapshot.showWeek ? (
                <div className="px-2 py-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-base-content/45">
                  {snapshot.weekButtonLabel}
                </div>
              ) : null}
              {snapshot.weekdayLabels.map(label => (
                <div
                  key={label}
                  className="px-2 py-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-base-content/45"
                >
                  {label}
                </div>
              ))}
            </div>

            <div role="grid" className="space-y-2">
              {snapshot.dateRows.map(row => (
                <div key={row.key} role="row" className={snapshot.rowClassName}>
                  {snapshot.showWeek ? (
                    <div
                      className="flex items-center justify-center rounded-[1rem] border border-base-300/70 bg-base-200/60 text-sm font-semibold text-base-content/60"
                      data-rue-calendar-week={row.week}
                    >
                      {row.week}
                    </div>
                  ) : null}
                  {row.cells.map(cell => {
                    const state = snapshot.dateCellStates.get(cell.key)!
                    return (
                      <button
                        type="button"
                        key={cell.key}
                        role="gridcell"
                        data-rue-calendar-cell={cell.key}
                        data-rue-calendar-in-view={state.inView ? 'true' : 'false'}
                        aria-pressed={state.selected ? 'true' : 'false'}
                        aria-current={state.isToday ? 'date' : undefined}
                        disabled={state.disabled}
                        className={buildDateButtonClassName(
                          fullscreen,
                          state.selected,
                          state.disabled,
                          state.inView,
                          state.isToday,
                        )}
                        onClick={() => snapshot.onDateSelect(cell.date)}
                      >
                        {snapshot.hasDateCustomRender ? (
                          (snapshot.managedCellContent.get(cell.key)?.content ?? null)
                        ) : (
                          <span className="flex items-start justify-between gap-2">
                            <span
                              className={`text-sm font-semibold ${state.inView ? '' : 'opacity-60'}`}
                            >
                              {state.dayNumber}
                            </span>
                            {state.isToday ? (
                              <span
                                className={`badge badge-xs ${state.selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}`}
                              >
                                {snapshot.todayMarkerLabel}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {snapshot.monthOptions.map(monthOption => {
              const monthDate = createDate(
                snapshot.currentValue.getFullYear(),
                monthOption.value,
                1,
              )
              const selected = isSameMonth(monthDate, snapshot.currentValue)
              const isToday = isSameMonth(monthDate, startOfDay(new Date()))
              const disabled = monthOption.disabled === true
              return (
                <button
                  type="button"
                  key={`${snapshot.currentValue.getFullYear()}-${monthOption.value}`}
                  data-rue-calendar-month={`${snapshot.currentValue.getFullYear()}-${`${monthOption.value + 1}`.padStart(2, '0')}`}
                  aria-pressed={selected ? 'true' : 'false'}
                  disabled={disabled}
                  className={buildMonthButtonClassName(fullscreen, selected, disabled, isToday)}
                  onClick={() => snapshot.onMonthSelect(monthDate)}
                >
                  {snapshot.hasMonthCustomRender ? (
                    (snapshot.managedCellContent.get(
                      `${snapshot.currentValue.getFullYear()}-${`${monthOption.value + 1}`.padStart(2, '0')}`,
                    )?.content ?? null)
                  ) : (
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{monthOption.label}</span>
                      {isToday ? (
                        <span
                          className={`badge badge-xs ${selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}`}
                        >
                          {snapshot.todayMarkerLabel}
                        </span>
                      ) : null}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** clamp Week Start 的内部工具函数。 */
const clampWeekStart = (value?: number): CalendarWeekStart => {
  if (typeof value === 'number' && value >= 0 && value <= 6) {
    return value as CalendarWeekStart
  }
  return 1
}

/** clone Date 的内部工具函数。 */
const cloneDate = (value: Date) => new Date(value.getTime())

/** 创建 Date 的内部工具函数。 */
const createDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month, day)
  date.setHours(12, 0, 0, 0)
  return date
}

/** start Of Day 的内部工具函数。 */
const startOfDay = (value: Date) => {
  const date = cloneDate(value)
  date.setHours(0, 0, 0, 0)
  return date
}

/** start Of Month 的内部工具函数。 */
const startOfMonth = (value: Date) => createDate(value.getFullYear(), value.getMonth(), 1)
/** end Of Month 的内部工具函数。 */
const endOfMonth = (value: Date) => createDate(value.getFullYear(), value.getMonth() + 1, 0)
/** start Of Year 的内部工具函数。 */
const startOfYear = (value: Date) => createDate(value.getFullYear(), 0, 1)
/** end Of Year 的内部工具函数。 */
const endOfYear = (value: Date) => createDate(value.getFullYear(), 11, 31)
/** add Days 的内部工具函数。 */
const addDays = (value: Date, amount: number) =>
  createDate(value.getFullYear(), value.getMonth(), value.getDate() + amount)

/** 判断 Valid Date 的内部工具函数。 */
const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime())

/** 归一化 Date 的内部工具函数。 */
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

/** 归一化 Range 的内部工具函数。 */
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

/** 判断 Same Year 的内部工具函数。 */
const isSameYear = (left: Date, right: Date) => left.getFullYear() === right.getFullYear()
/** 判断 Same Month 的内部工具函数。 */
const isSameMonth = (left: Date, right: Date) =>
  isSameYear(left, right) && left.getMonth() === right.getMonth()
/** 判断 Same Date 的内部工具函数。 */
const isSameDate = (left: Date, right: Date) =>
  isSameMonth(left, right) && left.getDate() === right.getDate()

/** add Months 的内部工具函数。 */
const addMonths = (value: Date, amount: number) => {
  const base = createDate(value.getFullYear(), value.getMonth() + amount, 1)
  const maxDay = endOfMonth(base).getDate()
  return createDate(base.getFullYear(), base.getMonth(), Math.min(value.getDate(), maxDay))
}

/** add Years 的内部工具函数。 */
const addYears = (value: Date, amount: number) => {
  const base = createDate(value.getFullYear() + amount, value.getMonth(), 1)
  const maxDay = endOfMonth(base).getDate()
  return createDate(base.getFullYear(), base.getMonth(), Math.min(value.getDate(), maxDay))
}

/** 设置 Calendar Year 的内部工具函数。 */
const setCalendarYear = (value: Date, year: number) => addYears(value, year - value.getFullYear())
/** 设置 Calendar Month 的内部工具函数。 */
const setCalendarMonth = (value: Date, month: number) => addMonths(value, month - value.getMonth())

/** format Date Key 的内部工具函数。 */
const formatDateKey = (value: Date) => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 判断 Date Selectable 的内部工具函数。 */
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

/** month Has Selectable Date 的内部工具函数。 */
const monthHasSelectableDate = (
  value: Date,
  range: CalendarRange | null,
  disabledDate?: (date: Date) => boolean,
  resolveDateSelectable?: (date: Date) => boolean,
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
    if (
      resolveDateSelectable
        ? resolveDateSelectable(cursor)
        : isDateSelectable(cursor, range, disabledDate)
    ) {
      return true
    }
    cursor = addDays(cursor, 1)
  }
  return false
}

/** year Has Selectable Date 的内部工具函数。 */
const yearHasSelectableDate = (
  value: Date,
  range: CalendarRange | null,
  disabledDate?: (date: Date) => boolean,
  resolveMonthSelectable?: (date: Date) => boolean,
) => {
  const start = startOfYear(value)
  const end = endOfYear(value)
  if (range) {
    if (end.getTime() < range.start.getTime() || start.getTime() > range.end.getTime()) {
      return false
    }
  }

  return Array.from({ length: 12 }, (_, month) => createDate(value.getFullYear(), month, 1)).some(
    date =>
      resolveMonthSelectable
        ? resolveMonthSelectable(date)
        : monthHasSelectableDate(date, range, disabledDate),
  )
}

/** createCalendarSelectabilityResolver 导出函数。 */
export const createCalendarSelectabilityResolver = (
  validRange?: [CalendarValue, CalendarValue],
  disabledDate?: (date: Date) => boolean,
) => {
  const range = normalizeRange(validRange)
  const hasSelectabilityConstraints = !!range || !!disabledDate
  const caches = createSelectabilityCaches()

  const resolveDateSelectable = (date: Date) => {
    if (!hasSelectabilityConstraints) {
      return true
    }

    const cacheKey = formatDateKey(startOfDay(date))
    const cached = caches.date.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const selectable = isDateSelectable(date, range, disabledDate)
    caches.date.set(cacheKey, selectable)
    return selectable
  }

  const resolveMonthSelectable = (date: Date) => {
    if (!hasSelectabilityConstraints) {
      return true
    }

    const cacheKey = `${date.getFullYear()}-${date.getMonth()}`
    const cached = caches.month.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const selectable = monthHasSelectableDate(date, range, disabledDate, resolveDateSelectable)
    caches.month.set(cacheKey, selectable)
    return selectable
  }

  const resolveYearSelectable = (date: Date) => {
    if (!hasSelectabilityConstraints) {
      return true
    }

    const cacheKey = `${date.getFullYear()}`
    const cached = caches.year.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const selectable = yearHasSelectableDate(date, range, disabledDate, resolveMonthSelectable)
    caches.year.set(cacheKey, selectable)
    return selectable
  }

  return {
    resolveDateSelectable,
    resolveMonthSelectable,
    resolveYearSelectable,
  }
}

/** 读取 ISOWeek 的内部工具函数。 */
const getISOWeek = (value: Date) => {
  const date = startOfDay(value)
  const day = (date.getDay() + 6) % 7
  const thursday = addDays(date, 3 - day)
  const firstThursday = createDate(thursday.getFullYear(), 0, 4)
  const firstThursdayDay = (firstThursday.getDay() + 6) % 7
  const firstWeekStart = addDays(firstThursday, -firstThursdayDay)
  return 1 + Math.round((date.getTime() - firstWeekStart.getTime()) / 604800000)
}

/** 读取 Weekday Labels 的内部工具函数。 */
const getWeekdayLabels = (locale: string, weekStartsOn: CalendarWeekStart) => {
  const cacheKey = `${locale}:${weekStartsOn}`
  const cached = weekdayLabelCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const anchor = createDate(2026, 2, 1)
  const labels = Array.from({ length: 7 }, (_, index) =>
    formatter.format(addDays(anchor, (weekStartsOn + index) % 7)),
  )
  weekdayLabelCache.set(cacheKey, labels)
  return labels
}

/** 读取 Month Labels 的内部工具函数。 */
const getMonthLabels = (locale: string) => {
  const cached = monthLabelCache.get(locale)
  if (cached) {
    return cached
  }

  const formatter = new Intl.DateTimeFormat(locale, { month: 'short' })
  const labels = Array.from({ length: 12 }, (_, month) =>
    formatter.format(createDate(2026, month, 1)),
  )
  monthLabelCache.set(locale, labels)
  return labels
}

/** 读取 Year Options 的内部工具函数。 */
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

/** 读取 Month Options 的内部工具函数。 */
const getMonthOptions = (
  locale: string,
  value: Date,
  range: CalendarRange | null,
  disabledDate?: (date: Date) => boolean,
  resolveMonthSelectable?: (date: Date) => boolean,
): CalendarMonthOption[] => {
  const labels = getMonthLabels(locale)
  return Array.from({ length: 12 }, (_, month) => {
    const date = createDate(value.getFullYear(), month, 1)
    return {
      value: month,
      label: labels[month],
      disabled: !(resolveMonthSelectable
        ? resolveMonthSelectable(date)
        : monthHasSelectableDate(date, range, disabledDate)),
    }
  })
}

/** 读取 Visible Date Rows 的内部工具函数。 */
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

/** 读取 Month Year Formatter 的内部工具函数。 */
const getMonthYearFormatter = (locale: string) => {
  let formatter = monthYearFormatterCache.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' })
    monthYearFormatterCache.set(locale, formatter)
  }
  return formatter
}

/** 读取 Year Formatter 的内部工具函数。 */
const getYearFormatter = (locale: string) => {
  let formatter = yearFormatterCache.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { year: 'numeric' })
    yearFormatterCache.set(locale, formatter)
  }
  return formatter
}

/** 读取 Today Formatter 的内部工具函数。 */
const getTodayFormatter = (locale: string) => {
  let formatter = todayFormatterCache.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    todayFormatterCache.set(locale, formatter)
  }
  return formatter
}

/** Calendar Panel 的内部工具函数。 */
const CalendarPanelImpl: FC<CalendarProps> = ({
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
  onRenderProfile,
  renderProfileThreshold = 16,
  onChange,
  onPanelChange,
  onSelect,
  ...rest
}) => {
  const renderProfile = createCalendarRenderProfileState(!!onRenderProfile, renderProfileThreshold)
  const uncontrolledState = useSetup(() => ({
    value: ref(normalizeDate(value ?? defaultValue ?? new Date())),
    mode: ref<CalendarMode>(mode ?? 'month'),
  }))
  const uncontrolledValue = uncontrolledState.value
  const uncontrolledMode = uncontrolledState.mode
  const selectableDateCacheRef = useRef<CalendarSelectabilityCaches['date']>()
  const selectableMonthCacheRef = useRef<CalendarSelectabilityCaches['month']>()
  const selectableYearCacheRef = useRef<CalendarSelectabilityCaches['year']>()
  const cacheRangeStartRef = useRef<number | null>(null)
  const cacheRangeEndRef = useRef<number | null>(null)
  const cacheDisabledDateSignatureRef = useRef('__none__')
  const currentValue =
    value !== undefined ? normalizeDate(value, uncontrolledValue.value) : uncontrolledValue.value
  const currentMode = mode ?? uncontrolledMode.value
  const today = startOfDay(new Date())
  const range = normalizeRange(validRange)
  const hasSelectabilityConstraints = !!range || !!disabledDate
  const resolvedLocale =
    locale ??
    (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN')
  const resolvedWeekStart = clampWeekStart(weekStartsOn)
  const isZhLocale = resolvedLocale.toLowerCase().startsWith('zh')

  if (!selectableDateCacheRef.current) {
    selectableDateCacheRef.current = createSelectabilityCaches().date
  }
  if (!selectableMonthCacheRef.current) {
    selectableMonthCacheRef.current = createSelectabilityCaches().month
  }
  if (!selectableYearCacheRef.current) {
    selectableYearCacheRef.current = createSelectabilityCaches().year
  }

  const rangeStart = range ? range.start.getTime() : null
  const rangeEnd = range ? range.end.getTime() : null
  const disabledDateSignature = disabledDate ? disabledDate.toString() : '__none__'
  if (
    cacheRangeStartRef.current !== rangeStart ||
    cacheRangeEndRef.current !== rangeEnd ||
    cacheDisabledDateSignatureRef.current !== disabledDateSignature
  ) {
    selectableDateCacheRef.current.clear()
    selectableMonthCacheRef.current.clear()
    selectableYearCacheRef.current.clear()
    cacheRangeStartRef.current = rangeStart
    cacheRangeEndRef.current = rangeEnd
    cacheDisabledDateSignatureRef.current = disabledDateSignature
  }

  const resolveDateSelectable = (date: Date) => {
    if (!hasSelectabilityConstraints) {
      return true
    }

    const cacheKey = formatDateKey(startOfDay(date))
    const cached = selectableDateCacheRef.current?.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const selectable = isDateSelectable(date, range, disabledDate)
    selectableDateCacheRef.current?.set(cacheKey, selectable)
    return selectable
  }

  const resolveMonthSelectable = (date: Date) => {
    if (!hasSelectabilityConstraints) {
      return true
    }

    const cacheKey = `${date.getFullYear()}-${date.getMonth()}`
    const cached = selectableMonthCacheRef.current?.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const selectable = monthHasSelectableDate(date, range, disabledDate, resolveDateSelectable)
    selectableMonthCacheRef.current?.set(cacheKey, selectable)
    return selectable
  }

  const resolveYearSelectable = (date: Date) => {
    if (!hasSelectabilityConstraints) {
      return true
    }

    const cacheKey = `${date.getFullYear()}`
    const cached = selectableYearCacheRef.current?.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const selectable = yearHasSelectableDate(date, range, disabledDate, resolveMonthSelectable)
    selectableYearCacheRef.current?.set(cacheKey, selectable)
    return selectable
  }

  const isMonthMode = currentMode === 'month'
  const weekdayLabels = isMonthMode ? getWeekdayLabels(resolvedLocale, resolvedWeekStart) : []
  const dateRows = isMonthMode ? getVisibleDateRows(currentValue, resolvedWeekStart) : []
  renderProfile.cellCount = isMonthMode
    ? dateRows.reduce((count, row) => count + row.cells.length, 0)
    : 12
  const yearOptions = getYearOptions(currentValue, range)
  const monthOptions = getMonthOptions(
    resolvedLocale,
    currentValue,
    hasSelectabilityConstraints ? range : null,
    hasSelectabilityConstraints ? disabledDate : undefined,
    hasSelectabilityConstraints ? resolveMonthSelectable : undefined,
  )
  const rootClassName = mergeClassName(
    `overflow-hidden border border-base-300 bg-gradient-to-b from-base-100 via-base-100 to-base-200/70 text-base-content shadow-sm ${fullscreen ? 'rounded-[1.75rem]' : 'w-full max-w-[24rem] rounded-[1.5rem]'}`,
    className,
  )
  const rowClassName = showWeek
    ? 'grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-2'
    : 'grid grid-cols-7 gap-2'
  const headerTitle =
    currentMode === 'month'
      ? getMonthYearFormatter(resolvedLocale).format(currentValue)
      : getYearFormatter(resolvedLocale).format(currentValue)
  const todayLabel = getTodayFormatter(resolvedLocale).format(today)
  const todayButtonLabel = isZhLocale ? '今天' : 'Today'
  const monthButtonLabel = isZhLocale ? '月' : 'Month'
  const yearButtonLabel = isZhLocale ? '年' : 'Year'
  const weekButtonLabel = isZhLocale ? '周' : 'Week'
  const todayMarkerLabel = isZhLocale ? '今' : 'Today'
  const viewLabel =
    currentMode === 'month'
      ? isZhLocale
        ? '月视图'
        : 'Month view'
      : isZhLocale
        ? '年视图'
        : 'Year view'
  const previousDisabled = !hasSelectabilityConstraints
    ? false
    : currentMode === 'month'
      ? !resolveMonthSelectable(addMonths(currentValue, -1))
      : !resolveYearSelectable(addYears(currentValue, -1))
  const nextDisabled = !hasSelectabilityConstraints
    ? false
    : currentMode === 'month'
      ? !resolveMonthSelectable(addMonths(currentValue, 1))
      : !resolveYearSelectable(addYears(currentValue, 1))
  const todayDisabled = hasSelectabilityConstraints ? !resolveDateSelectable(today) : false
  const hasDateCustomRender = !!(
    cellRender ||
    fullCellRender ||
    dateCellRender ||
    dateFullCellRender
  )
  const hasMonthCustomRender = !!(
    cellRender ||
    fullCellRender ||
    monthCellRender ||
    monthFullCellRender
  )
  const triggerChange = (nextInput: CalendarValue, source: CalendarSelectSource) => {
    const nextDate = startOfDay(normalizeDate(nextInput, currentValue))
    const changed = !isSameDate(nextDate, currentValue)
    const panelChanged =
      currentMode === 'month'
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
  const hasCustomHeader = !!headerRender
  const customHeaderContent = headerRender ? headerRender(headerConfig) : null

  const optimizedCtx = useSetup(() => ({
    host: null as HTMLElement | null,
    lastSnapshot: null as OptimizedDefaultCalendarSnapshot | null,
    managedContentMounts: new Map<string, ManagedCalendarMount>(),
    managedHeaderMount: null as ManagedCalendarMount | null,
    eventsAttached: false,
    cleanupVersion: 0,
  }))

  /** 绑定一次事件委托，把 fast HTML 中的 data 属性还原为 Calendar 交互回调。 */
  const ensureHostEvents = () => {
    if (!optimizedCtx.host || optimizedCtx.eventsAttached) {
      return
    }

    optimizedCtx.host.addEventListener('click', event => {
      const snapshot = optimizedCtx.lastSnapshot
      const target = event.target as HTMLElement | null
      const control = target?.closest(
        '[data-rue-calendar-action], [data-rue-calendar-cell], [data-rue-calendar-month]',
      ) as HTMLButtonElement | null
      if (!snapshot || !control || !optimizedCtx.host?.contains(control) || control.disabled) {
        return
      }

      const action = control.getAttribute('data-rue-calendar-action')
      if (action === 'previous') {
        snapshot.onPrevious()
        return
      }
      if (action === 'today') {
        snapshot.onToday()
        return
      }
      if (action === 'next') {
        snapshot.onNext()
        return
      }
      if (action === 'mode-month') {
        snapshot.onModeMonth()
        return
      }
      if (action === 'mode-year') {
        snapshot.onModeYear()
        return
      }

      const dateKey = control.getAttribute('data-rue-calendar-cell')
      if (dateKey) {
        snapshot.onDateSelect(normalizeDate(dateKey, snapshot.currentValue))
        return
      }

      const monthKey = control.getAttribute('data-rue-calendar-month')
      if (monthKey) {
        const [year, month] = monthKey.split('-').map(part => Number(part))
        if (Number.isFinite(year) && Number.isFinite(month)) {
          snapshot.onMonthSelect(createDate(year, month - 1, 1))
        }
      }
    })

    optimizedCtx.host.addEventListener('change', event => {
      const snapshot = optimizedCtx.lastSnapshot
      const target = event.target as HTMLSelectElement | null
      if (!snapshot || !target || !optimizedCtx.host?.contains(target)) {
        return
      }

      const select = target.getAttribute('data-rue-calendar-select')
      const value = Number(target.value)
      if (!Number.isFinite(value)) {
        return
      }
      if (select === 'year') {
        snapshot.onYearChange(value)
      } else if (select === 'month') {
        snapshot.onMonthChange(value)
      }
    })

    optimizedCtx.eventsAttached = true
  }

  const dateCellStates = new Map<string, DefaultDateCellState>()
  if (isMonthMode) {
    for (const row of dateRows) {
      for (const cell of row.cells) {
        dateCellStates.set(cell.key, {
          key: cell.key,
          dayNumber: cell.date.getDate(),
          inView: cell.inView,
          selected: isSameDate(cell.date, currentValue),
          isToday: isSameDate(cell.date, today),
          disabled: !resolveDateSelectable(cell.date),
        })
      }
    }
  }

  const snapshotYearOptions = yearOptions.map(year => ({
    value: year,
    disabled: !resolveYearSelectable(createDate(year, currentValue.getMonth(), 1)),
  }))
  const managedCellContent = new Map<string, ManagedCalendarCellContent>()
  if (isMonthMode && hasDateCustomRender) {
    dateRows.forEach((row, rowIndex) => {
      row.cells.forEach((cell, columnIndex) => {
        const state = dateCellStates.get(cell.key)!
        const cellMeta = {
          type: 'date' as const,
          key: cell.key,
          row: rowIndex,
          column: columnIndex,
        }
        const bareNode = (
          <div className="flex h-full flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className={`text-sm font-semibold ${cell.inView ? '' : 'opacity-60'}`}>
                {cell.date.getDate()}
              </span>
              {state.isToday ? (
                <span
                  className={`badge badge-xs ${state.selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}`}
                >
                  {todayMarkerLabel}
                </span>
              ) : null}
            </div>
          </div>
        )
        let content = cellRender
          ? invokeCalendarRender(renderProfile, 'cellRender', cellMeta, () =>
              cellRender(cloneDate(cell.date), {
                type: 'date',
                originNode: bareNode,
                today: cloneDate(today),
                selected: state.selected,
                isToday: state.isToday,
                inView: cell.inView,
                disabled: state.disabled,
                row: rowIndex,
                column: columnIndex,
                week: row.week,
              }),
            )
          : undefined
        if (content == null && dateCellRender) {
          content = invokeCalendarRender(renderProfile, 'dateCellRender', cellMeta, () =>
            dateCellRender(cloneDate(cell.date)),
          )
        }
        const originNode = (
          <div className="flex h-full flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className={`text-sm font-semibold ${cell.inView ? '' : 'opacity-60'}`}>
                {cell.date.getDate()}
              </span>
              {state.isToday ? (
                <span
                  className={`badge badge-xs ${state.selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}`}
                >
                  {todayMarkerLabel}
                </span>
              ) : null}
            </div>
            <div
              className={`min-h-[1.85rem] text-[0.68rem] leading-4 ${state.selected ? 'opacity-90' : 'opacity-75'}`}
            >
              {content}
            </div>
          </div>
        )
        let rendered = fullCellRender
          ? invokeCalendarRender(renderProfile, 'fullCellRender', cellMeta, () =>
              fullCellRender(cloneDate(cell.date), {
                type: 'date',
                originNode,
                today: cloneDate(today),
                selected: state.selected,
                isToday: state.isToday,
                inView: cell.inView,
                disabled: state.disabled,
                row: rowIndex,
                column: columnIndex,
                week: row.week,
              }),
            )
          : undefined
        if (rendered == null && dateFullCellRender) {
          rendered = invokeCalendarRender(renderProfile, 'dateFullCellRender', cellMeta, () =>
            dateFullCellRender(cloneDate(cell.date)),
          )
        }
        managedCellContent.set(cell.key, {
          key: cell.key,
          type: 'date',
          content: rendered ?? originNode,
        })
      })
    })
  } else if (!isMonthMode && hasMonthCustomRender) {
    monthOptions.forEach((monthOption, index) => {
      const monthDate = createDate(currentValue.getFullYear(), monthOption.value, 1)
      const selected = isSameMonth(monthDate, currentValue)
      const isToday = isSameMonth(monthDate, today)
      const disabled = monthOption.disabled === true
      const monthKey = `${currentValue.getFullYear()}-${`${monthOption.value + 1}`.padStart(2, '0')}`
      const cellMeta = {
        type: 'month' as const,
        key: monthKey,
        row: Math.floor(index / 4),
        column: index % 4,
      }
      const bareNode = (
        <div className="flex h-full flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{monthOption.label}</span>
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
      let content = cellRender
        ? invokeCalendarRender(renderProfile, 'cellRender', cellMeta, () =>
            cellRender(cloneDate(monthDate), {
              type: 'month',
              originNode: bareNode,
              today: cloneDate(today),
              selected,
              isToday,
              inView: true,
              disabled,
              row: Math.floor(index / 4),
              column: index % 4,
            }),
          )
        : undefined
      if (content == null && monthCellRender) {
        content = invokeCalendarRender(renderProfile, 'monthCellRender', cellMeta, () =>
          monthCellRender(cloneDate(monthDate)),
        )
      }
      const originNode = (
        <div className="flex h-full flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{monthOption.label}</span>
            {isToday ? (
              <span
                className={`badge badge-xs ${selected ? 'badge-neutral text-neutral-content' : 'badge-primary badge-outline'}`}
              >
                {todayMarkerLabel}
              </span>
            ) : null}
          </div>
          <div
            className={`min-h-[2.1rem] text-xs leading-5 ${selected ? 'opacity-90' : 'opacity-75'}`}
          >
            {content}
          </div>
        </div>
      )
      let rendered = fullCellRender
        ? invokeCalendarRender(renderProfile, 'fullCellRender', cellMeta, () =>
            fullCellRender(cloneDate(monthDate), {
              type: 'month',
              originNode,
              today: cloneDate(today),
              selected,
              isToday,
              inView: true,
              disabled,
              row: Math.floor(index / 4),
              column: index % 4,
            }),
          )
        : undefined
      if (rendered == null && monthFullCellRender) {
        rendered = invokeCalendarRender(renderProfile, 'monthFullCellRender', cellMeta, () =>
          monthFullCellRender(cloneDate(monthDate)),
        )
      }
      managedCellContent.set(monthKey, {
        key: monthKey,
        type: 'month',
        content: rendered ?? originNode,
      })
    })
  }

  const optimizedSnapshot: OptimizedDefaultCalendarSnapshot = {
    rest,
    rootClassName,
    fullscreen,
    hasCustomHeader,
    customHeaderContent,
    currentMode,
    currentValue: cloneDate(currentValue),
    headerTitle,
    todayLabel,
    previousDisabled,
    nextDisabled,
    todayDisabled,
    yearOptions: snapshotYearOptions,
    monthOptions,
    weekdayLabels,
    dateRows,
    rowClassName,
    showWeek,
    viewLabel,
    weekButtonLabel,
    todayButtonLabel,
    monthButtonLabel,
    yearButtonLabel,
    todayMarkerLabel,
    dateCellStates,
    managedCellContent,
    hasDateCustomRender,
    hasMonthCustomRender,
    onPrevious: () =>
      triggerChange(
        currentMode === 'month' ? addMonths(currentValue, -1) : addYears(currentValue, -1),
        'customize',
      ),
    onToday: () => triggerChange(today, 'customize'),
    onNext: () =>
      triggerChange(
        currentMode === 'month' ? addMonths(currentValue, 1) : addYears(currentValue, 1),
        'customize',
      ),
    onYearChange: year => triggerChange(setCalendarYear(currentValue, year), 'customize'),
    onMonthChange: month => triggerChange(setCalendarMonth(currentValue, month), 'customize'),
    onModeMonth: () => triggerModeChange('month'),
    onModeYear: () => triggerModeChange('year'),
    onDateSelect: date => triggerChange(date, 'date'),
    onMonthSelect: date => triggerChange(date, 'month'),
  }

  onUnmounted(() => {
    const cleanupVersion = ++optimizedCtx.cleanupVersion
    queueMicrotask(() => {
      if (optimizedCtx.cleanupVersion !== cleanupVersion) {
        return
      }
      clearManagedCalendarContent(optimizedCtx.managedContentMounts)
      clearManagedCalendarMount(optimizedCtx.managedHeaderMount)
      optimizedCtx.managedHeaderMount = null
      if (optimizedCtx.host) {
        optimizedCtx.host.replaceChildren()
      }
      optimizedCtx.lastSnapshot = null
    })
  })

  if (typeof document === 'undefined') {
    emitCalendarRenderProfile(onRenderProfile, renderProfile, currentMode, 'jsx')
    return renderOptimizedDefaultCalendarView(optimizedSnapshot) as any
  }

  return vapor(() => {
    optimizedCtx.cleanupVersion += 1
    clearManagedCalendarContent(optimizedCtx.managedContentMounts)
    clearManagedCalendarMount(optimizedCtx.managedHeaderMount)
    optimizedCtx.managedHeaderMount = null

    const host = document.createElement('span')
    host.style.display = 'contents'
    optimizedCtx.host = host
    optimizedCtx.eventsAttached = false
    optimizedCtx.lastSnapshot = null
    ensureHostEvents()

    host.innerHTML = renderOptimizedDefaultCalendarHTML(optimizedSnapshot)
    syncManagedCalendarContent(host, optimizedCtx.managedContentMounts, optimizedSnapshot)
    optimizedCtx.managedHeaderMount = syncManagedCalendarHeaderContent(
      host,
      optimizedCtx.managedHeaderMount,
      optimizedSnapshot,
    )
    optimizedCtx.lastSnapshot = optimizedSnapshot
    emitCalendarRenderProfile(onRenderProfile, renderProfile, currentMode, 'html')
    return host
  })
}

const CalendarPanel = _$vaporMarkComponentRenderReactive(CalendarPanelImpl)

/** Cally web component 容器 */
const Cally: FC<CalendarHostProps> = ({ className, children, ...rest }) => {
  return (
    <calendar-date
      {...rest}
      data-testid={rest['data-testid']}
      className={mergeClassName('cally', className)}
    >
      {children}
    </calendar-date>
  )
}

/** Cally 的月份节点 */
const Month: FC<CalendarHostProps> = ({ className, children, ...rest }) => {
  return (
    <calendar-month {...rest} data-testid={rest['data-testid']} className={className}>
      {children}
    </calendar-month>
  )
}

/** Pikaday 输入框样式包装 */
const PikaSingle: FC<CalendarPikaSingleProps> = ({ type = 'text', className, ...rest }) => {
  return (
    <input
      {...rest}
      data-testid={rest['data-testid']}
      id={rest.id}
      value={rest.value}
      type={type}
      className={mergeClassName('pika-single', className)}
    />
  )
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

/** 默认导出日历组件。 */
export default CalendarCompound
