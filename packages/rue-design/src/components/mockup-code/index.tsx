/* RUE_VAPOR_TRANSFORMED */
import type { FC } from '@rue-js/rue'

export type MockupCodeTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export interface MockupCodeLineData {
  key?: string | number
  prefix?: any
  code?: any
  children?: any
  className?: string
  codeClassName?: string
  highlight?: boolean
  tone?: MockupCodeTone
}

export interface MockupCodeProps {
  as?: any
  className?: string
  children?: any
  items?: ReadonlyArray<MockupCodeLineData>
  prefix?: any
  lineNumbers?: boolean
  start?: number
  codeClassName?: string
  [key: string]: any
}

export interface MockupCodeLineProps extends Omit<MockupCodeLineData, 'key'> {
  as?: any
  lineNumber?: number | string
  [key: string]: any
}

const joinClassName = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ')

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const hasContent = (value: any): boolean => {
  if (Array.isArray(value)) {
    return value.some(item => hasContent(item))
  }
  return value !== undefined && value !== null && value !== false
}

const resolveToneClassName = (tone?: MockupCodeTone, highlight?: boolean) => {
  if (!tone && !highlight) return undefined

  if (highlight) {
    switch (tone) {
      case 'neutral':
        return 'bg-neutral text-neutral-content'
      case 'primary':
        return 'bg-primary text-primary-content'
      case 'secondary':
        return 'bg-secondary text-secondary-content'
      case 'accent':
        return 'bg-accent text-accent-content'
      case 'info':
        return 'bg-info text-info-content'
      case 'success':
        return 'bg-success text-success-content'
      case 'warning':
        return 'bg-warning text-warning-content'
      case 'error':
        return 'bg-error text-error-content'
      default:
        return 'bg-base-200'
    }
  }

  switch (tone) {
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

const Line: FC<MockupCodeLineProps> = ({
  as = 'pre',
  prefix,
  lineNumber,
  code: lineCode,
  children,
  className,
  codeClassName,
  highlight,
  tone,
  ...rest
}) => {
  const Component = as as any
  const resolvedPrefix = hasContent(prefix) ? prefix : lineNumber

  return (
    <Component
      {...rest}
      data-prefix={resolvedPrefix == null ? undefined : String(resolvedPrefix)}
      className={joinClassName(resolveToneClassName(tone, highlight), className)}
    >
      {hasContent(children) ? (
        children
      ) : hasContent(lineCode) ? (
        <code className={codeClassName}>{lineCode}</code>
      ) : null}
    </Component>
  )
}

const Root: FC<MockupCodeProps> = ({
  as = 'div',
  className,
  children,
  items,
  prefix,
  lineNumbers,
  start = 1,
  codeClassName,
  ...rest
}) => {
  const Component = as as any
  const renderedItems = items?.map((item, index) => {
    const itemPrefix = hasContent(item.prefix) ? item.prefix : prefix
    const lineNumber = lineNumbers ? start + index : undefined

    return (
      <Line
        key={item.key ?? index}
        {...item}
        prefix={itemPrefix}
        lineNumber={lineNumber}
        codeClassName={item.codeClassName ?? codeClassName}
      />
    )
  })

  return (
    <Component {...rest} className={mergeClassName('mockup-code', className)}>
      {renderedItems}
      {children}
    </Component>
  )
}

type MockupCodeCompound = FC<MockupCodeProps> & {
  Line: FC<MockupCodeLineProps>
}

const MockupCode: MockupCodeCompound = Object.assign(Root, {
  Line,
})

export default MockupCode
