/*
Swap 组件概述
- 保留 Rue 当前 swap 视觉类与 compound 结构。
- 同时支持两类用法：手动放入 checkbox 的原始模式，以及通过 checked/defaultChecked 等 props 驱动的增强模式。
- 增强模式补齐 disabled、indeterminate、默认三态与变更回调，适合直接在业务里使用。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'

export type SwapEffect = 'rotate' | 'flip'

export interface SwapChangeMeta {
  checked: boolean
  indeterminate: boolean
  active: boolean
  mode: 'input' | 'class'
}

export interface SwapProps {
  as?: any
  active?: boolean
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  indeterminate?: boolean
  defaultIndeterminate?: boolean
  rotate?: boolean
  flip?: boolean
  effect?: SwapEffect
  className?: string
  inputClassName?: string
  inputProps?: Record<string, any>
  children?: any
  onChange?: (event: Event, meta: SwapChangeMeta) => void
  onCheckedChange?: (checked: boolean, event: Event) => void
  [key: string]: any
}

export interface SwapPartProps {
  as?: any
  className?: string
  children?: any
  [key: string]: any
}

const mergeClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

const flattenChildren = (children: any, out: any[] = []) => {
  if (children == null || children === false) {
    return out
  }
  if (Array.isArray(children)) {
    children.forEach(child => flattenChildren(child, out))
    return out
  }
  out.push(children)
  return out
}

const hasCheckboxInputChild = (children: any) =>
  flattenChildren(children).some(child => {
    if (!child || typeof child !== 'object') return false
    return (child as any).type === 'input' && (child as any).props?.type === 'checkbox'
  })

const buildRootClassName = (
  active?: boolean,
  rotate?: boolean,
  flip?: boolean,
  effect?: SwapEffect,
  disabled?: boolean,
  className?: string,
) => {
  let cls = 'swap'
  if (active) cls += ' swap-active'
  if (rotate || effect === 'rotate') cls += ' swap-rotate'
  if (flip || effect === 'flip') cls += ' swap-flip'
  if (disabled) cls += ' cursor-not-allowed opacity-60'
  if (className) cls += ` ${className}`
  return cls
}

const SwapRoot: FC<SwapProps> = ({
  as = 'label',
  active,
  checked,
  defaultChecked,
  disabled,
  indeterminate,
  defaultIndeterminate,
  rotate,
  flip,
  effect,
  className,
  inputClassName,
  inputProps,
  children,
  onChange,
  onCheckedChange,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>()
  const uncontrolledIndeterminate = ref(!!defaultIndeterminate)
  const hasInputChild = hasCheckboxInputChild(children)
  const hasManagedInputProps =
    typeof checked === 'boolean' ||
    typeof defaultChecked === 'boolean' ||
    typeof disabled === 'boolean' ||
    typeof indeterminate === 'boolean' ||
    typeof defaultIndeterminate === 'boolean' ||
    !!inputClassName ||
    !!inputProps ||
    !!onChange ||
    !!onCheckedChange
  const shouldRenderAutoInput = !hasInputChild && hasManagedInputProps
  const mode: SwapChangeMeta['mode'] = hasInputChild || shouldRenderAutoInput ? 'input' : 'class'
  const Component = as as any

  const syncInputState = () => {
    if (!inputRef.current) return
    if (typeof checked === 'boolean') {
      inputRef.current.checked = checked
    }
    inputRef.current.indeterminate =
      typeof indeterminate === 'boolean' ? indeterminate : uncontrolledIndeterminate.value
  }

  const handleChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    const nextChecked = target?.checked === true
    const nextIndeterminate = typeof indeterminate === 'boolean' ? indeterminate : false

    if (typeof indeterminate !== 'boolean') {
      uncontrolledIndeterminate.value = false
    }

    if (typeof checked === 'boolean' && inputRef.current) {
      inputRef.current.checked = checked
    }

    syncInputState()

    if (onChange) {
      onChange(event, {
        checked: nextChecked,
        indeterminate: nextIndeterminate,
        active: !!active || nextChecked,
          mode,
      })
    }
    if (onCheckedChange) {
      onCheckedChange(nextChecked, event)
    }
  }

  onMounted(() => {
    syncInputState()
  })

  watch(
    () => checked,
    () => {
      syncInputState()
    },
    { immediate: true },
  )

  watch(
    () => indeterminate,
    () => {
      syncInputState()
    },
    { immediate: true },
  )

  watch(
    () => uncontrolledIndeterminate.value,
    () => {
      syncInputState()
    },
  )

  return (
    <Component
      {...rest}
      className={buildRootClassName(active, rotate, flip, effect, disabled, className)}
      aria-disabled={disabled ? 'true' : rest['aria-disabled']}
      data-rue-swap-root="true"
      data-rue-swap-mode={mode}
      data-rue-swap-disabled={disabled ? 'true' : 'false'}
    >
      {shouldRenderAutoInput ? (
        <input
          {...inputProps}
          ref={inputRef}
          type="checkbox"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          autoComplete={inputProps?.autoComplete ?? 'off'}
          className={inputClassName}
          aria-checked={
            (typeof indeterminate === 'boolean' ? indeterminate : uncontrolledIndeterminate.value)
              ? 'mixed'
              : inputProps?.['aria-checked']
          }
          data-rue-swap-input="true"
          onChange={handleChange}
        />
      ) : null}
      {children}
    </Component>
  )
}

const On: FC<SwapPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={mergeClassName('swap-on', className)}>
      {children}
    </Component>
  )
}

const Off: FC<SwapPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={mergeClassName('swap-off', className)}>
      {children}
    </Component>
  )
}

const Indeterminate: FC<SwapPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={mergeClassName('swap-indeterminate', className)}>
      {children}
    </Component>
  )
}

type SwapCompound = FC<SwapProps> & {
  On: FC<SwapPartProps>
  Off: FC<SwapPartProps>
  Indeterminate: FC<SwapPartProps>
}

const SwapCompound: SwapCompound = Object.assign(SwapRoot, {
  On,
  Off,
  Indeterminate,
})

export default SwapCompound
