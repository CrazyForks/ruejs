/* RUE_VAPOR_TRANSFORMED */
import type { FC } from '@rue-js/rue'

export type FieldsetTone =
  | 'default'
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type FieldsetVariant = 'default' | 'soft' | 'outlined'
export type FieldsetSize = 'sm' | 'md' | 'lg' | 'small' | 'middle' | 'medium' | 'large'

export interface FieldsetRootProps {
  className?: string
  children?: any
  legend?: any
  description?: any
  hint?: any
  actions?: any
  content?: any
  items?: ReadonlyArray<FieldsetItemData>
  size?: FieldsetSize
  tone?: FieldsetTone
  variant?: FieldsetVariant
  bordered?: boolean
  invalid?: boolean
  legendClassName?: string
  descriptionClassName?: string
  hintClassName?: string
  contentClassName?: string
  actionsClassName?: string
  [key: string]: any
}

export interface FieldsetLegendProps {
  className?: string
  children?: any
  aside?: any
  [key: string]: any
}

export interface FieldsetLabelProps {
  as?: 'label' | 'p' | 'span' | 'div'
  className?: string
  children?: any
  tone?: FieldsetTone | 'muted'
  [key: string]: any
}

export interface FieldsetItemProps {
  className?: string
  children?: any
  label?: any
  description?: any
  hint?: any
  control?: any
  required?: boolean
  optional?: boolean
  horizontal?: boolean
  size?: FieldsetSize
  tone?: FieldsetTone
  invalid?: boolean
  labelClassName?: string
  descriptionClassName?: string
  hintClassName?: string
  contentClassName?: string
  labelProps?: Omit<FieldsetLabelProps, 'children' | 'className'>
  descriptionProps?: Omit<FieldsetLabelProps, 'children' | 'className' | 'as'>
  hintProps?: Omit<FieldsetLabelProps, 'children' | 'className' | 'as'>
  [key: string]: any
}

export interface FieldsetItemData extends Omit<FieldsetItemProps, 'children'> {
  key?: string | number
}

const joinClassName = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ')

const hasRenderableContent = (value: any): boolean => {
  if (value === undefined || value === null || value === false) return false
  if (Array.isArray(value)) return value.some(item => hasRenderableContent(item))
  return true
}

const resolveSize = (size?: FieldsetSize): 'sm' | 'md' | 'lg' => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'middle':
    case 'medium':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size ?? 'md'
  }
}

const resolveGapClass = (size?: FieldsetSize) => {
  switch (resolveSize(size)) {
    case 'sm':
      return 'gap-2'
    case 'lg':
      return 'gap-4'
    default:
      return 'gap-3'
  }
}

const resolveSurfaceClass = ({
  variant,
  tone,
  bordered,
  invalid,
}: Pick<FieldsetRootProps, 'variant' | 'tone' | 'bordered' | 'invalid'>) => {
  if (invalid) return 'rounded-box border border-error/30 bg-error/5 p-4'

  if (variant === 'soft') {
    switch (tone) {
      case 'neutral':
        return 'rounded-box bg-neutral/5 p-4'
      case 'primary':
        return 'rounded-box bg-primary/5 p-4'
      case 'secondary':
        return 'rounded-box bg-secondary/5 p-4'
      case 'accent':
        return 'rounded-box bg-accent/5 p-4'
      case 'info':
        return 'rounded-box bg-info/8 p-4'
      case 'success':
        return 'rounded-box bg-success/8 p-4'
      case 'warning':
        return 'rounded-box bg-warning/10 p-4'
      case 'error':
        return 'rounded-box bg-error/8 p-4'
      default:
        return 'rounded-box bg-base-200 p-4'
    }
  }

  if (variant === 'outlined' || bordered) {
    switch (tone) {
      case 'neutral':
        return 'rounded-box border border-neutral/20 bg-neutral/5 p-4'
      case 'primary':
        return 'rounded-box border border-primary/25 bg-primary/5 p-4'
      case 'secondary':
        return 'rounded-box border border-secondary/25 bg-secondary/5 p-4'
      case 'accent':
        return 'rounded-box border border-accent/25 bg-accent/5 p-4'
      case 'info':
        return 'rounded-box border border-info/30 bg-info/8 p-4'
      case 'success':
        return 'rounded-box border border-success/30 bg-success/8 p-4'
      case 'warning':
        return 'rounded-box border border-warning/35 bg-warning/10 p-4'
      case 'error':
        return 'rounded-box border border-error/30 bg-error/8 p-4'
      default:
        return 'rounded-box border border-base-300 bg-base-100 p-4'
    }
  }

  return undefined
}

const resolveTextToneClass = (tone?: FieldsetTone | 'muted') => {
  switch (tone) {
    case 'muted':
      return 'opacity-70'
    case 'neutral':
      return 'text-neutral'
    case 'primary':
      return 'text-primary'
    case 'secondary':
      return 'text-secondary'
    case 'accent':
      return 'text-accent'
    case 'info':
      return 'text-info'
    case 'success':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'error':
      return 'text-error'
    default:
      return undefined
  }
}

const resolveLabelTextClass = (size?: FieldsetSize) => {
  switch (resolveSize(size)) {
    case 'sm':
      return 'text-xs'
    case 'lg':
      return 'text-sm'
    default:
      return 'text-sm'
  }
}

const resolveHintTextClass = (size?: FieldsetSize) => {
  switch (resolveSize(size)) {
    case 'lg':
      return 'text-sm'
    default:
      return 'text-xs'
  }
}

const Legend: FC<FieldsetLegendProps> = ({ className, children, aside, ...rest }) => {
  const hasAside = hasRenderableContent(aside)
  return (
    <legend {...rest} className={joinClassName('fieldset-legend', className)}>
      {hasAside ? (
        <span className="flex w-full items-center gap-2">
          <span>{children}</span>
          <span className="ml-auto text-xs font-normal opacity-65">{aside}</span>
        </span>
      ) : (
        children
      )}
    </legend>
  )
}

const Label: FC<FieldsetLabelProps> = ({ as = 'label', className, children, tone, ...rest }) => {
  const cls = joinClassName('label', resolveTextToneClass(tone), className)

  if (as === 'p') {
    return (
      <p {...rest} className={joinClassName(cls, 'min-w-0 whitespace-normal break-words')}>
        {children}
      </p>
    )
  }

  if (as === 'span') {
    return (
      <span {...rest} className={cls}>
        {children}
      </span>
    )
  }

  if (as === 'div') {
    return (
      <div {...rest} className={cls}>
        {children}
      </div>
    )
  }

  return (
    <label {...rest} className={cls}>
      {children}
    </label>
  )
}

const Item: FC<FieldsetItemProps> = ({
  className,
  children,
  label,
  description,
  hint,
  control,
  required,
  optional,
  horizontal,
  size,
  tone,
  invalid,
  labelClassName,
  descriptionClassName,
  hintClassName,
  contentClassName,
  labelProps,
  descriptionProps,
  hintProps,
  ...rest
}) => {
  const resolvedTone = invalid ? 'error' : tone
  const labelNode = hasRenderableContent(label) ? (
    <Label
      {...labelProps}
      className={joinClassName(
        'justify-start gap-2 font-medium',
        resolveLabelTextClass(size),
        labelClassName,
      )}
      tone={resolvedTone}
    >
      <span>{label}</span>
      {required ? <span className="text-error text-xs font-medium">必填</span> : null}
      {!required && optional ? <span className="text-xs opacity-60">可选</span> : null}
    </Label>
  ) : null
  const descriptionNode = hasRenderableContent(description) ? (
    <Label
      {...descriptionProps}
      as="p"
      className={joinClassName(
        'mt-0 min-h-0 px-0 pb-0',
        resolveHintTextClass(size),
        descriptionClassName,
      )}
      tone={invalid ? 'error' : (descriptionProps?.tone ?? 'muted')}
    >
      {description}
    </Label>
  ) : null
  const hintNode = hasRenderableContent(hint) ? (
    <Label
      {...hintProps}
      as="p"
      className={joinClassName('mt-0 min-h-0 px-0 pt-1', resolveHintTextClass(size), hintClassName)}
      tone={invalid ? 'error' : (hintProps?.tone ?? 'muted')}
    >
      {hint}
    </Label>
  ) : null
  const controlNode = control ?? children
  const hasMeta = !!labelNode || !!descriptionNode
  const hasControl = hasRenderableContent(controlNode) || !!hintNode

  return (
    <div
      {...rest}
      className={joinClassName(
        horizontal ? 'grid gap-3 md:grid-cols-[minmax(0,12rem)_1fr] md:items-start' : 'grid gap-2',
        className,
      )}
    >
      {hasMeta ? (
        <div className="min-w-0">
          {labelNode}
          {descriptionNode}
        </div>
      ) : null}
      {hasControl ? (
        <div className={joinClassName('min-w-0', contentClassName)}>
          {controlNode}
          {hintNode}
        </div>
      ) : null}
    </div>
  )
}

const Root: FC<FieldsetRootProps> = ({
  className,
  children,
  legend,
  description,
  hint,
  actions,
  content,
  items,
  size,
  tone,
  variant,
  bordered,
  invalid,
  legendClassName,
  descriptionClassName,
  hintClassName,
  contentClassName,
  actionsClassName,
  ...rest
}) => {
  const hasChildren = hasRenderableContent(children)
  const structuredContent = hasRenderableContent(content)
    ? content
    : (items ?? []).map((item, index) => {
        const { key, ...itemProps } = item
        return (
          <Item
            key={key ?? index}
            {...itemProps}
            size={item.size ?? size}
            invalid={item.invalid ?? invalid}
          />
        )
      })
  const ariaInvalid = invalid ? 'true' : rest['aria-invalid']
  if ('aria-invalid' in rest) {
    delete rest['aria-invalid']
  }
  const fieldsetAriaInvalidProps: Record<string, any> = {}
  if (ariaInvalid !== undefined && ariaInvalid !== null) {
    fieldsetAriaInvalidProps['aria-invalid'] = ariaInvalid
  }

  return (
    <fieldset
      {...rest}
      {...fieldsetAriaInvalidProps}
      className={joinClassName(
        'fieldset',
        resolveGapClass(size),
        resolveSurfaceClass({ variant, tone, bordered, invalid }),
        className,
      )}
    >
      {hasChildren ? (
        children
      ) : (
        <>
          {hasRenderableContent(legend) ? (
            <Legend className={joinClassName(invalid && 'text-error', legendClassName)}>
              {legend}
            </Legend>
          ) : null}
          {hasRenderableContent(description) ? (
            <Label
              as="p"
              tone={invalid ? 'error' : 'muted'}
              className={joinClassName(
                'mt-0 min-h-0 px-0',
                resolveLabelTextClass(size),
                descriptionClassName,
              )}
            >
              {description}
            </Label>
          ) : null}
          {hasRenderableContent(structuredContent) ? (
            <div className={joinClassName('grid min-w-0', resolveGapClass(size), contentClassName)}>
              {structuredContent}
            </div>
          ) : null}
          {hasRenderableContent(hint) ? (
            <Label
              as="p"
              tone={invalid ? 'error' : 'muted'}
              className={joinClassName(
                'mt-0 min-h-0 px-0',
                resolveHintTextClass(size),
                hintClassName,
              )}
            >
              {hint}
            </Label>
          ) : null}
          {hasRenderableContent(actions) ? (
            <div
              className={joinClassName('mt-1 flex flex-wrap justify-end gap-2', actionsClassName)}
            >
              {actions}
            </div>
          ) : null}
        </>
      )}
    </fieldset>
  )
}

type FieldsetCompound = FC<FieldsetRootProps> & {
  Legend: FC<FieldsetLegendProps>
  Label: FC<FieldsetLabelProps>
  Item: FC<FieldsetItemProps>
}

const Fieldset: FieldsetCompound = Object.assign(Root, {
  Legend,
  Label,
  Item,
})

export default Fieldset
