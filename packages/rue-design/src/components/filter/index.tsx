/* RUE_VAPOR_TRANSFORMED */
/*
Filter 组件概述
- 保留 Rue 当前基于 daisyUI `filter + btn` 的视觉组合。
- 同时支持旧的 `children + Filter.Item/Reset` 方式，以及 `items/value/onChange/reset` 的增强用法。
- 组内状态通过轻量 DOM 同步完成，避免依赖运行时不稳定的 context 能力。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, ref, useRef, watch } from '@rue-js/rue'

/** FilterMode 类型。 */
export type FilterMode = 'form' | 'div'
/** FilterInputType 视觉或语义变体类型。 */
export type FilterInputType = 'radio' | 'checkbox'
/** FilterTone 语义色类型。 */
export type FilterTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
/** FilterColor 语义色类型。 */
export type FilterColor = 'default' | 'danger' | FilterTone
/** FilterVariant 视觉或语义变体类型。 */
export type FilterVariant = 'solid' | 'filled' | 'outlined' | 'dashed' | 'text'
/** FilterSize 尺寸类型。 */
export type FilterSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'medium' | 'middle' | 'large'
/** FilterValue 值类型。 */
export type FilterValue = string | number | boolean

/** FilterItemChangeMeta 接口。 */
export interface FilterItemChangeMeta {
  /** 受控选中状态。 */
  checked: boolean
  /** 受控值。 */
  value?: FilterValue
  /** item 区域配置。 */
  item?: FilterItemData
}

/** FilterChangeMeta 接口。 */
export interface FilterChangeMeta extends FilterItemChangeMeta {
  /** values 配置项。 */
  values: FilterValue[]
}

/** FilterItemData 数据项结构。 */
export interface FilterItemData {
  /** 数据项唯一标识。 */
  key?: string | number
  /** 展示标签。 */
  label?: any
  /** 受控值。 */
  value?: FilterValue
  /** 受控选中状态。 */
  checked?: boolean
  /** 非受控初始选中状态。 */
  defaultChecked?: boolean
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 组件语义色。 */
  color?: FilterColor
  /** 组件尺寸。 */
  size?: FilterSize
  /** 组件视觉变体。 */
  variant?: FilterVariant
  /** 是否处于激活态。 */
  active?: boolean
  /** 标题内容。 */
  title?: string
  /** 表单 name 属性或分组名称。 */
  name?: string
  /** 组件类型或语义类型。 */
  type?: FilterInputType
  /** 值或状态变化时触发的回调。 */
  onChange?: (event: Event, meta: FilterItemChangeMeta) => void
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** FilterProps 组件属性。 */
export interface FilterProps {
  /** 自定义渲染的宿主元素。 */
  as?: FilterMode
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: any
  /** 组件子内容。 */
  children?: any
  /** 数据驱动渲染项。 */
  items?: ReadonlyArray<FilterItemData | FilterValue>
  /** 表单 name 属性或分组名称。 */
  name?: string
  /** 组件类型或语义类型。 */
  type?: FilterInputType
  /** multiple 配置项。 */
  multiple?: boolean
  /** 受控值。 */
  value?: FilterValue | ReadonlyArray<FilterValue>
  /** 非受控初始值。 */
  defaultValue?: FilterValue | ReadonlyArray<FilterValue>
  /** 值或状态变化时触发的回调。 */
  onChange?: (
    value: FilterValue | FilterValue[] | undefined,
    event: Event,
    meta: FilterChangeMeta,
  ) => void
  /** 组件尺寸。 */
  size?: FilterSize
  /** 组件语义色。 */
  color?: FilterColor
  /** 组件视觉变体。 */
  variant?: FilterVariant
  /** 是否禁用交互。 */
  disabled?: boolean
  /** itemClassName 附加类名。 */
  itemClassName?: string
  /** reset 配置项。 */
  reset?: boolean | FilterResetProps
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** FilterItemProps 组件属性。 */
export interface FilterItemProps extends FilterItemData {}

/** FilterResetProps 组件属性。 */
export interface FilterResetProps {
  /** mode 配置项。 */
  mode?: FilterMode
  /** 展示标签。 */
  label?: any
  /** 受控选中状态。 */
  checked?: boolean
  /** 非受控初始选中状态。 */
  defaultChecked?: boolean
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 组件语义色。 */
  color?: FilterColor
  /** 组件尺寸。 */
  size?: FilterSize
  /** 组件视觉变体。 */
  variant?: FilterVariant
  /** 值或状态变化时触发的回调。 */
  onChange?: (event: Event) => void
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

let filterNameSeed = 0

/** merge Class Names 的内部工具函数。 */
const mergeClassNames = (...values: Array<string | undefined>) => {
  return values.filter(Boolean).join(' ').trim()
}

/** omit Nullish Props 的内部工具函数。 */
const omitNullishProps = <T extends Record<string, any>>(values: T) => {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value != null),
  ) as Partial<T>
}

/** 解析 Size Token 的内部工具函数。 */
const resolveSizeToken = (size?: FilterSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'medium':
    case 'middle':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

/** serialize Value 的内部工具函数。 */
const serializeValue = (value: FilterValue) => {
  switch (typeof value) {
    case 'number':
      return `number:${value}`
    case 'boolean':
      return `boolean:${value ? 'true' : 'false'}`
    default:
      return `string:${value}`
  }
}

/** deserialize Value 的内部工具函数。 */
const deserializeValue = (serialized?: string): FilterValue | undefined => {
  if (!serialized) return undefined
  const separatorIndex = serialized.indexOf(':')
  if (separatorIndex === -1) return serialized
  const type = serialized.slice(0, separatorIndex)
  const rawValue = serialized.slice(separatorIndex + 1)
  if (type === 'number') return Number(rawValue)
  if (type === 'boolean') return rawValue === 'true'
  return rawValue
}

/** 判断 Primitive Value 的内部工具函数。 */
const isPrimitiveValue = (value: any): value is FilterValue => {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

/** unique Values 的内部工具函数。 */
const uniqueValues = (values: ReadonlyArray<FilterValue>) => {
  const next: FilterValue[] = []
  values.forEach(value => {
    if (!next.some(current => serializeValue(current) === serializeValue(value))) {
      next.push(value)
    }
  })
  return next
}

/** 归一化 Value List 的内部工具函数。 */
const normalizeValueList = (
  value: FilterValue | ReadonlyArray<FilterValue> | undefined,
  type: FilterInputType,
) => {
  if (value === undefined) return []
  if (Array.isArray(value)) {
    return type === 'checkbox' ? uniqueValues(value) : value.length ? [value[0]] : []
  }
  return [value]
}

/** 归一化 Items 的内部工具函数。 */
const normalizeItems = (items?: ReadonlyArray<FilterItemData | FilterValue>): FilterItemData[] => {
  return (items ?? []).map((item, index) => {
    if (isPrimitiveValue(item)) {
      return {
        key: `${serializeValue(item)}-${index}`,
        label: String(item),
        value: item,
      }
    }

    const label = item.label ?? item['aria-label']
    const fallbackKey =
      item.key ??
      (item.value !== undefined
        ? serializeValue(item.value)
        : typeof label === 'string' || typeof label === 'number' || typeof label === 'boolean'
          ? String(label)
          : `item-${index}`)

    return {
      ...item,
      key: fallbackKey,
    }
  })
}

/** 解析 Variant Class Name 的内部工具函数。 */
const resolveVariantClassName = (variant?: FilterVariant) => {
  switch (variant) {
    case 'outlined':
      return 'btn-outline'
    case 'dashed':
      return 'btn-dash'
    case 'filled':
      return 'btn-soft'
    case 'text':
      return 'btn-ghost'
    default:
      return undefined
  }
}

/** 解析 Button Class Name 的内部工具函数。 */
const resolveButtonClassName = ({
  color,
  size,
  variant,
  active,
  className,
}: {
  color?: FilterColor
  size?: FilterSize
  variant?: FilterVariant
  active?: boolean
  className?: string
}) => {
  let cls = 'btn'
  const resolvedSize = resolveSizeToken(size)
  const resolvedVariant = resolveVariantClassName(variant)

  if (color && color !== 'default') {
    cls += ` btn-${color === 'danger' ? 'error' : color}`
  }
  if (resolvedSize) cls += ` btn-${resolvedSize}`
  if (resolvedVariant) cls += ` ${resolvedVariant}`
  if (active) cls += ' btn-active'
  if (className) cls += ` ${className}`
  return cls
}

/** 解析 Item Label 的内部工具函数。 */
const resolveItemLabel = (label: any, fallbackChildren?: any) => {
  if (label !== undefined) return label
  return fallbackChildren
}

/** 解析 Item Value 的内部工具函数。 */
const resolveItemValue = (props: {
  value?: FilterValue
  label?: any
  ['aria-label']?: any
  children?: any
}) => {
  if (props.value !== undefined) return props.value
  const label = resolveItemLabel(props.label ?? props['aria-label'], props.children)
  return isPrimitiveValue(label) ? label : undefined
}

/** read Input String 的内部工具函数。 */
const readInputString = (input: HTMLInputElement, key: string) => {
  const value = input.dataset[key as keyof DOMStringMap]
  if (!value || !value.length || value === 'undefined' || value === 'null') {
    return undefined
  }
  return value
}

/** read Input Config 的内部工具函数。 */
const readInputConfig = (input: HTMLInputElement) => {
  return {
    role: readInputString(input, 'rueFilterRole'),
    mode: readInputString(input, 'rueFilterMode') as FilterMode | undefined,
    type: readInputString(input, 'rueFilterType') as FilterInputType | undefined,
    name: readInputString(input, 'rueFilterName'),
    size: readInputString(input, 'rueFilterSize') as FilterSize | undefined,
    color: readInputString(input, 'rueFilterColor') as FilterColor | undefined,
    variant: readInputString(input, 'rueFilterVariant') as FilterVariant | undefined,
    className: readInputString(input, 'rueFilterClassName'),
    active: input.dataset.rueFilterActive === 'true',
    disabled: input.dataset.rueFilterDisabled === 'true',
    value: deserializeValue(readInputString(input, 'rueFilterValue')),
  }
}

/** Filter 的内部工具函数。 */
const Filter: FC<FilterProps> = ({
  as = 'form',
  className,
  style,
  children,
  items,
  name,
  type,
  multiple,
  value,
  defaultValue,
  onChange,
  size,
  color,
  variant,
  disabled,
  itemClassName,
  reset,
  onReset,
  ...rest
}) => {
  const Component = as as any
  const groupRef = useRef<HTMLElement>()
  const observerRef = useRef<MutationObserver>()
  const normalizedItems = normalizeItems(items)
  const resolvedType: FilterInputType = multiple ? 'checkbox' : (type ?? 'radio')
  const generatedName = ref(`rue-filter-${++filterNameSeed}`)
  const resolvedName = name ?? (resolvedType === 'radio' ? generatedName.value : undefined)
  const defaultValues = normalizeValueList(defaultValue, resolvedType)
  const controlledValues = ref<FilterValue[]>(normalizeValueList(value, resolvedType))
  const uncontrolledValues = ref<FilterValue[]>(defaultValues)
  const controlled = value !== undefined
  const managed =
    controlled || defaultValue !== undefined || !!onChange || normalizedItems.length > 0

  const getCurrentValues = () => {
    return controlled ? controlledValues.value : uncontrolledValues.value
  }

  const observeGroup = () => {
    const container = groupRef.current
    const observer = observerRef.current
    if (!container || !observer) return

    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'type', 'name', 'checked', 'value'],
    })
  }

  const scheduleSyncChildInputs = () => {
    queueMicrotask(() => {
      syncChildInputs()
    })

    setTimeout(() => {
      syncChildInputs()
    }, 0)
  }

  const syncChildInputs = () => {
    const container = groupRef.current
    if (!container) return

    observerRef.current?.disconnect()

    const currentValues = getCurrentValues()
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[data-rue-filter-role]'),
    )

    inputs.forEach(input => {
      const config = readInputConfig(input)

      if (config.role === 'reset') {
        const resetMode = config.mode ?? as
        const resetChecked =
          resetMode === 'div' && managed ? currentValues.length === 0 : input.checked === true
        const mergedClassName = resolveButtonClassName({
          color: config.color ?? color,
          size: config.size ?? size,
          variant: config.variant ?? variant,
          active: config.active || resetChecked,
          className: mergeClassNames(itemClassName, config.className),
        })
        input.type = resetMode === 'form' ? 'reset' : 'radio'
        input.disabled = disabled ? true : config.disabled
        input.className = mergeClassNames(
          mergedClassName,
          resetMode === 'form' ? 'btn-square' : 'filter-reset',
        )

        if (resetMode === 'div') {
          if (resolvedType === 'radio' && (config.name ?? resolvedName)) {
            input.name = config.name ?? resolvedName ?? ''
          } else {
            input.removeAttribute('name')
          }
          if (managed) {
            input.checked = currentValues.length === 0
          }
        }
        return
      }

      const itemChecked =
        managed && config.value !== undefined
          ? currentValues.some(
              current => serializeValue(current) === serializeValue(config.value as FilterValue),
            )
          : input.checked === true
      const mergedClassName = resolveButtonClassName({
        color: config.color ?? color,
        size: config.size ?? size,
        variant: config.variant ?? variant,
        active: config.active || itemChecked,
        className: mergeClassNames(itemClassName, config.className),
      })
      input.type = config.type ?? resolvedType
      if (input.type === 'radio' && (config.name ?? resolvedName)) {
        input.name = config.name ?? resolvedName ?? ''
      }
      input.disabled = disabled ? true : config.disabled
      input.className = mergedClassName

      if (managed && config.value !== undefined) {
        input.checked = itemChecked
      }
    })

    observeGroup()
  }

  const emitChange = (
    nextValues: FilterValue[],
    event: Event,
    item?: FilterItemData,
    checked = false,
  ) => {
    const normalizedNext = normalizeValueList(nextValues, resolvedType)
    if (managed) {
      if (controlled) {
        if (onChange) {
          controlledValues.value = normalizedNext
        }
      } else {
        uncontrolledValues.value = normalizedNext
      }
    }
    if (onChange) {
      onChange(resolvedType === 'checkbox' ? normalizedNext : normalizedNext[0], event, {
        checked,
        value: item ? resolveItemValue(item) : undefined,
        item,
        values: normalizedNext,
      })
    }
  }

  const handleItemChange = (itemValue: FilterValue | undefined, checked: boolean, event: Event) => {
    const currentValues = getCurrentValues()

    if (itemValue === undefined) {
      emitChange(currentValues, event, undefined, checked)
      return
    }

    if (resolvedType === 'checkbox') {
      const hasValue = currentValues.some(
        current => serializeValue(current) === serializeValue(itemValue),
      )
      const nextValues = checked
        ? hasValue
          ? currentValues
          : [...currentValues, itemValue]
        : currentValues.filter(current => serializeValue(current) !== serializeValue(itemValue))
      emitChange(nextValues, event, undefined, checked)
      return
    }

    emitChange(checked ? [itemValue] : [], event, undefined, checked)
  }

  const clearSelection = (event: Event) => {
    emitChange([], event, undefined, false)
  }

  const restoreDefaultSelection = (event: Event) => {
    emitChange(defaultValues, event, undefined, false)
  }

  const resetProps = typeof reset === 'object' ? reset : undefined
  const resolvedResetMode = resetProps?.mode ?? as
  const resetNode = reset ? <Reset {...resetProps} mode={resolvedResetMode} /> : null
  const renderResetAfterItems = resolvedType === 'checkbox' && resolvedResetMode === 'form'
  const content =
    normalizedItems.length > 0 ? (
      <>
        {!renderResetAfterItems ? resetNode : null}
        {normalizedItems.map((item, index) => (
          <Item key={item.key ?? `filter-item-${index}`} {...item} />
        ))}
        {renderResetAfterItems ? resetNode : null}
      </>
    ) : (
      children
    )

  const handleGroupChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    if (!target || target.tagName.toLowerCase() !== 'input' || !target.dataset.rueFilterRole) {
      return
    }

    const config = readInputConfig(target)
    if (config.role === 'reset') {
      if ((config.mode ?? as) !== 'form') {
        clearSelection(event)
        syncChildInputs()
        scheduleSyncChildInputs()
      }
      return
    }

    handleItemChange(config.value, target.checked === true, event)
    syncChildInputs()
    scheduleSyncChildInputs()
  }

  onMounted(() => {
    if (typeof MutationObserver === 'function') {
      observerRef.current = new MutationObserver(() => {
        syncChildInputs()
      })
      observeGroup()
    }

    syncChildInputs()
  })

  onUnmounted(() => {
    observerRef.current?.disconnect()
    observerRef.current = undefined
  })

  watch(
    () => value,
    (nextValue: FilterProps['value']) => {
      controlledValues.value = normalizeValueList(nextValue, resolvedType)
      syncChildInputs()
    },
    { immediate: true },
  )

  watch(
    () => uncontrolledValues.value,
    () => {
      syncChildInputs()
    },
    { immediate: true },
  )

  watch(
    () => disabled,
    () => {
      syncChildInputs()
    },
    { immediate: true },
  )

  watch(
    () => resolvedName,
    () => {
      syncChildInputs()
    },
    { immediate: true },
  )

  watch(
    () =>
      `${as}|${resolvedType}|${color ?? ''}|${variant ?? ''}|${size ?? ''}|${itemClassName ?? ''}|${normalizedItems.length}`,
    () => {
      syncChildInputs()
    },
    { immediate: true },
  )

  return (
    <Component
      {...rest}
      ref={groupRef}
      style={style}
      onChange={handleGroupChange}
      onReset={(event: Event) => {
        restoreDefaultSelection(event)
        syncChildInputs()
        scheduleSyncChildInputs()
        if (onReset) onReset(event)
      }}
      className={mergeClassNames(
        resolvedType === 'radio' ? 'filter' : 'flex flex-wrap gap-1',
        className,
      )}
      data-rue-filter-group="true"
      data-rue-filter-mode={as}
      data-rue-filter-type={resolvedType}
    >
      {content}
    </Component>
  )
}

/** Item 的内部工具函数。 */
const Item: FC<FilterItemProps> = ({
  label,
  children,
  checked,
  defaultChecked,
  disabled,
  className,
  color,
  size,
  variant,
  active,
  name,
  type,
  onChange,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>()
  const mergedType = type ?? 'radio'
  const mergedName = name
  const mergedDisabled = !!disabled
  const mergedValue = resolveItemValue({
    value: rest.value,
    label: label ?? rest['aria-label'],
    children,
  })
  const mergedAriaLabel = resolveItemLabel(label ?? rest['aria-label'], children)
  const mergedClassName = resolveButtonClassName({
    color,
    size,
    variant,
    active,
    className,
  })
  const domProps = { ...rest }

  if (
    mergedAriaLabel !== undefined &&
    domProps['aria-label'] === undefined &&
    isPrimitiveValue(mergedAriaLabel)
  ) {
    domProps['aria-label'] = String(mergedAriaLabel)
  }
  if (mergedValue !== undefined && domProps.value === undefined) {
    domProps.value = String(mergedValue)
  }

  const dataProps = omitNullishProps({
    'data-rue-filter-role': 'item',
    'data-rue-filter-name': mergedName,
    'data-rue-filter-type': type,
    'data-rue-filter-size': size,
    'data-rue-filter-color': color,
    'data-rue-filter-variant': variant,
    'data-rue-filter-class-name': className,
    'data-rue-filter-active': active ? 'true' : 'false',
    'data-rue-filter-disabled': mergedDisabled ? 'true' : 'false',
    'data-rue-filter-value': mergedValue !== undefined ? serializeValue(mergedValue) : undefined,
  })
  const inputProps = omitNullishProps({
    ...domProps,
    name: mergedName,
    type: mergedType,
    checked,
    defaultChecked,
    className: mergedClassName,
    disabled: mergedDisabled,
    ...dataProps,
  })

  const syncStandaloneProps = () => {
    if (!inputRef.current) return
    inputRef.current.className = mergedClassName
    inputRef.current.disabled = mergedDisabled
    if (mergedName) inputRef.current.name = mergedName
    inputRef.current.type = mergedType
  }

  onMounted(() => {
    syncStandaloneProps()
  })

  return (
    <input
      {...inputProps}
      ref={inputRef}
      onChange={(event: Event) => {
        const nextChecked = (event.target as HTMLInputElement | null)?.checked === true
        if (onChange) {
          onChange(event, {
            checked: nextChecked,
            value: mergedValue,
            item: {
              ...rest,
              label: mergedAriaLabel,
              value: mergedValue,
              checked,
              defaultChecked,
              disabled: mergedDisabled,
              className,
              color,
              size,
              variant,
              active,
              name: mergedName,
              type: mergedType,
            },
          })
        }
      }}
    />
  )
}

/** Reset 的内部工具函数。 */
const Reset: FC<FilterResetProps> = ({
  mode,
  label,
  checked,
  defaultChecked,
  disabled,
  className,
  color,
  size,
  variant,
  onChange,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>()
  const resolvedMode = mode ?? 'div'
  const mergedDisabled = !!disabled
  const resolvedLabel = resolveItemLabel(label ?? rest['aria-label'] ?? rest.value, '×')
  let mergedClassName = resolveButtonClassName({
    color,
    size,
    variant,
    className,
  })
  const domProps = { ...rest }

  if (resolvedMode === 'form') {
    mergedClassName += ' btn-square'
    if (domProps.value === undefined && isPrimitiveValue(resolvedLabel)) {
      domProps.value = String(resolvedLabel)
    }
  } else {
    mergedClassName += ' filter-reset'
    if (domProps['aria-label'] === undefined && isPrimitiveValue(resolvedLabel)) {
      domProps['aria-label'] = String(resolvedLabel)
    }
  }

  const syncStandaloneProps = () => {
    if (!inputRef.current) return
    inputRef.current.className = mergedClassName
    inputRef.current.disabled = mergedDisabled
    inputRef.current.type = domProps.type ?? (resolvedMode === 'form' ? 'reset' : 'radio')
  }

  onMounted(() => {
    syncStandaloneProps()
  })

  const dataProps = omitNullishProps({
    'data-rue-filter-role': 'reset',
    'data-rue-filter-mode': resolvedMode,
    'data-rue-filter-name': domProps.name,
    'data-rue-filter-size': size,
    'data-rue-filter-color': color,
    'data-rue-filter-variant': variant,
    'data-rue-filter-class-name': className,
    'data-rue-filter-disabled': mergedDisabled ? 'true' : 'false',
  })
  const inputProps = omitNullishProps({
    ...domProps,
    name: domProps.name,
    type: domProps.type ?? (resolvedMode === 'form' ? 'reset' : 'radio'),
    checked,
    defaultChecked,
    className: mergedClassName,
    disabled: mergedDisabled,
    ...dataProps,
  })

  return (
    <input
      {...inputProps}
      ref={inputRef}
      onChange={(event: Event) => {
        if (onChange) onChange(event)
      }}
    />
  )
}

type FilterCompound = FC<FilterProps> & {
  Item: FC<FilterItemProps>
  Reset: FC<FilterResetProps>
}

const FilterCompound: FilterCompound = Object.assign(Filter, {
  Item,
  Reset,
})

/** 默认导出过滤器组件。 */
export default FilterCompound
