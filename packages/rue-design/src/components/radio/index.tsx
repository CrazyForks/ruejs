/* RUE_VAPOR_TRANSFORMED */
/*
Radio 组件概述
- 保留 Rue 当前 radio 视觉类，同时补齐受控/非受控、标签包装、Radio.Group、Radio.Button 与 options 配置能力。
- Group 通过轻量 DOM 同步兼容 children 直出和 options 配置两种写法，不依赖运行时 context。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'

/** RadioColor 语义色类型。 */
export type RadioColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'

/** RadioSize 尺寸类型。 */
export type RadioSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'medium' | 'middle' | 'large'
/** RadioValue 值类型。 */
export type RadioValue = string | number | boolean
/** RadioOptionType 视觉或语义变体类型。 */
export type RadioOptionType = 'default' | 'button'
/** RadioButtonStyle 样式值类型。 */
export type RadioButtonStyle = 'outline' | 'solid'
/** RadioOrientation 类型。 */
export type RadioOrientation = 'horizontal' | 'vertical'

/** RadioChangeMeta 接口。 */
export interface RadioChangeMeta {
  /** 受控选中状态。 */
  checked: boolean
  /** 受控值。 */
  value?: RadioValue
  /** optionType 配置项。 */
  optionType: RadioOptionType
}

/** RadioProps 组件属性。 */
export interface RadioProps {
  /** 组件语义色。 */
  color?: RadioColor
  /** 组件尺寸。 */
  size?: RadioSize
  /** 受控选中状态。 */
  checked?: boolean
  /** 非受控初始选中状态。 */
  defaultChecked?: boolean
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 受控值。 */
  value?: RadioValue
  /** 根节点附加类名。 */
  className?: string
  /** 根节点附加类名。 */
  rootClassName?: string
  /** contentClassName 附加类名。 */
  contentClassName?: string
  /** 根节点内联样式。 */
  style?: any
  /** 根节点内联样式。 */
  rootStyle?: any
  /** 组件子内容。 */
  children?: any
  /** 标题内容。 */
  title?: string
  /** 元素或数据项标识。 */
  id?: string
  /** 表单 name 属性或分组名称。 */
  name?: string
  /** optionType 配置项。 */
  optionType?: RadioOptionType
  /** buttonStyle 内联样式。 */
  buttonStyle?: RadioButtonStyle
  /** block 配置项。 */
  block?: boolean
  /** 值或状态变化时触发的回调。 */
  onChange?: (event: Event, meta: RadioChangeMeta) => void
  /** onCheckedChange 事件回调。 */
  onCheckedChange?: (checked: boolean, event: Event) => void
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** RadioOption 选项配置。 */
export interface RadioOption {
  /** 展示标签。 */
  label: any
  /** 受控值。 */
  value: RadioValue
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: any
  /** 标题内容。 */
  title?: string
  /** 元素或数据项标识。 */
  id?: string
  /** required 配置项。 */
  required?: boolean
  /** 组件语义色。 */
  color?: RadioColor
  /** 组件尺寸。 */
  size?: RadioSize
  /** 值或状态变化时触发的回调。 */
  onChange?: (event: Event, meta: RadioChangeMeta) => void
}

/** RadioGroupChangeMeta 接口。 */
export interface RadioGroupChangeMeta extends RadioChangeMeta {
  /** previousValue 值。 */
  previousValue?: RadioValue
  /** option 配置项。 */
  option?: RadioOption
}

/** RadioGroupProps 组件属性。 */
export interface RadioGroupProps {
  /** 受控值。 */
  value?: RadioValue
  /** 非受控初始值。 */
  defaultValue?: RadioValue
  /** 可选项数据。 */
  options?: ReadonlyArray<RadioOption | RadioValue>
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 表单 name 属性或分组名称。 */
  name?: string
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: any
  /** 组件子内容。 */
  children?: any
  /** optionType 配置项。 */
  optionType?: RadioOptionType
  /** buttonStyle 内联样式。 */
  buttonStyle?: RadioButtonStyle
  /** 组件尺寸。 */
  size?: RadioSize
  /** 组件语义色。 */
  color?: RadioColor
  /** block 配置项。 */
  block?: boolean
  /** orientation 配置项。 */
  orientation?: RadioOrientation
  /** vertical 配置项。 */
  vertical?: boolean
  /** 值或状态变化时触发的回调。 */
  onChange?: (value: RadioValue | undefined, event: Event, meta: RadioGroupChangeMeta) => void
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

interface NormalizedRadioOption extends RadioOption {}

/** append Class Name 的内部工具函数。 */
const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

/** 解析 Size Token 的内部工具函数。 */
const resolveSizeToken = (size?: RadioSize) => {
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

/** 构建 Input Class Name 的内部工具函数。 */
const buildInputClassName = (color?: RadioColor, size?: RadioSize, className?: string) => {
  let cls = 'radio'
  const resolvedSize = resolveSizeToken(size)

  if (color) cls += ` radio-${color}`
  if (resolvedSize) cls += ` radio-${resolvedSize}`
  if (className) cls += ` ${className}`

  return cls
}

/** 构建 Default Root Class Name 的内部工具函数。 */
const buildDefaultRootClassName = (disabled?: boolean, rootClassName?: string, block?: boolean) => {
  let cls = 'inline-flex items-start gap-3 text-sm leading-5 text-base-content'

  if (block) cls += ' w-full'
  if (disabled) cls += ' cursor-not-allowed opacity-60'
  else cls += ' cursor-pointer'
  if (rootClassName) cls += ` ${rootClassName}`

  return cls
}

/** 构建 Button Root Class Name 的内部工具函数。 */
const buildButtonRootClassName = (disabled?: boolean, rootClassName?: string, block?: boolean) => {
  let cls = 'inline-flex'

  if (block) cls += ' w-full'
  if (disabled) cls += ' cursor-not-allowed opacity-60'
  else cls += ' cursor-pointer'
  if (rootClassName) cls += ` ${rootClassName}`

  return cls
}

/** 构建 Content Class Name 的内部工具函数。 */
const buildContentClassName = (contentClassName?: string) => {
  return appendClassName('min-w-0 flex-1', contentClassName)
}

/** 解析 Button Size Class 的内部工具函数。 */
const resolveButtonSizeClass = (size?: RadioSize) => {
  switch (resolveSizeToken(size)) {
    case 'xs':
      return 'btn-xs'
    case 'sm':
      return 'btn-sm'
    case 'lg':
      return 'btn-lg'
    case 'xl':
      return 'btn-xl'
    default:
      return 'btn-md'
  }
}

/** 解析 Outline Selected Classes 的内部工具函数。 */
const resolveOutlineSelectedClasses = (color?: RadioColor) => {
  switch (color ?? 'primary') {
    case 'neutral':
      return 'peer-checked:border-neutral peer-checked:bg-neutral/10 peer-checked:text-neutral'
    case 'secondary':
      return 'peer-checked:border-secondary peer-checked:bg-secondary/10 peer-checked:text-secondary'
    case 'accent':
      return 'peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent'
    case 'success':
      return 'peer-checked:border-success peer-checked:bg-success/10 peer-checked:text-success'
    case 'warning':
      return 'peer-checked:border-warning peer-checked:bg-warning/10 peer-checked:text-warning'
    case 'info':
      return 'peer-checked:border-info peer-checked:bg-info/10 peer-checked:text-info'
    case 'error':
      return 'peer-checked:border-error peer-checked:bg-error/10 peer-checked:text-error'
    default:
      return 'peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary'
  }
}

/** 解析 Solid Selected Classes 的内部工具函数。 */
const resolveSolidSelectedClasses = (color?: RadioColor) => {
  switch (color ?? 'primary') {
    case 'neutral':
      return 'peer-checked:border-neutral peer-checked:bg-neutral peer-checked:text-neutral-content'
    case 'secondary':
      return 'peer-checked:border-secondary peer-checked:bg-secondary peer-checked:text-secondary-content'
    case 'accent':
      return 'peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-content'
    case 'success':
      return 'peer-checked:border-success peer-checked:bg-success peer-checked:text-success-content'
    case 'warning':
      return 'peer-checked:border-warning peer-checked:bg-warning peer-checked:text-warning-content'
    case 'info':
      return 'peer-checked:border-info peer-checked:bg-info peer-checked:text-info-content'
    case 'error':
      return 'peer-checked:border-error peer-checked:bg-error peer-checked:text-error-content'
    default:
      return 'peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-content'
  }
}

/** 构建 Button Surface Class Name 的内部工具函数。 */
const buildButtonSurfaceClassName = ({
  color,
  size,
  buttonStyle,
  className,
  block,
}: {
  color?: RadioColor
  size?: RadioSize
  buttonStyle?: RadioButtonStyle
  className?: string
  block?: boolean
}) => {
  let cls =
    'btn min-h-0 border-base-300 bg-base-100 text-base-content shadow-none transition-colors duration-200 peer-disabled:pointer-events-none peer-disabled:opacity-60 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary/20 peer-checked:shadow-sm'

  cls += ` ${resolveButtonSizeClass(size)}`
  cls += block ? ' w-full justify-center' : ' justify-center'

  if (buttonStyle === 'solid') {
    cls += ' hover:bg-base-200'
    cls += ` ${resolveSolidSelectedClasses(color)}`
  } else {
    cls += ' btn-outline hover:bg-base-200'
    cls += ` ${resolveOutlineSelectedClasses(color)}`
  }

  if (className) cls += ` ${className}`

  return cls
}

/** 解析 Group Class Name 的内部工具函数。 */
const resolveGroupClassName = ({
  optionType,
  orientation,
  className,
  block,
}: {
  optionType: RadioOptionType
  orientation: RadioOrientation
  className?: string
  block?: boolean
}) => {
  let cls =
    optionType === 'button'
      ? orientation === 'vertical'
        ? 'flex flex-col gap-2'
        : 'flex flex-wrap items-start gap-2'
      : orientation === 'vertical'
        ? 'flex flex-col gap-3'
        : 'flex flex-wrap items-center gap-4'

  if (block) cls += ' w-full'
  if (className) cls += ` ${className}`

  return cls
}

/** serialize Value 的内部工具函数。 */
const serializeValue = (value: RadioValue) => {
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
const deserializeValue = (serialized?: string): RadioValue | undefined => {
  if (!serialized) return undefined

  const separatorIndex = serialized.indexOf(':')
  if (separatorIndex === -1) return serialized

  const type = serialized.slice(0, separatorIndex)
  const rawValue = serialized.slice(separatorIndex + 1)

  if (type === 'number') return Number(rawValue)
  if (type === 'boolean') return rawValue === 'true'

  return rawValue
}

/** 归一化 Options 的内部工具函数。 */
const normalizeOptions = (options?: ReadonlyArray<RadioOption | RadioValue>) => {
  return (options ?? []).map<NormalizedRadioOption>(option => {
    if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
      return {
        label: String(option),
        value: option,
      }
    }

    return option
  })
}

/** 解析 Orientation 的内部工具函数。 */
const resolveOrientation = (
  orientation?: RadioOrientation,
  vertical?: boolean,
): RadioOrientation => {
  return orientation ?? (vertical ? 'vertical' : 'horizontal')
}

/** read Group Config 的内部工具函数。 */
const readGroupConfig = (input?: HTMLInputElement | null) => {
  const group = input?.closest('[data-rue-radio-group="true"]') as HTMLElement | null

  if (!group) {
    return {
      optionType: undefined as RadioOptionType | undefined,
      buttonStyle: undefined as RadioButtonStyle | undefined,
      size: undefined as RadioSize | undefined,
      color: undefined as RadioColor | undefined,
      block: undefined as boolean | undefined,
    }
  }

  return {
    optionType: group.dataset.rueRadioGroupOptionType as RadioOptionType | undefined,
    buttonStyle: group.dataset.rueRadioGroupButtonStyle as RadioButtonStyle | undefined,
    size: group.dataset.rueRadioGroupSize as RadioSize | undefined,
    color: group.dataset.rueRadioGroupColor as RadioColor | undefined,
    block: group.dataset.rueRadioGroupBlock === 'true',
  }
}

/** Radio Root 的内部工具函数。 */
const RadioRoot: FC<RadioProps> = ({
  color,
  size,
  checked,
  defaultChecked,
  disabled,
  value,
  className,
  rootClassName,
  contentClassName,
  style,
  rootStyle,
  children,
  title,
  id,
  name,
  optionType,
  buttonStyle,
  block,
  onChange,
  onCheckedChange,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>()
  const buttonRootRef = useRef<HTMLLabelElement>()
  const buttonSurfaceRef = useRef<HTMLSpanElement>()
  const inheritedOptionType = ref<RadioOptionType | undefined>(undefined)
  const inheritedButtonStyle = ref<RadioButtonStyle | undefined>(undefined)
  const inheritedSize = ref<RadioSize | undefined>(undefined)
  const inheritedColor = ref<RadioColor | undefined>(undefined)
  const inheritedBlock = ref<boolean | undefined>(undefined)

  const syncControlledState = () => {
    if (typeof checked === 'boolean' && inputRef.current) {
      inputRef.current.checked = checked
    }
  }

  const syncGroupConfig = () => {
    const config = readGroupConfig(inputRef.current)

    inheritedOptionType.value = config.optionType
    inheritedButtonStyle.value = config.buttonStyle
    inheritedSize.value = config.size
    inheritedColor.value = config.color
    inheritedBlock.value = config.block

    if (buttonRootRef.current) {
      buttonRootRef.current.className = buildButtonRootClassName(
        disabled,
        rootClassName,
        block ?? config.block ?? false,
      )
    }

    if (buttonSurfaceRef.current) {
      buttonSurfaceRef.current.className = buildButtonSurfaceClassName({
        color: color ?? config.color,
        size: size ?? config.size,
        buttonStyle: buttonStyle ?? config.buttonStyle ?? 'outline',
        className,
        block: block ?? config.block ?? false,
      })
    }
  }

  const handleChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    const nextChecked = target?.checked === true

    syncGroupConfig()

    if (typeof checked === 'boolean' && inputRef.current) {
      inputRef.current.checked = checked
    }

    const resolvedOptionType = optionType ?? inheritedOptionType.value ?? 'default'

    if (onChange) {
      onChange(event, {
        checked: nextChecked,
        value,
        optionType: resolvedOptionType,
      })
    }

    if (onCheckedChange) {
      onCheckedChange(nextChecked, event)
    }
  }

  onMounted(() => {
    syncControlledState()
    syncGroupConfig()
  })

  watch(
    () => checked,
    () => {
      syncControlledState()
    },
    { immediate: true },
  )

  const mergedOptionType = optionType ?? inheritedOptionType.value ?? 'default'
  const mergedButtonStyle = buttonStyle ?? inheritedButtonStyle.value ?? 'outline'
  const mergedSize = size ?? inheritedSize.value
  const mergedColor = color ?? inheritedColor.value
  const mergedBlock = block ?? inheritedBlock.value ?? false
  const isButton = mergedOptionType === 'button'

  const inputNode = (
    <input
      {...rest}
      ref={inputRef}
      id={id}
      name={name}
      title={title}
      type="radio"
      value={value as any}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      style={isButton ? undefined : style}
      className={isButton ? 'peer sr-only' : buildInputClassName(color, size, className)}
      data-rue-radio-input="true"
      data-rue-radio-disabled={disabled ? 'true' : 'false'}
      data-rue-radio-option-type={mergedOptionType}
      data-rue-radio-value={value !== undefined ? serializeValue(value) : undefined}
      onChange={handleChange}
    />
  )

  if (isButton) {
    const buttonLabel = children ?? (value !== undefined ? String(value) : null)

    return (
      <label
        ref={buttonRootRef}
        className={buildButtonRootClassName(disabled, rootClassName, mergedBlock)}
        style={rootStyle}
        title={title}
        data-rue-radio-root="true"
        data-rue-radio-option-type="button"
      >
        {inputNode}
        <span
          ref={buttonSurfaceRef}
          className={buildButtonSurfaceClassName({
            color: mergedColor,
            size: mergedSize,
            buttonStyle: mergedButtonStyle,
            className,
            block: mergedBlock,
          })}
          style={style}
        >
          {buttonLabel}
        </span>
      </label>
    )
  }

  if (children == null && !rootClassName && !rootStyle && !contentClassName) {
    return inputNode
  }

  return (
    <label
      className={buildDefaultRootClassName(disabled, rootClassName, mergedBlock)}
      style={rootStyle}
      title={title}
      data-rue-radio-root="true"
      data-rue-radio-option-type="default"
    >
      <span className="shrink-0 pt-0.5">{inputNode}</span>
      {children != null ? (
        <span className={buildContentClassName(contentClassName)}>{children}</span>
      ) : null}
    </label>
  )
}

/** Group 的内部工具函数。 */
const Group: FC<RadioGroupProps> = ({
  value,
  defaultValue,
  options,
  disabled,
  name,
  className,
  style,
  children,
  optionType = 'default',
  buttonStyle = 'outline',
  size,
  color,
  block,
  orientation,
  vertical,
  onChange,
  ...rest
}) => {
  const groupRef = useRef<HTMLDivElement>()
  const generatedName = ref<string | undefined>(undefined)
  const selectedValue = ref<RadioValue | undefined>(value ?? defaultValue)
  const normalizedOptions = normalizeOptions(options)

  if (!generatedName.value) {
    generatedName.value = `rue-radio-group-${Math.random().toString(36).slice(2, 10)}`
  }

  const mergedName = name ?? generatedName.value
  const mergedOrientation = resolveOrientation(orientation, vertical)

  const syncChildInputs = () => {
    const container = groupRef.current

    if (!container) {
      return
    }

    const selectedSerializedValue =
      selectedValue.value !== undefined ? serializeValue(selectedValue.value) : undefined
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'input[type="radio"][data-rue-radio-input="true"]',
      ),
    )

    inputs.forEach(input => {
      const serializedValue = input.dataset.rueRadioValue

      if (serializedValue) {
        input.checked =
          selectedSerializedValue !== undefined && serializedValue === selectedSerializedValue
      }

      input.name = mergedName
      input.disabled = disabled ? true : input.dataset.rueRadioDisabled === 'true'
    })
  }

  const commitValue = (
    nextValue: RadioValue | undefined,
    event: Event,
    option?: NormalizedRadioOption,
    controlled?: boolean,
  ) => {
    const previousValue = controlled ? value : selectedValue.value

    if (!controlled) {
      selectedValue.value = nextValue
    }

    if (nextValue !== previousValue && onChange) {
      onChange(nextValue, event, {
        checked: true,
        value: nextValue,
        previousValue,
        optionType,
        option,
      })
    }

    if (nextValue !== previousValue && option?.onChange) {
      option.onChange(event, {
        checked: true,
        value: nextValue,
        optionType,
      })
    }
  }

  const handleGroupChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null

    if (!target || target.type !== 'radio' || target.dataset.rueRadioInput !== 'true') {
      return
    }

    const serializedValue = target.dataset.rueRadioValue
    const resolvedValue = deserializeValue(serializedValue)
    const matchedOption = normalizedOptions.find(
      option => serializeValue(option.value) === serializedValue,
    )
    const controlled = value !== undefined

    if (resolvedValue === undefined) {
      if (controlled) {
        syncChildInputs()
      }
      return
    }

    commitValue(resolvedValue, event, matchedOption, controlled)
    syncChildInputs()
  }

  onMounted(() => {
    syncChildInputs()
  })

  watch(
    () => value,
    (nextValue: RadioValue | undefined) => {
      if (nextValue !== undefined) {
        selectedValue.value = nextValue
      }
      syncChildInputs()
    },
    { immediate: true },
  )

  watch(
    () => selectedValue.value,
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
    () => mergedName,
    () => {
      syncChildInputs()
    },
    { immediate: true },
  )

  const currentValue = value !== undefined ? value : selectedValue.value

  return (
    <div
      {...rest}
      ref={groupRef}
      role={rest.role ?? 'radiogroup'}
      className={resolveGroupClassName({
        optionType,
        orientation: mergedOrientation,
        className,
        block,
      })}
      style={style}
      data-rue-radio-group="true"
      data-rue-radio-group-block={block ? 'true' : 'false'}
      data-rue-radio-group-button-style={buttonStyle}
      data-rue-radio-group-color={color}
      data-rue-radio-group-option-type={optionType}
      data-rue-radio-group-size={resolveSizeToken(size)}
      onChange={handleGroupChange}
    >
      {normalizedOptions.length
        ? normalizedOptions.map(option => (
            <RadioRoot
              key={serializeValue(option.value)}
              value={option.value}
              checked={currentValue === option.value}
              disabled={disabled || option.disabled}
              name={mergedName}
              title={option.title}
              id={option.id}
              required={option.required}
              optionType={optionType}
              buttonStyle={buttonStyle}
              size={option.size ?? size}
              color={option.color ?? color}
              block={block}
              rootClassName={option.className}
              rootStyle={option.style}
            >
              {option.label}
            </RadioRoot>
          ))
        : children}
    </div>
  )
}

/** Radio Button 的内部工具函数。 */
const RadioButton: FC<RadioProps> = props => {
  return <RadioRoot {...props} optionType="button" />
}

type RadioCompound = FC<RadioProps> & {
  Group: FC<RadioGroupProps>
  Button: FC<RadioProps>
}

const Radio: RadioCompound = Object.assign(RadioRoot, {
  Group,
  Button: RadioButton,
})

/** 默认导出单选框组件。 */
export default Radio
