/* RUE_VAPOR_TRANSFORMED */
/*
Rating 组件概述
- 默认提供语义化评分 API，支持受控/非受控、清除、半星、悬停反馈与自定义字符。
- 保留 Rating.Item 复合写法，兼容现有基于 daisyUI `rating` 结构的老 demo。
- 自动模式使用字符双层填充实现分数显示，既能保留 Rue 当前轻量视觉，也能承载自定义字符。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'

let ratingSeed = 0

/** RatingSize 尺寸类型。 */
export type RatingSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'small'
  | 'default'
  | 'medium'
  | 'middle'
  | 'large'

/** RatingTooltipItem 数据项结构。 */
export interface RatingTooltipItem {
  /** 标题内容。 */
  title?: any
}

/** RatingCharacterRenderContext 事件或渲染上下文。 */
export interface RatingCharacterRenderContext {
  /** index 配置项。 */
  index: number
  /** 受控值。 */
  value: number
  /** fill 配置项。 */
  fill: number
  /** 受控选中状态。 */
  checked: boolean
  /** hovered 配置项。 */
  hovered: boolean
  /** half 配置项。 */
  half: boolean
}

/** RatingProps 组件属性。 */
export interface RatingProps {
  /** 组件尺寸。 */
  size?: RatingSize
  /** half 配置项。 */
  half?: boolean
  /** allowHalf 配置项。 */
  allowHalf?: boolean
  /** count 配置项。 */
  count?: number
  /** 受控值。 */
  value?: number
  /** 非受控初始值。 */
  defaultValue?: number
  /** 是否允许一键清空。 */
  allowClear?: boolean
  /** 是否禁用交互。 */
  disabled?: boolean
  /** readOnly 配置项。 */
  readOnly?: boolean
  /** 表单 name 属性或分组名称。 */
  name?: string
  /** character 配置项。 */
  character?: any | ((context: RatingCharacterRenderContext) => any)
  /** tooltips 配置项。 */
  tooltips?: Array<string | number | RatingTooltipItem>
  /** 根节点附加类名。 */
  className?: string
  /** itemClassName 附加类名。 */
  itemClassName?: string
  /** characterClassName 附加类名。 */
  characterClassName?: string
  /** activeCharacterClassName 附加类名。 */
  activeCharacterClassName?: string
  /** inactiveCharacterClassName 附加类名。 */
  inactiveCharacterClassName?: string
  /** clearLabel 标签内容。 */
  clearLabel?: string
  /** 根节点内联样式。 */
  style?: any
  /** 组件子内容。 */
  children?: any
  /** 值或状态变化时触发的回调。 */
  onChange?: (value: number) => void
  /** onHoverChange 事件回调。 */
  onHoverChange?: (value: number) => void
  /** 失去焦点时触发的回调。 */
  onBlur?: (event: Event) => void
  /** 获得焦点时触发的回调。 */
  onFocus?: (event: Event) => void
  /** onKeyDown 事件回调。 */
  onKeyDown?: (event: Event) => void
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** RatingItemProps 组件属性。 */
export interface RatingItemProps {
  /** 自定义渲染的宿主元素。 */
  as?: any
  /** hidden 配置项。 */
  hidden?: boolean
  /** 组件类型或语义类型。 */
  type?: string
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** append Class Name 的内部工具函数。 */
const appendClassName = (base?: string, className?: string) => {
  if (!base) return className ?? ''
  return className ? `${base} ${className}` : base
}

/** 判断是否存在 Renderable Children 的内部工具函数。 */
const hasRenderableChildren = (children: any) => {
  if (Array.isArray(children)) return children.length > 0
  return children != null
}

/** clamp 的内部工具函数。 */
const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

/** 解析 Size Class 的内部工具函数。 */
const resolveSizeClass = (size?: RatingSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'default':
    case 'medium':
    case 'middle':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

/** 解析 Character Size Class 的内部工具函数。 */
const resolveCharacterSizeClass = (size?: RatingSize) => {
  switch (resolveSizeClass(size)) {
    case 'xs':
      return 'text-lg'
    case 'sm':
      return 'text-xl'
    case 'lg':
      return 'text-3xl'
    case 'xl':
      return 'text-4xl'
    default:
      return 'text-2xl'
  }
}

/** 归一化 Count 的内部工具函数。 */
const normalizeCount = (count?: number) => {
  if (typeof count !== 'number' || Number.isNaN(count)) return 5
  return Math.max(1, Math.round(count))
}

/** 归一化 Rating Value 的内部工具函数。 */
const normalizeRatingValue = (value: unknown, allowHalf: boolean, count: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  const bounded = clamp(value, 0, count)
  const stepped = allowHalf ? Math.round(bounded * 2) / 2 : Math.round(bounded)
  return Number(stepped.toFixed(1))
}

/** LEGACY_EMPTY_OPACITY 内部常量。 */
const LEGACY_EMPTY_OPACITY = '0.35'
/** LEGACY_FILLED_OPACITY 内部常量。 */
const LEGACY_FILLED_OPACITY = '1'
/** LEGACY_DISABLED_OPACITY 内部常量。 */
const LEGACY_DISABLED_OPACITY = '0.45'
/** LEGACY_ACTIVE_BACKGROUND_CLASS 内部常量。 */
const LEGACY_ACTIVE_BACKGROUND_CLASS = 'bg-orange-400'
/** LEGACY_INACTIVE_BACKGROUND_CLASS 内部常量。 */
const LEGACY_INACTIVE_BACKGROUND_CLASS = 'bg-base-content'

/** 构建 Manual Root Class Name 的内部工具函数。 */
const buildManualRootClassName = (size?: RatingSize, half?: boolean, className?: string) => {
  let cls = 'rating'
  const resolvedSize = resolveSizeClass(size)
  if (resolvedSize) cls += ` rating-${resolvedSize}`
  if (half) cls += ' rating-half'
  if (className) cls += ` ${className}`
  return cls
}

/** 构建 Auto Root Class Name 的内部工具函数。 */
const buildAutoRootClassName = (
  size: RatingSize | undefined,
  disabled: boolean,
  readOnly: boolean,
  useLegacyMaskDefault: boolean,
  className?: string,
) => {
  let cls = useLegacyMaskDefault
    ? buildManualRootClassName(size, false, 'rue-rating align-middle select-none')
    : appendClassName(
        'rue-rating inline-flex flex-wrap items-center gap-1 align-middle select-none',
        resolveCharacterSizeClass(size),
      )
  if (disabled) cls = appendClassName(cls, 'cursor-not-allowed opacity-50')
  else if (readOnly) cls = appendClassName(cls, 'cursor-default opacity-85')
  else cls = appendClassName(cls, 'cursor-pointer')
  return appendClassName(cls, className)
}

/** 构建 Auto Button Class Name 的内部工具函数。 */
const buildAutoButtonClassName = (
  interactive: boolean,
  useLegacyMaskDefault: boolean,
  itemClassName?: string,
) => {
  let cls = useLegacyMaskDefault
    ? 'group relative inline-flex shrink-0 items-center justify-center border-0 bg-transparent p-0 leading-none opacity-100 transition duration-150'
    : 'group relative inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0.5 leading-none transition duration-150'
  if (interactive)
    cls = appendClassName(
      cls,
      'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
    )
  else cls = appendClassName(cls, 'focus:outline-none')
  return appendClassName(cls, itemClassName)
}

/** 构建 Character Wrapper Class Name 的内部工具函数。 */
const buildCharacterWrapperClassName = (size?: RatingSize, characterClassName?: string) => {
  return appendClassName(
    'relative inline-flex items-center justify-center leading-none',
    appendClassName(resolveCharacterSizeClass(size), characterClassName),
  )
}

/** sync Legacy Mask State 的内部工具函数。 */
const syncLegacyMaskState = (legacyMask: HTMLElement, fill: number, disabled: boolean) => {
  legacyMask.classList.remove(LEGACY_ACTIVE_BACKGROUND_CLASS, LEGACY_INACTIVE_BACKGROUND_CLASS)
  legacyMask.classList.add(
    disabled || fill <= 0 ? LEGACY_INACTIVE_BACKGROUND_CLASS : LEGACY_ACTIVE_BACKGROUND_CLASS,
  )
  legacyMask.style.opacity = disabled
    ? LEGACY_DISABLED_OPACITY
    : fill > 0
      ? LEGACY_FILLED_OPACITY
      : LEGACY_EMPTY_OPACITY
}

/** 解析 Tooltip Title 的内部工具函数。 */
const resolveTooltipTitle = (tooltips: RatingProps['tooltips'], index: number) => {
  const tooltip = tooltips?.[index]
  if (tooltip == null) return undefined
  if (typeof tooltip === 'string' || typeof tooltip === 'number') return String(tooltip)
  if (typeof tooltip === 'object' && 'title' in tooltip && tooltip.title != null) {
    return String(tooltip.title)
  }
  return undefined
}

/** 解析 Pointer Value 的内部工具函数。 */
const resolvePointerValue = (event: MouseEvent, index: number, allowHalf: boolean) => {
  const fullValue = index + 1
  if (!allowHalf) return fullValue
  const target = event.currentTarget as HTMLElement | null
  const rect = target?.getBoundingClientRect?.()
  if (!rect || !rect.width) return fullValue
  return event.clientX - rect.left <= rect.width / 2 ? index + 0.5 : fullValue
}

/** Default Star Icon 的内部工具函数。 */
const DefaultStarIcon: FC = () => {
  return <span aria-hidden="true" className="mask mask-star inline-block size-[1em] bg-current" />
}

/** 解析 Character Node 的内部工具函数。 */
const resolveCharacterNode = (
  character: RatingProps['character'],
  context: RatingCharacterRenderContext,
) => {
  if (typeof character === 'function') {
    return character(context)
  }
  return character ?? <DefaultStarIcon />
}

/** Item 的内部工具函数。 */
const Item: FC<RatingItemProps> = ({
  as = 'input',
  hidden,
  type,
  className,
  children,
  ...rest
}) => {
  const Component = as as any
  const cls = appendClassName(hidden ? 'rating-hidden' : undefined, className).trim()

  if (Component === 'input') {
    return <input {...rest} type={type ?? 'radio'} className={cls || undefined} />
  }

  return (
    <Component {...rest} className={cls || undefined}>
      {children}
    </Component>
  )
}

/** Rating Root 的内部工具函数。 */
const RatingRoot: FC<RatingProps> = ({
  size,
  half,
  allowHalf,
  count,
  value,
  defaultValue,
  allowClear = true,
  disabled,
  readOnly,
  name,
  character,
  tooltips,
  className,
  itemClassName,
  characterClassName,
  activeCharacterClassName,
  inactiveCharacterClassName,
  clearLabel = 'clear rating',
  style,
  children,
  onChange,
  onHoverChange,
  onBlur,
  onFocus,
  onKeyDown,
  ...rest
}) => {
  const mergedAllowHalf = allowHalf ?? half ?? false
  const mergedCount = normalizeCount(count)
  const generatedName = ref(name ?? `rue-rating-${ratingSeed++}`)
  const rootRef = useRef<HTMLDivElement>()
  const uncontrolledValue = ref(
    normalizeRatingValue(defaultValue ?? value ?? 0, mergedAllowHalf, mergedCount),
  )
  const hoveredValue = ref<number | null>(null)
  const controlledValue =
    typeof value === 'number'
      ? normalizeRatingValue(value, mergedAllowHalf, mergedCount)
      : undefined

  if (controlledValue !== undefined && uncontrolledValue.value !== controlledValue) {
    uncontrolledValue.value = controlledValue
  }

  const mergedValue =
    controlledValue !== undefined
      ? controlledValue
      : normalizeRatingValue(uncontrolledValue.value, mergedAllowHalf, mergedCount)
  const displayValue = hoveredValue.value ?? mergedValue
  const interactive = !disabled && !readOnly
  const useLegacyMaskDefault = character == null && !mergedAllowHalf
  const { onMouseLeave: externalMouseLeave, ...restProps } = rest as {
    onMouseLeave?: (event: MouseEvent) => void
    [key: string]: any
  }

  const emitHoverChange = (nextValue: number) => {
    if (onHoverChange) onHoverChange(nextValue)
  }

  const syncDom = () => {
    const root = rootRef.current

    if (!root) return

    const currentValue = normalizeRatingValue(uncontrolledValue.value, mergedAllowHalf, mergedCount)
    const currentDisplayValue = hoveredValue.value ?? currentValue

    root.dataset.ratingValue = String(currentValue)
    root.dataset.ratingHover = hoveredValue.value == null ? '' : String(hoveredValue.value)

    const hiddenInput = root.querySelector(
      'input[type="hidden"][data-rating-hidden="true"]',
    ) as HTMLInputElement | null
    if (hiddenInput) {
      hiddenInput.value = String(currentValue)
    }

    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('button[data-rating-index]'),
    )
    buttons.forEach(button => {
      const index = Number(button.dataset.ratingIndex ?? 0)
      const itemValue = index + 1
      const fill = clamp(currentDisplayValue - index, 0, 1)
      const activeLayer = button.querySelector(
        '[data-rating-active-layer="true"]',
      ) as HTMLElement | null
      const legacyMask = button.querySelector(
        '[data-rating-legacy-mask="true"]',
      ) as HTMLElement | null

      button.dataset.ratingFill = String(fill)
      if (currentValue === itemValue) button.dataset.ratingCurrent = 'true'
      else delete button.dataset.ratingCurrent
      button.setAttribute('aria-pressed', fill > 0 ? 'true' : 'false')
      button.tabIndex = disabled
        ? -1
        : currentValue > 0
          ? Math.ceil(currentValue) - 1 === index
            ? 0
            : -1
          : index === 0
            ? 0
            : -1

      if (activeLayer) {
        activeLayer.style.width = `${fill * 100}%`
      }

      if (legacyMask) {
        syncLegacyMaskState(legacyMask, fill, !!disabled)
      }
    })
  }

  /**
   * hover 态只用于预览分值；离开根节点后统一回落到真实值，避免每个 item 自己做清理导致闪烁。
   */
  const clearHover = () => {
    if (hoveredValue.value !== null) {
      hoveredValue.value = null
      emitHoverChange(0)
      syncDom()
    }
  }

  const commitValue = (rawValue: number) => {
    if (!interactive) return
    const normalizedNext = normalizeRatingValue(rawValue, mergedAllowHalf, mergedCount)
    const nextValue = allowClear && mergedValue === normalizedNext ? 0 : normalizedNext

    uncontrolledValue.value = nextValue
    hoveredValue.value = null
    emitHoverChange(0)
    syncDom()
    if (onChange) onChange(nextValue)
  }

  const step = mergedAllowHalf ? 0.5 : 1

  const handleKeyCommit = (event: Event, index: number) => {
    const nativeEvent = event as KeyboardEvent
    const key = nativeEvent.key
    let nextValue: number | null = null

    if (key === 'ArrowRight' || key === 'ArrowUp') {
      nextValue = clamp(mergedValue + step, allowClear ? 0 : step, mergedCount)
    } else if (key === 'ArrowLeft' || key === 'ArrowDown') {
      nextValue = clamp(mergedValue - step, allowClear ? 0 : step, mergedCount)
    } else if (key === 'Home') {
      nextValue = allowClear ? 0 : step
    } else if (key === 'End') {
      nextValue = mergedCount
    } else if ((key === 'Backspace' || key === 'Delete') && allowClear) {
      nextValue = 0
    } else if (key === ' ' || key === 'Enter') {
      nextValue = index + 1
    }

    if (nextValue === null) {
      if (onKeyDown) onKeyDown(event)
      return
    }

    nativeEvent.preventDefault?.()
    if (nextValue === 0) {
      uncontrolledValue.value = 0
      hoveredValue.value = null
      emitHoverChange(0)
      syncDom()
      if (interactive && onChange) onChange(0)
    } else {
      commitValue(nextValue)
    }

    if (onKeyDown) onKeyDown(event)
  }

  onMounted(() => {
    syncDom()
  })

  watch(
    () =>
      typeof value === 'number'
        ? normalizeRatingValue(value, mergedAllowHalf, mergedCount)
        : undefined,
    nextValue => {
      if (typeof nextValue === 'number') {
        uncontrolledValue.value = nextValue
      }
      syncDom()
    },
    { immediate: true },
  )

  if (hasRenderableChildren(children)) {
    return (
      <div
        {...restProps}
        style={style}
        className={buildManualRootClassName(size, mergedAllowHalf, className)}
      >
        {children}
      </div>
    )
  }

  const renderedName = name ?? generatedName.value
  const buttonCount = Array.from({ length: mergedCount }, (_, index) => index)

  return (
    <div
      {...restProps}
      ref={rootRef}
      style={style}
      className={buildAutoRootClassName(
        size,
        !!disabled,
        !!readOnly,
        useLegacyMaskDefault,
        className,
      )}
      data-rating-mode="auto"
      data-rating-value={String(mergedValue)}
      data-rating-hover={hoveredValue.value == null ? '' : String(hoveredValue.value)}
      data-rating-name={renderedName}
      onMouseLeave={(event: MouseEvent) => {
        clearHover()
        if (externalMouseLeave) externalMouseLeave(event as any)
      }}
    >
      {name ? (
        <input
          type="hidden"
          name={name}
          value={mergedValue}
          disabled={disabled}
          data-rating-hidden="true"
        />
      ) : null}
      {buttonCount.map(index => {
        const itemValue = index + 1
        const fill = clamp(displayValue - index, 0, 1)
        const checked = mergedValue >= itemValue
        const hovered = hoveredValue.value !== null && displayValue >= itemValue
        const tooltipTitle = resolveTooltipTitle(tooltips, index)
        const characterContext = {
          index,
          value: itemValue,
          fill,
          checked,
          hovered,
          half: mergedAllowHalf,
        }
        const wrapperClassName = buildCharacterWrapperClassName(size, characterClassName)
        const resolvedInactiveCharacterClassName =
          inactiveCharacterClassName ?? 'text-base-content/35'
        const resolvedActiveCharacterClassName = activeCharacterClassName ?? 'text-orange-400'
        const tabIndex = disabled
          ? -1
          : mergedValue > 0
            ? Math.ceil(mergedValue) - 1 === index
              ? 0
              : -1
            : index === 0
              ? 0
              : -1

        return (
          <button
            key={`${renderedName}-${index}`}
            type="button"
            role="button"
            title={tooltipTitle}
            aria-label={tooltipTitle ?? `${itemValue} star`}
            aria-disabled={disabled ? 'true' : undefined}
            aria-pressed={fill > 0 ? 'true' : 'false'}
            tabIndex={tabIndex}
            disabled={disabled}
            className={buildAutoButtonClassName(interactive, useLegacyMaskDefault, itemClassName)}
            data-rating-index={String(index)}
            data-rating-fill={String(fill)}
            data-rating-current={mergedValue === itemValue ? 'true' : undefined}
            onFocus={(event: FocusEvent) => {
              if (onFocus) onFocus(event as any)
            }}
            onBlur={(event: FocusEvent) => {
              if (onBlur) onBlur(event as any)
            }}
            onMouseMove={(event: MouseEvent) => {
              if (!interactive) return
              const nextValue = resolvePointerValue(event as any, index, mergedAllowHalf)
              if (hoveredValue.value !== nextValue) {
                hoveredValue.value = nextValue
                emitHoverChange(nextValue)
                syncDom()
              }
            }}
            onClick={(event: MouseEvent) => {
              event.preventDefault?.()
              commitValue(resolvePointerValue(event as any, index, mergedAllowHalf))
            }}
            onKeyDown={(event: KeyboardEvent) => handleKeyCommit(event as any, index)}
          >
            {useLegacyMaskDefault ? (
              <span
                className={appendClassName(
                  appendClassName(
                    'mask mask-star inline-block size-[1em] transition-colors duration-150',
                    disabled
                      ? `${LEGACY_INACTIVE_BACKGROUND_CLASS} opacity-45`
                      : fill > 0
                        ? `${LEGACY_ACTIVE_BACKGROUND_CLASS} opacity-100`
                        : `${LEGACY_INACTIVE_BACKGROUND_CLASS} opacity-[0.35]`,
                  ),
                  characterClassName,
                )}
                aria-hidden="true"
                data-rating-legacy-mask="true"
              />
            ) : (
              <span className="relative inline-flex">
                <span
                  className={appendClassName(
                    wrapperClassName,
                    disabled ? 'text-base-content/20' : resolvedInactiveCharacterClassName,
                  )}
                  aria-hidden="true"
                >
                  {resolveCharacterNode(character, characterContext)}
                </span>
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                  aria-hidden="true"
                  data-rating-active-layer="true"
                >
                  <span
                    className={appendClassName(
                      wrapperClassName,
                      disabled ? 'text-base-content/45' : resolvedActiveCharacterClassName,
                    )}
                  >
                    {resolveCharacterNode(character, characterContext)}
                  </span>
                </span>
              </span>
            )}
            {allowClear && interactive && mergedValue > 0 && mergedValue === itemValue ? (
              <span className="sr-only">{clearLabel}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

type RatingCompound = FC<RatingProps> & {
  Item: FC<RatingItemProps>
}

const RatingCompound: RatingCompound = Object.assign(RatingRoot, {
  Item,
})

/** 默认导出评分组件。 */
export default RatingCompound
