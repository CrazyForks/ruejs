/*
Radio 组件概述
- 保留 Rue 当前 radio 视觉类，同时补齐受控/非受控、标签包装、Radio.Group、Radio.Button 与 options 配置能力。
- Group 通过轻量 DOM 同步兼容 children 直出和 options 配置两种写法，不依赖运行时 context。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'

export type RadioColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'

export type RadioSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'medium' | 'middle' | 'large'
export type RadioValue = string | number | boolean
export type RadioOptionType = 'default' | 'button'
export type RadioButtonStyle = 'outline' | 'solid'
export type RadioOrientation = 'horizontal' | 'vertical'

export interface RadioChangeMeta {
  checked: boolean
  value?: RadioValue
  optionType: RadioOptionType
}

export interface RadioProps {
  color?: RadioColor
  size?: RadioSize
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  value?: RadioValue
  className?: string
  rootClassName?: string
  contentClassName?: string
  style?: any
  rootStyle?: any
  children?: any
  title?: string
  id?: string
  name?: string
  optionType?: RadioOptionType
  buttonStyle?: RadioButtonStyle
  block?: boolean
  onChange?: (event: Event, meta: RadioChangeMeta) => void
  onCheckedChange?: (checked: boolean, event: Event) => void
  [key: string]: any
}

export interface RadioOption {
  label: any
  value: RadioValue
  disabled?: boolean
  className?: string
  style?: any
  title?: string
  id?: string
  required?: boolean
  color?: RadioColor
  size?: RadioSize
  onChange?: (event: Event, meta: RadioChangeMeta) => void
}

export interface RadioGroupChangeMeta extends RadioChangeMeta {
  previousValue?: RadioValue
  option?: RadioOption
}

export interface RadioGroupProps {
  value?: RadioValue
  defaultValue?: RadioValue
  options?: ReadonlyArray<RadioOption | RadioValue>
  disabled?: boolean
  name?: string
  className?: string
  style?: any
  children?: any
  optionType?: RadioOptionType
  buttonStyle?: RadioButtonStyle
  size?: RadioSize
  color?: RadioColor
  block?: boolean
  orientation?: RadioOrientation
  vertical?: boolean
  onChange?: (value: RadioValue | undefined, event: Event, meta: RadioGroupChangeMeta) => void
  [key: string]: any
}

interface NormalizedRadioOption extends RadioOption {}

const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

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

const buildInputClassName = (color?: RadioColor, size?: RadioSize, className?: string) => {
  let cls = 'radio'
  const resolvedSize = resolveSizeToken(size)

  if (color) cls += ` radio-${color}`
  if (resolvedSize) cls += ` radio-${resolvedSize}`
  if (className) cls += ` ${className}`

  return cls
}

const buildDefaultRootClassName = (disabled?: boolean, rootClassName?: string, block?: boolean) => {
  let cls = 'inline-flex items-start gap-3 text-sm leading-5 text-base-content'

  if (block) cls += ' w-full'
  if (disabled) cls += ' cursor-not-allowed opacity-60'
  else cls += ' cursor-pointer'
  if (rootClassName) cls += ` ${rootClassName}`

  return cls
}

const buildButtonRootClassName = (disabled?: boolean, rootClassName?: string, block?: boolean) => {
  let cls = 'inline-flex'

  if (block) cls += ' w-full'
  if (disabled) cls += ' cursor-not-allowed opacity-60'
  else cls += ' cursor-pointer'
  if (rootClassName) cls += ` ${rootClassName}`

  return cls
}

const buildContentClassName = (contentClassName?: string) => {
  return appendClassName('min-w-0 flex-1', contentClassName)
}

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

const resolveOrientation = (orientation?: RadioOrientation, vertical?: boolean): RadioOrientation => {
  return orientation ?? (vertical ? 'vertical' : 'horizontal')
}

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
  const inheritedOptionType = ref<RadioOptionType>()
  const inheritedButtonStyle = ref<RadioButtonStyle>()
  const inheritedSize = ref<RadioSize>()
  const inheritedColor = ref<RadioColor>()
  const inheritedBlock = ref<boolean>()

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
      buttonRootRef.current.className = buildButtonRootClassName(disabled, rootClassName, block ?? config.block ?? false)
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
      {children != null ? <span className={buildContentClassName(contentClassName)}>{children}</span> : null}
    </label>
  )
}

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
  const generatedName = ref<string>()
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
      container.querySelectorAll<HTMLInputElement>('input[type="radio"][data-rue-radio-input="true"]'),
    )

    inputs.forEach(input => {
      const serializedValue = input.dataset.rueRadioValue

      if (serializedValue) {
        input.checked = selectedSerializedValue !== undefined && serializedValue === selectedSerializedValue
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
    const matchedOption = normalizedOptions.find(option => serializeValue(option.value) === serializedValue)
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
    nextValue => {
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

export default Radio