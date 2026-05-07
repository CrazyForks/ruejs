/*
Select 组件概述
- 默认保持原生 select 语义与浏览器下拉行为；只有在传入前后缀、附加说明或清空能力时，才增加轻量 shell 包裹。
- `mode="multiple"` 默认进入紧凑下拉多选，已选项以标签形式展示；显式传入 `nativeSize` 或原生 `multiple` 时仍回退到浏览器 listbox。
- 支持 options / fieldNames / placeholder / allowClear / status / variant / 多选上限等增强能力，同时继续兼容原有 children 写法。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, ref, useRef, watch } from '@rue-js/rue'

export type SelectColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type SelectStatus = 'success' | 'warning' | 'error'
export type SelectVariant = 'outlined' | 'filled' | 'ghost' | 'borderless'

const selectSizeMap = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  small: 'sm',
  medium: 'md',
  middle: 'md',
  large: 'lg',
} as const

export type SelectVisualSize = keyof typeof selectSizeMap
type SelectResolvedSize = (typeof selectSizeMap)[SelectVisualSize]
type SelectSizeProp = SelectVisualSize | number | string
export type SelectValue = string | number
export type SelectRawValue = SelectValue | SelectValue[]

export interface SelectFieldNames {
  label?: string
  value?: string
  options?: string
  disabled?: string
  title?: string
  className?: string
  groupLabel?: string
}

export interface SelectOptionData {
  label?: any
  value?: SelectValue
  disabled?: boolean
  title?: string
  className?: string
  options?: SelectOptionData[]
  children?: any
  [key: string]: any
}

export interface SelectLabeledValue {
  value: SelectValue
  label: any
  key: SelectValue
  disabled?: boolean
  title?: string
}

export interface SelectResolvedOption {
  key: string
  value: SelectValue
  label: any
  disabled?: boolean
  title?: string
  className?: string
  groupLabel?: any
  raw?: SelectOptionData
}

export interface SelectChangeContext {
  values: SelectValue[]
  labels: any[]
  options: SelectResolvedOption[]
  nativeEvent: Event
}

export interface SelectProps {
  value?: SelectRawValue
  defaultValue?: SelectRawValue
  color?: SelectColor
  status?: SelectStatus
  variant?: SelectVariant
  size?: SelectSizeProp
  uiSize?: SelectVisualSize
  nativeSize?: number | string
  ghost?: boolean
  loading?: boolean
  loadingText?: any
  options?: SelectOptionData[]
  fieldNames?: SelectFieldNames
  placeholder?: any
  placeholderValue?: SelectValue | ''
  placeholderDisabled?: boolean
  notFoundContent?: any
  allowClear?: boolean
  clearLabel?: string
  onClear?: (event: MouseEvent) => void
  prefix?: any
  suffix?: any
  addonBefore?: any
  addonAfter?: any
  suffixIcon?: any
  showArrow?: boolean
  mode?: 'multiple'
  labelInValue?: boolean
  optionLabelProp?: string
  maxCount?: number
  onChange?: (event: Event) => void
  onValueChange?: (
    value: SelectValue | SelectValue[] | SelectLabeledValue | SelectLabeledValue[] | null,
    context: SelectChangeContext,
  ) => void
  onSelect?: (value: SelectValue | SelectLabeledValue, option: SelectResolvedOption, event: Event) => void
  onDeselect?: (value: SelectValue | SelectLabeledValue, option: SelectResolvedOption, event: Event) => void
  rootClassName?: string
  selectClassName?: string
  className?: string
  children?: any
  [key: string]: any
}

export interface SelectOptionProps {
  className?: string
  children?: any
  [key: string]: any
}

export interface SelectOptGroupProps {
  label: string
  className?: string
  children?: any
  [key: string]: any
}

export interface SelectShellProps {
  className?: string
  children?: any
  [key: string]: any
}

interface FlattenedSelectOption {
  key: string
  value?: SelectValue
  label?: any
  disabled?: boolean
  title?: string
  className?: string
  groupLabel?: any
  raw?: SelectOptionData
}

interface SelectResolvedOptionGroup {
  key: string
  label?: any
  options: SelectResolvedOption[]
}

const defaultFieldNames: Required<SelectFieldNames> = {
  label: 'label',
  value: 'value',
  options: 'options',
  disabled: 'disabled',
  title: 'title',
  className: 'className',
  groupLabel: 'label',
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const isVisualSize = (value?: SelectSizeProp): value is SelectVisualSize => {
  return typeof value === 'string' && value in selectSizeMap
}

const resolveVisualSize = (
  size?: SelectSizeProp,
  uiSize?: SelectVisualSize,
): SelectResolvedSize | undefined => {
  if (uiSize && isVisualSize(uiSize)) {
    return selectSizeMap[uiSize]
  }
  if (isVisualSize(size)) {
    return selectSizeMap[size]
  }
  return undefined
}

const resolveNativeSize = (size?: SelectSizeProp, nativeSize?: number | string) => {
  if (nativeSize !== undefined && nativeSize !== null) {
    return String(nativeSize)
  }
  if (typeof size === 'number') {
    return String(size)
  }
  if (typeof size === 'string' && size !== '' && !isVisualSize(size)) {
    return size
  }
  return undefined
}

const resolveSelectVariantClassName = (variant?: SelectVariant, ghost?: boolean) => {
  const resolvedVariant = ghost ? 'ghost' : variant
  switch (resolvedVariant) {
    case 'filled':
      return 'bg-base-200 border-base-300 shadow-none'
    case 'borderless':
      return 'select-ghost bg-transparent border-transparent shadow-none'
    case 'ghost':
      return 'select-ghost'
    default:
      return undefined
  }
}

const resolveShellVariantClassName = (variant?: SelectVariant, ghost?: boolean) => {
  const resolvedVariant = ghost ? 'ghost' : variant
  switch (resolvedVariant) {
    case 'filled':
      return 'bg-base-200 border-base-300 shadow-none'
    case 'borderless':
      return 'bg-transparent border-transparent shadow-none px-0'
    case 'ghost':
      return 'input-ghost'
    default:
      return undefined
  }
}

const buildSelectClassName = (
  color?: SelectColor,
  status?: SelectStatus,
  variant?: SelectVariant,
  size?: SelectSizeProp,
  uiSize?: SelectVisualSize,
  ghost?: boolean,
  className?: string,
) => {
  let cls = 'select'
  const resolvedColor = status ?? color
  const resolvedSize = resolveVisualSize(size, uiSize)
  const variantClassName = resolveSelectVariantClassName(variant, ghost)

  if (resolvedColor) cls += ` select-${resolvedColor}`
  if (resolvedSize) cls += ` select-${resolvedSize}`
  if (variantClassName) cls += ` ${variantClassName}`
  if (className) cls += ` ${className}`
  return cls
}

const buildShellClassName = (
  color?: SelectColor,
  status?: SelectStatus,
  variant?: SelectVariant,
  size?: SelectSizeProp,
  uiSize?: SelectVisualSize,
  ghost?: boolean,
  className?: string,
) => {
  let cls = 'input'
  const resolvedColor = status ?? color
  const resolvedSize = resolveVisualSize(size, uiSize)
  const variantClassName = resolveShellVariantClassName(variant, ghost)

  if (resolvedColor) cls += ` input-${resolvedColor}`
  if (resolvedSize) cls += ` input-${resolvedSize}`
  if (variantClassName) cls += ` ${variantClassName}`
  cls += ' flex items-center gap-2'
  if (className) cls += ` ${className}`
  return cls
}

const readOptionField = (
  option: SelectOptionData,
  field: keyof Required<SelectFieldNames>,
  fieldNames?: SelectFieldNames,
) => {
  const fieldName = fieldNames?.[field] ?? defaultFieldNames[field]
  return option[fieldName]
}

const flattenDataOptions = (
  options: SelectOptionData[],
  fieldNames?: SelectFieldNames,
  path = 'option',
  parentGroupLabel?: any,
): FlattenedSelectOption[] => {
  return options.flatMap((option, index) => {
    const optionPath = `${path}-${index}`
    const nestedOptions = readOptionField(option, 'options', fieldNames)
    const groupLabel = parentGroupLabel ?? readOptionField(option, 'groupLabel', fieldNames)

    if (Array.isArray(nestedOptions)) {
      const nextGroupLabel = readOptionField(option, 'groupLabel', fieldNames) ?? readOptionField(option, 'label', fieldNames)
      return flattenDataOptions(nestedOptions, fieldNames, optionPath, nextGroupLabel)
    }

    return [
      {
        key: optionPath,
        value: readOptionField(option, 'value', fieldNames),
        label: readOptionField(option, 'label', fieldNames) ?? option.children,
        disabled: readOptionField(option, 'disabled', fieldNames),
        title: readOptionField(option, 'title', fieldNames),
        className: readOptionField(option, 'className', fieldNames),
        groupLabel,
        raw: option,
      },
    ]
  })
}

const createOptionMetaMap = (options?: SelectOptionData[], fieldNames?: SelectFieldNames) => {
  const map: Record<string, FlattenedSelectOption> = {}

  if (!Array.isArray(options)) {
    return map
  }

  flattenDataOptions(options, fieldNames).forEach(option => {
    if (option.value === undefined || option.value === null) return
    map[String(option.value)] = option
  })

  return map
}

const renderDataOptions = (
  options: SelectOptionData[],
  fieldNames?: SelectFieldNames,
  path = 'option',
): any[] => {
  return options.map((option, index) => {
    const optionPath = `${path}-${index}`
    const nestedOptions = readOptionField(option, 'options', fieldNames)
    const className = readOptionField(option, 'className', fieldNames)
    const title = readOptionField(option, 'title', fieldNames)
    const disabled = readOptionField(option, 'disabled', fieldNames)

    if (Array.isArray(nestedOptions)) {
      const groupLabel = readOptionField(option, 'groupLabel', fieldNames) ?? readOptionField(option, 'label', fieldNames)
      return (
        <optgroup key={optionPath} label={String(groupLabel ?? '')} className={className} title={title}>
          {renderDataOptions(nestedOptions, fieldNames, optionPath)}
        </optgroup>
      )
    }

    const label = readOptionField(option, 'label', fieldNames) ?? option.children
    const value = readOptionField(option, 'value', fieldNames)

    return (
      <option
        key={value !== undefined && value !== null ? String(value) : optionPath}
        value={value as any}
        disabled={disabled}
        title={title}
        className={className}
      >
        {label ?? value}
      </option>
    )
  })
}

const isListboxSize = (nativeSizeValue?: string) => {
  if (!nativeSizeValue) return false
  const resolved = Number(nativeSizeValue)
  return Number.isFinite(resolved) && resolved > 1
}

let pendingCompactOpenRestoreKey: string | null = null
let pendingCompactOpenRestoreTimer: ReturnType<typeof setTimeout> | null = null
const COMPACT_OPEN_RESTORE_TIMEOUT = 160

const clearPendingCompactOpenRestore = () => {
  if (pendingCompactOpenRestoreTimer) {
    clearTimeout(pendingCompactOpenRestoreTimer)
    pendingCompactOpenRestoreTimer = null
  }

  pendingCompactOpenRestoreKey = null
}

const resolveCompactOpenRestoreKey = (root?: Element | null): string | null => {
  if (!root || typeof document === 'undefined') {
    return null
  }

  const segments: number[] = []
  let current: Element | null = root

  while (current && current !== document.body) {
    const parent = current.parentElement
    if (!parent) {
      return null
    }

    segments.push(Array.from(parent.children).indexOf(current))
    current = parent
  }

  if (current !== document.body) {
    return null
  }

  return segments.reverse().join('.')
}

const resolveCompactOpenPersistenceKey = (
  nativeProps: Record<string, any>,
  options: SelectOptionData[] | undefined,
  fieldNames: SelectFieldNames | undefined,
  placeholder: any,
  className?: string,
  selectClassName?: string,
) => {
  const explicitKey =
    nativeProps.id ?? nativeProps.name ?? nativeProps['data-testid'] ?? nativeProps['aria-label'] ?? nativeProps.title

  if (explicitKey !== undefined && explicitKey !== null && explicitKey !== '') {
    return `prop:${String(explicitKey)}`
  }

  if (!Array.isArray(options) || !options.length) {
    return null
  }

  const optionFingerprint = flattenDataOptions(options, fieldNames)
    .map(option => `${String(option.groupLabel ?? '')}>${String(option.value ?? option.label ?? '')}`)
    .join('|')
  const placeholderKey = placeholder !== undefined && placeholder !== null ? String(placeholder) : ''
  const classKey = [className, selectClassName].filter(Boolean).join('|')
  return `options:${placeholderKey}:${classKey}:${optionFingerprint}`
}

const markPendingCompactOpenRestore = (nextKey?: string | null) => {
  if (!nextKey) {
    return
  }

  clearPendingCompactOpenRestore()
  pendingCompactOpenRestoreKey = nextKey
  pendingCompactOpenRestoreTimer = setTimeout(() => {
    if (pendingCompactOpenRestoreKey === nextKey) {
      pendingCompactOpenRestoreKey = null
    }
    pendingCompactOpenRestoreTimer = null
  }, COMPACT_OPEN_RESTORE_TIMEOUT)
}

const consumePendingCompactOpenRestore = (nextKey?: string | null) => {
  if (!nextKey || !pendingCompactOpenRestoreKey) {
    return false
  }

  const matched = pendingCompactOpenRestoreKey === nextKey

  if (matched) {
    clearPendingCompactOpenRestore()
  }

  return matched
}

const resolveOptionLabel = (
  option: HTMLOptionElement,
  meta: FlattenedSelectOption | undefined,
  optionLabelProp?: string,
) => {
  if (optionLabelProp) {
    const rawValue = meta?.raw?.[optionLabelProp]
    if (rawValue !== undefined) return rawValue

    const attrValue = option.getAttribute(optionLabelProp)
    if (attrValue !== null) return attrValue

    const domValue = (option as any)[optionLabelProp]
    if (domValue !== undefined && domValue !== null && domValue !== '') {
      return domValue
    }
  }

  if (meta?.label !== undefined) return meta.label
  return option.textContent ?? option.label ?? option.value
}

const resolveOptionValue = (option: HTMLOptionElement, meta: FlattenedSelectOption | undefined) => {
  if (meta?.value !== undefined && meta.value !== null) {
    return meta.value
  }
  return option.value
}

const toLabeledValue = (
  option: HTMLOptionElement,
  meta: FlattenedSelectOption | undefined,
  optionLabelProp?: string,
): SelectLabeledValue => {
  const value = resolveOptionValue(option, meta)
  return {
    value,
    key: value,
    label: resolveOptionLabel(option, meta, optionLabelProp),
    disabled: meta?.disabled ?? option.disabled,
    title: meta?.title ?? option.title,
  }
}

const toResolvedOption = (
  option: HTMLOptionElement,
  meta: FlattenedSelectOption | undefined,
  optionLabelProp?: string,
): SelectResolvedOption => {
  const labeledValue = toLabeledValue(option, meta, optionLabelProp)
  return {
    key: option.value,
    value: labeledValue.value,
    label: labeledValue.label,
    disabled: labeledValue.disabled,
    title: labeledValue.title,
    className: meta?.className,
    groupLabel: meta?.groupLabel,
    raw: meta?.raw,
  }
}

const buildChangeState = (
  select: HTMLSelectElement,
  optionMetaMap: Record<string, FlattenedSelectOption>,
  optionLabelProp?: string,
  labelInValue?: boolean,
) => {
  const selectedOptions = Array.from(select.selectedOptions) as HTMLOptionElement[]
  const resolvedOptions = selectedOptions.map(option => {
    return toResolvedOption(option, optionMetaMap[option.value], optionLabelProp)
  })

  const values = resolvedOptions.map(option => option.value)
  const labels = resolvedOptions.map(option => option.label)
  const semanticValues = labelInValue
    ? selectedOptions.map(option => toLabeledValue(option, optionMetaMap[option.value], optionLabelProp))
    : values

  return {
    values,
    labels,
    options: resolvedOptions,
    payload: select.multiple ? semanticValues : semanticValues[0] ?? null,
  }
}

const clampSelectionToMaxCount = (
  select: HTMLSelectElement,
  previousValues: string[],
  maxCount?: number,
) => {
  if (!select.multiple || !maxCount || maxCount <= 0) {
    return Array.from(select.selectedOptions).map(option => option.value)
  }

  const currentValues = Array.from(select.selectedOptions).map(option => option.value)
  if (currentValues.length <= maxCount) {
    return currentValues
  }

  const keptValues: string[] = []
  currentValues.forEach(value => {
    if (previousValues.includes(value) && !keptValues.includes(value) && keptValues.length < maxCount) {
      keptValues.push(value)
    }
  })

  currentValues.forEach(value => {
    if (!keptValues.includes(value) && keptValues.length < maxCount) {
      keptValues.push(value)
    }
  })

  const allowedValues = new Set(keptValues)
  Array.from(select.options).forEach(option => {
    option.selected = allowedValues.has(option.value)
  })

  return Array.from(select.selectedOptions).map(option => option.value)
}

const findOptionElementByValue = (select: HTMLSelectElement, value: string) => {
  return Array.from(select.options).find(option => option.value === value) as HTMLOptionElement | undefined
}

const normalizeSelectValues = (value?: SelectRawValue) => {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value.map(item => String(item)) : [String(value)]
}

const groupResolvedOptions = (options: SelectResolvedOption[]) => {
  const groups: SelectResolvedOptionGroup[] = []
  const groupMap = new Map<string, SelectResolvedOptionGroup>()
  const ungrouped: SelectResolvedOption[] = []

  options.forEach(option => {
    if (option.groupLabel === undefined || option.groupLabel === null || option.groupLabel === '') {
      ungrouped.push(option)
      return
    }

    const key = String(option.groupLabel)
    let group = groupMap.get(key)
    if (!group) {
      group = {
        key,
        label: option.groupLabel,
        options: [],
      }
      groupMap.set(key, group)
      groups.push(group)
    }
    group.options.push(option)
  })

  if (ungrouped.length) {
    groups.unshift({
      key: '__ungrouped__',
      options: ungrouped,
    })
  }

  return groups
}

const toResolvedOptionFromFlat = (option: FlattenedSelectOption): SelectResolvedOption => {
  const value = option.value ?? option.key
  return {
    key: String(value),
    value,
    label: option.label ?? value,
    disabled: option.disabled,
    title: option.title,
    className: option.className,
    groupLabel: option.groupLabel,
    raw: option.raw,
  }
}

const DefaultChevron: FC = () => {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60">
      <path
        d="M6 8.5L10 12.5L14 8.5"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

const Shell: FC<SelectShellProps> = ({ className, children, ...rest }) => {
  return (
    <label {...rest} className={mergeClassName('input', className)}>
      {children}
    </label>
  )
}

const Option: FC<SelectOptionProps> = ({ className, children, ...rest }) => {
  return (
    <option {...rest} className={className}>
      {children}
    </option>
  )
}

const OptGroup: FC<SelectOptGroupProps> = ({ label, className, children, ...rest }) => {
  return (
    <optgroup {...rest} label={label} className={className}>
      {children}
    </optgroup>
  )
}

type SelectCompound = FC<SelectProps> & {
  Option: FC<SelectOptionProps>
  OptGroup: FC<SelectOptGroupProps>
  Shell: FC<SelectShellProps>
}

const SelectRoot: FC<SelectProps> = ({
  value,
  defaultValue,
  color,
  status,
  variant,
  size,
  uiSize,
  nativeSize,
  ghost,
  loading,
  loadingText,
  options,
  fieldNames,
  placeholder,
  placeholderValue = '',
  placeholderDisabled = true,
  notFoundContent,
  allowClear,
  clearLabel = '清空选择',
  onClear,
  prefix,
  suffix,
  addonBefore,
  addonAfter,
  suffixIcon,
  showArrow = true,
  mode,
  labelInValue,
  optionLabelProp,
  maxCount,
  onChange,
  onValueChange,
  onSelect,
  onDeselect,
  rootClassName,
  selectClassName,
  className,
  children,
  multiple,
  disabled,
  ...rest
}) => {
  const rootRef = useRef<HTMLDivElement>()
  const selectRef = useRef<HTMLSelectElement>()
  const compactTriggerRef = useRef<HTMLDivElement>()
  const compactValueAreaRef = useRef<HTMLDivElement>()
  const compactPopupRef = useRef<HTMLDivElement>()
  const previousSelectedValuesRef = useRef<string[]>([])
  const nativeProps = rest as Record<string, any>
  const hasOptions = Array.isArray(options) && options.length > 0
  const hasChildren = children !== undefined && children !== null
  const initialCompactResolvedOptions = hasOptions
    ? flattenDataOptions(options!, fieldNames).map(option => toResolvedOptionFromFlat(option))
    : []
  const compactRenderVersion = ref(0)
  const compactSelectedValues = ref<string[]>(normalizeSelectValues(value !== undefined ? value : defaultValue))
  const compactResolvedOptions = ref<SelectResolvedOption[]>(initialCompactResolvedOptions)
  const mergedDisabled = !!disabled || !!loading
  const isNativeMultiple = !!multiple
  const isEnhancedMultiple = mode === 'multiple'
  const mergedMultiple = isNativeMultiple || isEnhancedMultiple
  const nativeSizeValue = resolveNativeSize(size, nativeSize)
  const shouldRenderListbox = isNativeMultiple || isListboxSize(nativeSizeValue)
  const useCompactMultiple = isEnhancedMultiple && !shouldRenderListbox
  const compactPersistenceKey = useCompactMultiple
    ? resolveCompactOpenPersistenceKey(nativeProps, options, fieldNames, placeholder, className, selectClassName)
    : null
  const compactOpenRef = useRef(compactPersistenceKey !== null && pendingCompactOpenRestoreKey === compactPersistenceKey)
  const hasShellDecorators =
    prefix !== undefined ||
    suffix !== undefined ||
    addonBefore !== undefined ||
    addonAfter !== undefined ||
    !!allowClear ||
    !!loading ||
    suffixIcon !== undefined
  const useShell = useCompactMultiple || (hasShellDecorators && !shouldRenderListbox)
  const optionMetaMap = createOptionMetaMap(options, fieldNames)
  const renderedOptions = hasOptions ? renderDataOptions(options!, fieldNames) : children
  const loadingOptionContent = loadingText ?? '正在加载...'
  const emptyOptionContent = notFoundContent ?? '暂无可选项'
  const compactPlaceholder = placeholder ?? 'Select options'
  const isCompactOpen = () => compactOpenRef.current === true

  const setCompactOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      clearPendingCompactOpenRestore()
    }

    if (compactOpenRef.current === nextOpen) {
      return
    }

    compactOpenRef.current = nextOpen
    syncCompactOpenDom()
  }

  const preserveCompactOpenAcrossUpdate = () => {
    if (!useCompactMultiple || !isCompactOpen()) {
      return
    }

    markPendingCompactOpenRestore(compactPersistenceKey ?? resolveCompactOpenRestoreKey(rootRef.current))
  }

  const restorePendingCompactOpen = () => {
    if (
      !useCompactMultiple ||
      !consumePendingCompactOpenRestore(compactPersistenceKey ?? resolveCompactOpenRestoreKey(rootRef.current))
    ) {
      return
    }

    compactOpenRef.current = true
    syncCompactOpenDom()
  }

  const getCompactSelectedOptions = () => {
    return compactSelectedValues.value
      .map(selectedValue => {
        return compactResolvedOptions.value.find(option => String(option.value) === selectedValue)
      })
      .filter(Boolean) as SelectResolvedOption[]
  }

  const syncCompactValueAreaDom = () => {
    const container = compactValueAreaRef.current
    if (!container || typeof document === 'undefined') return

    const selectedOptions = getCompactSelectedOptions()
    container.replaceChildren()

    if (!selectedOptions.length) {
      const placeholderNode = document.createElement('span')
      placeholderNode.className = 'truncate text-sm text-base-content/40'
      placeholderNode.textContent = String(compactPlaceholder)
      container.appendChild(placeholderNode)
      return
    }

    selectedOptions.forEach(option => {
      const optionValue = String(option.value)
      const chip = document.createElement('span')
      chip.className = 'inline-flex max-w-full items-center gap-1 rounded-md bg-base-200 px-2 py-1 text-xs text-base-content'

      const labelNode = document.createElement('span')
      labelNode.className = 'truncate'
      labelNode.textContent = String(option.label ?? option.value)
      chip.appendChild(labelNode)

      if (!mergedDisabled) {
        const removeButton = document.createElement('button')
        removeButton.type = 'button'
        removeButton.className = 'btn btn-ghost btn-xs h-4 min-h-0 w-4 rounded-full p-0 text-[10px]'
        removeButton.setAttribute('aria-label', `移除 ${String(option.label ?? option.value)}`)
        removeButton.textContent = '×'
        removeButton.addEventListener('click', event => {
          removeCompactOption(optionValue, event as MouseEvent)
        })
        chip.appendChild(removeButton)
      }

      container.appendChild(chip)
    })
  }

  const syncCompactPopupDom = () => {
    const popup = compactPopupRef.current
    if (!popup) return

    const selectedValueSet = new Set(compactSelectedValues.value)
    Array.from(popup.querySelectorAll('[data-rue-select-option]')).forEach(node => {
      const button = node as HTMLButtonElement
      const optionValue = button.getAttribute('data-rue-select-option') ?? ''
      const selected = selectedValueSet.has(optionValue)
      button.setAttribute('aria-selected', selected ? 'true' : 'false')
      button.classList.toggle('bg-primary/10', selected)
      button.classList.toggle('text-primary', selected)
      button.classList.toggle('hover:bg-base-200', !selected && !button.disabled)

      const checkNode = button.querySelector('[data-rue-select-check="true"]') as HTMLElement | null
      if (checkNode) {
        checkNode.classList.toggle('opacity-100', selected)
        checkNode.classList.toggle('opacity-0', !selected)
      }
    })
  }

  const syncCompactOpenDom = () => {
    const open = isCompactOpen()
    const trigger = compactTriggerRef.current
    if (trigger) {
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
      trigger.classList.toggle('ring', open)
      trigger.classList.toggle('ring-primary/15', open)
    }

    const popup = compactPopupRef.current
    if (!popup) return
    popup.hidden = !open
    popup.setAttribute('aria-hidden', open ? 'false' : 'true')
  }

  const syncCompactStateFromDom = () => {
    const select = selectRef.current
    if (!select) return

    compactSelectedValues.value = Array.from(select.selectedOptions).map(option => option.value)
    compactResolvedOptions.value = Array.from(select.options).map(option => {
      return toResolvedOption(option, optionMetaMap[option.value], optionLabelProp)
    })
    compactRenderVersion.value += 1
    syncCompactOpenDom()
    syncCompactValueAreaDom()
    syncCompactPopupDom()
  }

  const syncSelectionToDom = (nextValues: string[]) => {
    const select = selectRef.current
    if (!select) return

    if (select.multiple) {
      const selectedValueSet = new Set(nextValues)
      Array.from(select.options).forEach(option => {
        option.selected = selectedValueSet.has(option.value)
      })
      return
    }

    select.value = nextValues[0] ?? ''
  }

  const syncSelectionFromProps = () => {
    const sourceValue = value !== undefined ? value : defaultValue
    if (sourceValue === undefined) {
      syncCompactStateFromDom()
      return
    }

    syncSelectionToDom(normalizeSelectValues(sourceValue))
    syncCompactStateFromDom()
  }

  const syncSelectedSnapshot = () => {
    if (!selectRef.current) return
    previousSelectedValuesRef.current = Array.from(selectRef.current.selectedOptions).map(option => option.value)
  }

  const emitSemanticCallbacks = (event: Event) => {
    const select = selectRef.current
    if (!select) return

    const previousValues = (previousSelectedValuesRef.current ?? []).slice()
    const nextValues = clampSelectionToMaxCount(select, previousValues, maxCount)
    const changeState = buildChangeState(select, optionMetaMap, optionLabelProp, labelInValue)
    const nextValueKeys = nextValues.map(current => String(current))
    const addedValues = nextValueKeys.filter(current => !previousValues.includes(current))
    const removedValues = previousValues.filter(current => !nextValueKeys.includes(current))

    if (onValueChange) {
      onValueChange(changeState.payload, {
        values: changeState.values,
        labels: changeState.labels,
        options: changeState.options,
        nativeEvent: event,
      })
    }

    if (onSelect) {
      addedValues.forEach(valueKey => {
        const option = findOptionElementByValue(select, valueKey)
        if (!option) return
        const resolvedOption = toResolvedOption(option, optionMetaMap[valueKey], optionLabelProp)
        const semanticValue = labelInValue
          ? toLabeledValue(option, optionMetaMap[valueKey], optionLabelProp)
          : resolvedOption.value
        onSelect(semanticValue, resolvedOption, event)
      })
    }

    if (onDeselect) {
      removedValues.forEach(valueKey => {
        const option = findOptionElementByValue(select, valueKey)
        if (!option) return
        const resolvedOption = toResolvedOption(option, optionMetaMap[valueKey], optionLabelProp)
        const semanticValue = labelInValue
          ? toLabeledValue(option, optionMetaMap[valueKey], optionLabelProp)
          : resolvedOption.value
        onDeselect(semanticValue, resolvedOption, event)
      })
    }

    previousSelectedValuesRef.current = nextValueKeys
  }

  const handleChange = (event: Event) => {
    emitSemanticCallbacks(event)
    syncCompactStateFromDom()
    if (onChange) {
      onChange(event)
    }
  }

  const dispatchNativeSelectionChange = () => {
    const select = selectRef.current
    if (!select) return
    select.dispatchEvent(new Event('input', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const toggleCompactOption = (optionValue: string, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const select = selectRef.current
    if (!select || mergedDisabled) {
      return
    }

    const option = findOptionElementByValue(select, optionValue)
    if (!option || option.disabled) {
      return
    }

    option.selected = !option.selected
    syncCompactStateFromDom()
    preserveCompactOpenAcrossUpdate()
    dispatchNativeSelectionChange()
  }

  const removeCompactOption = (optionValue: string, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const select = selectRef.current
    if (!select || mergedDisabled) {
      return
    }

    const option = findOptionElementByValue(select, optionValue)
    if (!option || option.disabled || !option.selected) {
      return
    }

    option.selected = false
    syncCompactStateFromDom()
    preserveCompactOpenAcrossUpdate()
    dispatchNativeSelectionChange()
  }

  const handleCompactTriggerClick = (event: MouseEvent) => {
    event.preventDefault()
    if (mergedDisabled) return
    if (isCompactOpen()) return
    setCompactOpen(true)
  }

  const handleCompactTriggerKeyDown = (event: KeyboardEvent) => {
    if (mergedDisabled) return

    if (event.key === 'Escape') {
      setCompactOpen(false)
      return
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault()
      setCompactOpen(true)
    }
  }

  const clearSelection = (event: MouseEvent) => {
    const select = selectRef.current

    if (!select || mergedDisabled) {
      return
    }

    if (select.multiple) {
      Array.from(select.options).forEach(option => {
        option.selected = false
      })
    } else if (placeholder !== undefined && placeholder !== null) {
      select.value = String(placeholderValue)
    } else {
      select.selectedIndex = -1
      select.value = ''
    }

    syncCompactStateFromDom()
    preserveCompactOpenAcrossUpdate()
    dispatchNativeSelectionChange()

    if (onClear) {
      onClear(event)
    }
  }

  onMounted(() => {
    syncSelectionFromProps()
    syncSelectedSnapshot()
    syncCompactStateFromDom()
    restorePendingCompactOpen()

    if (typeof window === 'undefined') return

    const handleWindowPointerDown = (event: PointerEvent) => {
      if (!isCompactOpen()) return
      const target = event.target as Node | null
      if (!target) return
      if (rootRef.current?.contains(target)) return
      setCompactOpen(false)
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!isCompactOpen() || event.key !== 'Escape') return
      setCompactOpen(false)
    }

    window.addEventListener('pointerdown', handleWindowPointerDown, true)
    window.addEventListener('keydown', handleWindowKeyDown)

    onUnmounted(() => {
      window.removeEventListener('pointerdown', handleWindowPointerDown, true)
      window.removeEventListener('keydown', handleWindowKeyDown)
    })
  })

  watch(
    () => value,
    () => {
      syncSelectionFromProps()
      syncSelectedSnapshot()
      syncCompactStateFromDom()
      restorePendingCompactOpen()
    },
    { immediate: true },
  )

  watch(
    () => defaultValue,
    () => {
      syncSelectionFromProps()
      syncSelectedSnapshot()
      syncCompactStateFromDom()
      restorePendingCompactOpen()
    },
  )

  watch(
    () => options,
    () => {
      syncSelectionFromProps()
      syncSelectedSnapshot()
      syncCompactStateFromDom()
      restorePendingCompactOpen()
    },
  )

  watch(
    () => children,
    () => {
      syncSelectionFromProps()
      syncSelectedSnapshot()
      syncCompactStateFromDom()
      restorePendingCompactOpen()
    },
  )

  const baseSelectClassName = buildSelectClassName(color, status, variant, size, uiSize, ghost, className)
  const shellClassName = buildShellClassName(color, status, variant, size, uiSize, ghost, className)
  const resolvedArrow = showArrow ? suffixIcon ?? <DefaultChevron /> : suffixIcon
  const compactSelectedOptions = getCompactSelectedOptions()
  const compactGroups = groupResolvedOptions(compactResolvedOptions.value)

  const selectNode = (
    <select
      {...rest}
      {...(nativeSizeValue !== undefined ? { size: nativeSizeValue } : {})}
      {...(mergedMultiple ? { multiple: true } : {})}
      {...(mergedDisabled ? { disabled: true } : {})}
      {...(defaultValue !== undefined ? { defaultValue: defaultValue as any } : {})}
      {...(value !== undefined ? { value: value as any } : {})}
      ref={selectRef}
      tabIndex={useCompactMultiple ? -1 : rest.tabIndex}
      aria-hidden={useCompactMultiple ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      className={
        useCompactMultiple
          ? mergeClassName('pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0', selectClassName)
          : useShell
          ? mergeClassName(
              'min-w-0 grow appearance-none border-none bg-transparent pr-1 text-base-content outline-none',
              selectClassName,
            )
          : mergeClassName(baseSelectClassName, selectClassName)
      }
      onChange={handleChange}
    >
      {!mergedMultiple && placeholder !== undefined && placeholder !== null ? (
        <option value={placeholderValue as any} disabled={placeholderDisabled}>
          {placeholder}
        </option>
      ) : null}
      {renderedOptions}
      {loading && !hasOptions && !hasChildren ? <option disabled={true}>{loadingOptionContent}</option> : null}
      {!loading && !hasOptions && !hasChildren ? <option disabled={true}>{emptyOptionContent}</option> : null}
    </select>
  )

  if (!useShell) {
    return selectNode
  }

  if (useCompactMultiple) {
    return (
      <div
        ref={rootRef}
        className={mergeClassName('relative', rootClassName)}
        data-rue-select-root="true"
        aria-disabled={mergedDisabled ? 'true' : undefined}
      >
        {selectNode}
        <div
          ref={compactTriggerRef}
          className={mergeClassName(
            mergeClassName(shellClassName, 'flex min-h-12 items-center gap-2 py-2'),
            isCompactOpen() ? 'ring ring-primary/15' : undefined,
          )}
          role="button"
          tabIndex={mergedDisabled ? -1 : 0}
          aria-haspopup="listbox"
          aria-expanded={isCompactOpen() ? 'true' : 'false'}
          data-rue-select-trigger="true"
          data-rue-select-version={String(compactRenderVersion.value)}
          onClick={handleCompactTriggerClick}
          onKeyDown={handleCompactTriggerKeyDown}
        >
          {addonBefore !== undefined ? <span className="shrink-0 text-sm text-base-content/60">{addonBefore}</span> : null}
          {prefix !== undefined ? <span className="shrink-0 text-sm text-base-content/60">{prefix}</span> : null}
          <div ref={compactValueAreaRef} className="flex min-w-0 flex-1 flex-wrap items-center gap-1" />
          {!loading && allowClear && compactSelectedOptions.length ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle shrink-0"
              aria-label={clearLabel}
              onClick={(event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
                clearSelection(event)
              }}
              disabled={mergedDisabled}
            >
              ×
            </button>
          ) : null}
          {loading ? <span className="loading loading-spinner loading-xs shrink-0" aria-hidden="true" /> : null}
          {suffix !== undefined ? <span className="shrink-0 text-sm text-base-content/60">{suffix}</span> : null}
          {resolvedArrow !== undefined && resolvedArrow !== null ? (
            <span className="pointer-events-none flex shrink-0 items-center text-base-content/70">{resolvedArrow}</span>
          ) : null}
          {addonAfter !== undefined ? <span className="shrink-0 text-sm text-base-content/60">{addonAfter}</span> : null}
        </div>
        <div
          ref={compactPopupRef}
          className="absolute z-30 mt-2 w-full rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
          data-rue-select-popup="true"
          aria-hidden={isCompactOpen() ? 'false' : 'true'}
          hidden={!isCompactOpen()}
        >
          <div role="listbox" aria-multiselectable="true" className="max-h-72 space-y-2 overflow-auto">
            {compactGroups.map(group => (
              <div key={group.key} className="space-y-1">
                {group.label !== undefined ? (
                  <div className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">
                    {group.label}
                  </div>
                ) : null}
                {group.options.map(option => {
                  const optionValue = String(option.value)
                  const selected = compactSelectedValues.value.includes(optionValue)
                  return (
                    <button
                      key={optionValue}
                      type="button"
                      className={mergeClassName(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition',
                        option.disabled
                          ? 'cursor-not-allowed opacity-50'
                          : selected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-base-200',
                      )}
                      data-rue-select-option={optionValue}
                      aria-selected={selected ? 'true' : 'false'}
                      disabled={option.disabled}
                      onClick={(event: MouseEvent) => {
                        toggleCompactOption(optionValue, event)
                      }}
                    >
                      <span className="truncate">{option.label ?? option.value}</span>
                      <span data-rue-select-check="true" className={selected ? 'opacity-100' : 'opacity-0'}>✓</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={mergeClassName(shellClassName, rootClassName)}
      data-rue-select-root="true"
      aria-disabled={mergedDisabled ? 'true' : undefined}
    >
      {addonBefore !== undefined ? <span className="shrink-0 text-sm text-base-content/60">{addonBefore}</span> : null}
      {prefix !== undefined ? <span className="shrink-0 text-sm text-base-content/60">{prefix}</span> : null}
      {selectNode}
      {!loading && allowClear ? (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-circle inline-flex shrink-0 items-center justify-center self-center"
          aria-label={clearLabel}
          onClick={clearSelection}
          disabled={mergedDisabled}
        >
          ×
        </button>
      ) : null}
      {loading ? (
        <span className="loading loading-spinner loading-xs shrink-0 self-center" aria-hidden="true" />
      ) : null}
      {suffix !== undefined ? (
        <span className="inline-flex shrink-0 items-center self-center text-sm text-base-content/60">{suffix}</span>
      ) : null}
      {resolvedArrow !== undefined && resolvedArrow !== null ? (
        <span className="pointer-events-none inline-flex shrink-0 items-center self-center text-base-content/70">
          {resolvedArrow}
        </span>
      ) : null}
      {addonAfter !== undefined ? <span className="shrink-0 text-sm text-base-content/60">{addonAfter}</span> : null}
    </div>
  )
}

const Select: SelectCompound = Object.assign(SelectRoot, {
  Option,
  OptGroup,
  Shell,
})

export default Select
