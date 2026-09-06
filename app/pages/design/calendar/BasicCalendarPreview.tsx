import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import Calendar from '../../../../packages/rue-design/src/components/calendar'

type DemoCalendarMode = 'month' | 'year'

const maintenanceDates = new Set(['2026-04-04', '2026-04-05', '2026-05-01'])

const formatIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  date.setHours(12, 0, 0, 0)
  return date
}

const formatDateLabel = (value?: string | Date) => {
  if (!value) {
    return '未选择'
  }
  return typeof value === 'string' ? value : formatIsoDate(value)
}

const formatPanelLabel = (date: Date, mode: DemoCalendarMode) => {
  if (mode === 'year') {
    return `${new Intl.DateTimeFormat('zh-CN', { year: 'numeric' }).format(date)} / 年视图`
  }
  return `${new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date)} / 月视图`
}

const basicCalendarValidRange: [Date, Date] = [parseDate('2026-04-01'), parseDate('2026-05-31')]

const isBasicCalendarDateDisabled = (date: Date) => {
  return date.getDay() === 0 || date.getDay() === 6 || maintenanceDates.has(formatIsoDate(date))
}

const BasicCalendarPreview: FC = () => {
  const selectedValue = ref('2026-04-12')
  const selectedSource = ref('date')
  const panelMode = ref<DemoCalendarMode>('month')
  const panelState = ref(formatPanelLabel(parseDate(selectedValue.value), 'month'))
  const handleChange = (date: Date) => {
    selectedValue.value = formatIsoDate(date)
  }
  const handlePanelChange = (date: Date, nextMode: DemoCalendarMode) => {
    panelState.value = formatPanelLabel(date, nextMode)
  }
  const handleSelect = (_date: Date, info: { source: string }) => {
    selectedSource.value = info.source
  }

  return (
    <div className="space-y-4">
      <Calendar
        data-testid="basic-calendar"
        locale="zh-CN"
        value={selectedValue.value}
        mode={panelMode.value}
        showWeek
        validRange={basicCalendarValidRange}
        disabledDate={isBasicCalendarDateDisabled}
        onChange={handleChange}
        onPanelChange={(date, nextMode) => {
          panelMode.value = nextMode as DemoCalendarMode
          handlePanelChange(date, nextMode as DemoCalendarMode)
        }}
        onSelect={handleSelect}
      />

      <div className="grid gap-3 rounded-[1.5rem] border border-base-300 bg-base-100/85 p-4 shadow-sm md:grid-cols-2">
        <div className="rounded-[1rem] bg-base-200/70 px-3 py-2">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-base-content/55">
            当前值
          </div>
          <div className="mt-1 text-sm font-medium">{formatDateLabel(selectedValue.value)}</div>
        </div>

        <div className="rounded-[1rem] bg-base-200/70 px-3 py-2">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-base-content/55">
            选择来源
          </div>
          <div className="mt-1 text-sm font-medium">{selectedSource.value}</div>
        </div>

        <div className="rounded-[1rem] bg-base-200/70 px-3 py-2 md:col-span-2">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-base-content/55">
            面板状态
          </div>
          <div className="mt-1 text-sm font-medium">{panelState.value}</div>
        </div>
      </div>

      <p className="m-0 text-xs text-base-content/70">
        日期范围被限制在 2026 年 4 至 5 月之间，适合产品排期、门店值班或发布窗口场景。
      </p>
    </div>
  )
}

export default BasicCalendarPreview
