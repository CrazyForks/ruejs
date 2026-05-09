/* RUE_VAPOR_TRANSFORMED */
/*
Validator 组件概述
- 保留 daisyUI validator / validator-hint 的原生浏览器校验体验。
- 新增 appearance / size / status 语义层，减少手写宿主类名的负担。
- 提供 Field 组合件，统一 label、hint、extra 的常见表单结构。
*/
import type { FC } from '@rue-js/rue'

export type ValidatorHost = 'input' | 'select' | 'textarea'
export type ValidatorAppearance = 'input' | 'select' | 'textarea' | 'checkbox' | 'toggle'
export type ValidatorHintHost = 'div' | 'p' | 'span'
export type ValidatorFieldHost = 'div' | 'fieldset'
export type ValidatorSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ValidatorStatus = 'error' | 'success' | 'warning'

export interface ValidatorProps {
  as?: ValidatorHost
  appearance?: ValidatorAppearance
  size?: ValidatorSize
  status?: ValidatorStatus
  className?: string
  children?: any
  [key: string]: any
}

export interface ValidatorHintProps {
  as?: ValidatorHintHost
  className?: string
  children?: any
  hideUntilInvalid?: boolean
  lines?: any[]
  [key: string]: any
}

export interface ValidatorFieldProps extends Omit<ValidatorProps, 'className'> {
  fieldAs?: ValidatorFieldHost
  className?: string
  controlClassName?: string
  label?: any
  labelClassName?: string
  hint?: any
  hintAs?: ValidatorHintHost
  hintClassName?: string
  hideHintWhenValid?: boolean
  extra?: any
  extraClassName?: string
  requiredMark?: boolean
}

const VALIDATOR_APPEARANCES: ValidatorAppearance[] = [
  'input',
  'select',
  'textarea',
  'checkbox',
  'toggle',
]

const joinClassNames = (...classNames: Array<string | undefined | false>) =>
  classNames.filter(Boolean).join(' ')

const toClassTokenSet = (className?: string) => {
  return new Set(
    (className ?? '')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean),
  )
}

const detectAppearanceFromClassName = (className?: string) => {
  const tokens = toClassTokenSet(className)
  return VALIDATOR_APPEARANCES.find(candidate => tokens.has(candidate))
}

const resolveAppearance = (
  as?: ValidatorHost,
  appearance?: ValidatorAppearance,
  className?: string,
): ValidatorAppearance | undefined => {
  if (appearance) return appearance

  const inferred = detectAppearanceFromClassName(className)
  if (inferred) return inferred

  if (as === 'select') return 'select'
  if (as === 'textarea') return 'textarea'
  return undefined
}

const resolveHost = (as?: ValidatorHost, appearance?: ValidatorAppearance): ValidatorHost => {
  if (as) return as
  if (appearance === 'select') return 'select'
  if (appearance === 'textarea') return 'textarea'
  return 'input'
}

const buildValidatorClassName = (
  appearance?: ValidatorAppearance,
  size?: ValidatorSize,
  status?: ValidatorStatus,
  className?: string,
) => {
  const tokens = toClassTokenSet(className)

  return joinClassNames(
    'validator',
    appearance && !tokens.has(appearance) ? appearance : undefined,
    appearance && size && !tokens.has(`${appearance}-${size}`)
      ? `${appearance}-${size}`
      : undefined,
    appearance && status && !tokens.has(`${appearance}-${status}`)
      ? `${appearance}-${status}`
      : undefined,
    className,
  )
}

const renderStackedContent = (content: any) => {
  if (!Array.isArray(content)) return content

  return content.map((item, index) => (
    <span key={`validator-line-${index}`} className="block">
      {item}
    </span>
  ))
}

const Root: FC<ValidatorProps> = ({
  as,
  appearance,
  size,
  status,
  className,
  children,
  ...rest
}) => {
  const resolvedAppearance = resolveAppearance(as, appearance, className)
  const resolvedHost = resolveHost(as, resolvedAppearance)
  const cls = buildValidatorClassName(resolvedAppearance, size, status, className)

  if (resolvedHost === 'select') {
    return (
      <select {...rest} className={cls}>
        {children}
      </select>
    )
  }

  if (resolvedHost === 'textarea') {
    return (
      <textarea {...rest} className={cls}>
        {children}
      </textarea>
    )
  }

  return <input {...rest} className={cls} />
}

const Hint: FC<ValidatorHintProps> = ({
  as = 'p',
  className,
  children,
  hideUntilInvalid,
  lines,
  ...rest
}) => {
  const Component = as as any

  return (
    <Component
      {...rest}
      className={joinClassNames(
        'validator-hint',
        hideUntilInvalid ? 'hidden' : undefined,
        className,
      )}
    >
      {lines?.length ? renderStackedContent(lines) : children}
    </Component>
  )
}

const buildFieldClassName = (fieldAs: ValidatorFieldHost, className?: string) => {
  return joinClassNames(fieldAs === 'fieldset' ? 'fieldset gap-2' : 'grid gap-2', className)
}

const Field: FC<ValidatorFieldProps> = ({
  fieldAs = 'fieldset',
  className,
  controlClassName,
  label,
  labelClassName,
  hint,
  hintAs = 'p',
  hintClassName,
  hideHintWhenValid,
  extra,
  extraClassName,
  requiredMark,
  id,
  children,
  ...rest
}) => {
  const Wrapper = fieldAs as any
  const controlId = typeof id === 'string' && id.trim() ? id : undefined
  const generatedHintId =
    controlId && hint != null && rest['aria-describedby'] == null ? `${controlId}-hint` : undefined
  const describedBy = rest['aria-describedby'] ?? generatedHintId
  const showRequiredMark = requiredMark ?? rest.required === true

  return (
    <Wrapper className={buildFieldClassName(fieldAs, className)}>
      {label != null ? (
        <label className={joinClassNames('label', labelClassName)} for={controlId}>
          <span>{label}</span>
          {showRequiredMark ? (
            <span className="text-error" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <Root {...rest} id={controlId} aria-describedby={describedBy} className={controlClassName}>
        {children}
      </Root>

      {hint != null ? (
        <Hint
          id={generatedHintId}
          as={hintAs}
          className={hintClassName}
          hideUntilInvalid={hideHintWhenValid}
        >
          {renderStackedContent(hint)}
        </Hint>
      ) : null}

      {extra != null ? (
        <p className={joinClassNames('label text-xs opacity-70', extraClassName)}>
          {renderStackedContent(extra)}
        </p>
      ) : null}
    </Wrapper>
  )
}

type ValidatorCompound = FC<ValidatorProps> & {
  Hint: FC<ValidatorHintProps>
  Field: FC<ValidatorFieldProps>
}

const ValidatorCompound: ValidatorCompound = Object.assign(Root, {
  Hint,
  Field,
})

export default ValidatorCompound
