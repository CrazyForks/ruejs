/*
Rating 组件概述
- 默认提供语义化评分 API，支持受控/非受控、清除、半星、悬停反馈与自定义字符。
- 保留 Rating.Item 复合写法，兼容现有基于 daisyUI `rating` 结构的老 demo。
- 自动模式使用字符双层填充实现分数显示，既能保留 Rue 当前轻量视觉，也能承载自定义字符。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'

let ratingSeed = 0

export type RatingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'default' | 'medium' | 'middle' | 'large'

export interface RatingTooltipItem {
  title?: any
}

export interface RatingCharacterRenderContext {
  index: number
  value: number
  fill: number
  checked: boolean
  hovered: boolean
  half: boolean
}

export interface RatingProps {
  size?: RatingSize
  half?: boolean
  allowHalf?: boolean
  count?: number
  value?: number
  defaultValue?: number
  allowClear?: boolean
  disabled?: boolean
  readOnly?: boolean
  name?: string
  character?: any | ((context: RatingCharacterRenderContext) => any)
  tooltips?: Array<string | number | RatingTooltipItem>
  className?: string
  itemClassName?: string
  characterClassName?: string
  activeCharacterClassName?: string
  inactiveCharacterClassName?: string
  clearLabel?: string
  style?: any
  children?: any
  onChange?: (value: number) => void
  onHoverChange?: (value: number) => void
  onBlur?: (event: Event) => void
  onFocus?: (event: Event) => void
  onKeyDown?: (event: Event) => void
  [key: string]: any
}

export interface RatingItemProps {
  as?: any
  hidden?: boolean
  type?: string
  className?: string
  children?: any
  [key: string]: any
}

const appendClassName = (base?: string, className?: string) => {
  if (!base) return className ?? ''
  return className ? `${base} ${className}` : base
}

const hasRenderableChildren = (children: any) => {
  if (Array.isArray(children)) return children.length > 0
  return children != null
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

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

const normalizeCount = (count?: number) => {
  if (typeof count !== 'number' || Number.isNaN(count)) return 5
  return Math.max(1, Math.round(count))
}

const normalizeRatingValue = (value: unknown, allowHalf: boolean, count: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  const bounded = clamp(value, 0, count)
  const stepped = allowHalf ? Math.round(bounded * 2) / 2 : Math.round(bounded)
  return Number(stepped.toFixed(1))
}

const LEGACY_EMPTY_OPACITY = '0.35'
const LEGACY_FILLED_OPACITY = '1'
const LEGACY_DISABLED_OPACITY = '0.45'
const LEGACY_ACTIVE_BACKGROUND_CLASS = 'bg-orange-400'
const LEGACY_INACTIVE_BACKGROUND_CLASS = 'bg-base-content'

const buildManualRootClassName = (size?: RatingSize, half?: boolean, className?: string) => {
  let cls = 'rating'
  const resolvedSize = resolveSizeClass(size)
  if (resolvedSize) cls += ` rating-${resolvedSize}`
  if (half) cls += ' rating-half'
  if (className) cls += ` ${className}`
  return cls
}

const buildAutoRootClassName = (
  size: RatingSize | undefined,
  disabled: boolean,
  readOnly: boolean,
  useLegacyMaskDefault: boolean,
  className?: string,
) => {
  let cls = useLegacyMaskDefault
    ? buildManualRootClassName(size, false, 'rue-rating align-middle select-none')
    : appendClassName('rue-rating inline-flex flex-wrap items-center gap-1 align-middle select-none', resolveCharacterSizeClass(size))
  if (disabled) cls = appendClassName(cls, 'cursor-not-allowed opacity-50')
  else if (readOnly) cls = appendClassName(cls, 'cursor-default opacity-85')
  else cls = appendClassName(cls, 'cursor-pointer')
  return appendClassName(cls, className)
}

const buildAutoButtonClassName = (interactive: boolean, useLegacyMaskDefault: boolean, itemClassName?: string) => {
  let cls = useLegacyMaskDefault
    ? 'group relative inline-flex shrink-0 items-center justify-center border-0 bg-transparent p-0 leading-none opacity-100 transition duration-150'
    : 'group relative inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0.5 leading-none transition duration-150'
  if (interactive) cls = appendClassName(cls, 'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25')
  else cls = appendClassName(cls, 'focus:outline-none')
  return appendClassName(cls, itemClassName)
}

const buildCharacterWrapperClassName = (size?: RatingSize, characterClassName?: string) => {
  return appendClassName('relative inline-flex items-center justify-center leading-none', appendClassName(resolveCharacterSizeClass(size), characterClassName))
}

const syncLegacyMaskState = (legacyMask: HTMLElement, fill: number, disabled: boolean) => {
  legacyMask.classList.remove(LEGACY_ACTIVE_BACKGROUND_CLASS, LEGACY_INACTIVE_BACKGROUND_CLASS)
  legacyMask.classList.add(disabled || fill <= 0 ? LEGACY_INACTIVE_BACKGROUND_CLASS : LEGACY_ACTIVE_BACKGROUND_CLASS)
  legacyMask.style.opacity = disabled ? LEGACY_DISABLED_OPACITY : fill > 0 ? LEGACY_FILLED_OPACITY : LEGACY_EMPTY_OPACITY
}

const resolveTooltipTitle = (
  tooltips: RatingProps['tooltips'],
  index: number,
) => {
  const tooltip = tooltips?.[index]
  if (tooltip == null) return undefined
  if (typeof tooltip === 'string' || typeof tooltip === 'number') return String(tooltip)
  if (typeof tooltip === 'object' && 'title' in tooltip && tooltip.title != null) {
    return String(tooltip.title)
  }
  return undefined
}

const resolvePointerValue = (event: MouseEvent, index: number, allowHalf: boolean) => {
  const fullValue = index + 1
  if (!allowHalf) return fullValue
  const target = event.currentTarget as HTMLElement | null
  const rect = target?.getBoundingClientRect?.()
  if (!rect || !rect.width) return fullValue
  return event.clientX - rect.left <= rect.width / 2 ? index + 0.5 : fullValue
}

const DefaultStarIcon: FC = () => {
  return (
    <span aria-hidden="true" className="mask mask-star inline-block size-[1em] bg-current" />
  )
}

const resolveCharacterNode = (
  character: RatingProps['character'],
  context: RatingCharacterRenderContext,
) => {
  if (typeof character === 'function') {
    return character(context)
  }
  return character ?? <DefaultStarIcon />
}

const Item: FC<RatingItemProps> = ({ as = 'input', hidden, type, className, children, ...rest }) => {
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
    typeof value === 'number' ? normalizeRatingValue(value, mergedAllowHalf, mergedCount) : undefined

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
  const {
    onMouseLeave: externalMouseLeave,
    ...restProps
  } = rest as {
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

    const hiddenInput = root.querySelector('input[type="hidden"][data-rating-hidden="true"]') as HTMLInputElement | null
    if (hiddenInput) {
      hiddenInput.value = String(currentValue)
    }

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-rating-index]'))
    buttons.forEach(button => {
      const index = Number(button.dataset.ratingIndex ?? 0)
      const itemValue = index + 1
      const fill = clamp(currentDisplayValue - index, 0, 1)
      const activeLayer = button.querySelector('[data-rating-active-layer="true"]') as HTMLElement | null
      const legacyMask = button.querySelector('[data-rating-legacy-mask="true"]') as HTMLElement | null

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
    () => (typeof value === 'number' ? normalizeRatingValue(value, mergedAllowHalf, mergedCount) : undefined),
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
      <div {...restProps} style={style} className={buildManualRootClassName(size, mergedAllowHalf, className)}>
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
      className={buildAutoRootClassName(size, !!disabled, !!readOnly, useLegacyMaskDefault, className)}
      data-rating-mode="auto"
      data-rating-value={String(mergedValue)}
      data-rating-hover={hoveredValue.value == null ? '' : String(hoveredValue.value)}
      data-rating-name={renderedName}
      onMouseLeave={event => {
        clearHover()
        if (externalMouseLeave) externalMouseLeave(event as any)
      }}
    >
      {name ? <input type="hidden" name={name} value={mergedValue} disabled={disabled} data-rating-hidden="true" /> : null}
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
        const resolvedInactiveCharacterClassName = inactiveCharacterClassName ?? 'text-base-content/35'
        const resolvedActiveCharacterClassName = activeCharacterClassName ?? 'text-orange-400'
        const tabIndex = disabled ? -1 : mergedValue > 0 ? (Math.ceil(mergedValue) - 1 === index ? 0 : -1) : index === 0 ? 0 : -1

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
            onFocus={event => {
              if (onFocus) onFocus(event as any)
            }}
            onBlur={event => {
              if (onBlur) onBlur(event as any)
            }}
            onMouseMove={event => {
              if (!interactive) return
              const nextValue = resolvePointerValue(event as any, index, mergedAllowHalf)
              if (hoveredValue.value !== nextValue) {
                hoveredValue.value = nextValue
                emitHoverChange(nextValue)
                syncDom()
              }
            }}
            onClick={event => {
              event.preventDefault?.()
              commitValue(resolvePointerValue(event as any, index, mergedAllowHalf))
            }}
            onKeyDown={event => handleKeyCommit(event as any, index)}
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
                  className={appendClassName(wrapperClassName, disabled ? 'text-base-content/20' : resolvedInactiveCharacterClassName)}
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
                    className={appendClassName(wrapperClassName, disabled ? 'text-base-content/45' : resolvedActiveCharacterClassName)}
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

export default RatingCompound
