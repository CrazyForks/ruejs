/* RUE_VAPOR_TRANSFORMED */
import { h, type FC } from '@rue-js/rue'

export type SpaceDirection = 'horizontal' | 'vertical'
export type SpaceAlign = 'start' | 'end' | 'center' | 'baseline' | 'stretch'
export type SpaceSize = 'small' | 'middle' | 'large' | number | string

export interface SpaceProps {
  as?: any
  size?: SpaceSize | [SpaceSize, SpaceSize]
  direction?: SpaceDirection
  orientation?: SpaceDirection
  vertical?: boolean
  align?: SpaceAlign
  split?: any
  separator?: any
  wrap?: boolean
  block?: boolean
  className?: string
  style?: Record<string, any>
  itemClassName?: string
  itemStyle?: Record<string, any>
  children?: any
  [key: string]: any
}

export interface SpaceCompactProps {
  as?: any
  size?: SpaceSize
  direction?: SpaceDirection
  orientation?: SpaceDirection
  vertical?: boolean
  block?: boolean
  className?: string
  style?: Record<string, any>
  children?: any
  [key: string]: any
}

const SPACE_SIZE_TOKENS: Record<'small' | 'middle' | 'large', string> = {
  small: 'var(--rue-theme-space-sm, 8px)',
  middle: 'var(--rue-theme-space-md, 16px)',
  large: 'var(--rue-theme-space-lg, 24px)',
}

const mergeClassNames = (...classNames: Array<string | undefined | false>) => {
  return classNames.filter(Boolean).join(' ')
}

const mergeStyle = (...styles: Array<Record<string, any> | undefined>) => {
  const nextStyle: Record<string, any> = {}

  styles.forEach(style => {
    if (!style || typeof style !== 'object' || Array.isArray(style)) {
      return
    }
    Object.assign(nextStyle, style)
  })

  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined
}

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null || typeof children === 'boolean' ? [] : [children]
}

const _isRenderableNode = (node: any) => {
  return !!node && typeof node === 'object'
}

const normalizeSpaceValue = (value?: SpaceSize) => {
  if (value == null) {
    return undefined
  }
  if (typeof value === 'number') {
    return `${value}px`
  }
  if (value === 'small' || value === 'middle' || value === 'large') {
    return SPACE_SIZE_TOKENS[value]
  }
  return value
}

const resolveGap = (size?: SpaceSize | [SpaceSize, SpaceSize]) => {
  if (Array.isArray(size)) {
    return {
      columnGap: normalizeSpaceValue(size[0]),
      rowGap: normalizeSpaceValue(size[1]),
    }
  }

  const value = normalizeSpaceValue(size ?? 'small')
  return {
    columnGap: value,
    rowGap: value,
  }
}

const resolveDirection = (
  orientation?: SpaceDirection,
  direction?: SpaceDirection,
  vertical?: boolean,
): SpaceDirection => {
  if (vertical) {
    return 'vertical'
  }
  return orientation ?? direction ?? 'horizontal'
}

const _resolveCompactSizeClassName = (className: string | undefined, size?: SpaceSize) => {
  if (!className || size == null || typeof size === 'number') {
    return undefined
  }

  const normalizedSize =
    size === 'middle' ? 'md' : size === 'small' ? 'sm' : size === 'large' ? 'lg' : undefined
  if (!normalizedSize) {
    return undefined
  }

  const nextClassNames: string[] = []
  if (/\bbtn\b/.test(className)) nextClassNames.push(`btn-${normalizedSize}`)
  if (/\binput\b/.test(className)) nextClassNames.push(`input-${normalizedSize}`)
  if (/\bselect\b/.test(className)) nextClassNames.push(`select-${normalizedSize}`)
  if (/\btextarea\b/.test(className)) nextClassNames.push(`textarea-${normalizedSize}`)

  return nextClassNames.length > 0 ? nextClassNames.join(' ') : undefined
}

const resolveCompactItemClassName = (direction: SpaceDirection, index: number, total: number) => {
  const isFirst = index === 0
  const isLast = index === total - 1

  if (direction === 'vertical') {
    return mergeClassNames(
      'rue-space-compact-item relative overflow-hidden',
      !isFirst && '-mt-px rounded-t-none',
      !isLast && 'rounded-b-none',
    )
  }

  return mergeClassNames(
    'rue-space-compact-item relative overflow-hidden',
    !isFirst && '-ml-px rounded-l-none',
    !isLast && 'rounded-r-none',
  )
}

const resolveSeparatorContent = (separator: any) => {
  return typeof separator === 'function' ? separator() : separator
}

const resolveCompactShellStyle = (size?: SpaceSize) => {
  if (size == null) {
    return undefined
  }

  if (typeof size === 'number') {
    return { minHeight: `${size}px` }
  }

  if (size === 'small') {
    return { fontSize: '0.875rem' }
  }

  if (size === 'large') {
    return { fontSize: '1rem' }
  }

  if (/^\d/.test(size)) {
    return { minHeight: size }
  }

  return undefined
}

const renderSpaceSeparator = (separator: any, direction: SpaceDirection) => {
  return (
    <span
      aria-hidden="true"
      className={mergeClassNames(
        'rue-space-separator shrink-0 select-none text-base-content/45',
        direction === 'vertical' && 'leading-none',
      )}
    >
      {separator}
    </span>
  )
}

const SpaceRoot: FC<SpaceProps> = ({
  as = 'div',
  size,
  direction,
  orientation,
  vertical,
  align,
  split,
  separator,
  wrap = false,
  block = false,
  className,
  style,
  itemClassName,
  itemStyle,
  children,
  ...rest
}) => {
  const Component = as as any
  const childNodes = toChildArray(children)

  const resolvedDirection = resolveDirection(orientation, direction, vertical)
  const resolvedAlign = align ?? (resolvedDirection === 'horizontal' ? 'center' : undefined)
  const gap = resolveGap(size)
  const mergedSeparator = separator ?? split
  const separatorGap = resolvedDirection === 'vertical' ? gap.rowGap : gap.columnGap

  return h(
    Component,
    {
      ...rest,
      className: mergeClassNames('rue-space min-w-0 max-w-full', className),
      style: mergeStyle(
        {
          display: block ? 'flex' : 'inline-flex',
          flexDirection: resolvedDirection === 'vertical' ? 'column' : 'row',
          flexWrap: wrap ? 'wrap' : 'nowrap',
          alignItems: resolvedAlign,
          width: block ? '100%' : undefined,
          maxWidth: '100%',
          columnGap: gap.columnGap,
          rowGap: gap.rowGap,
        },
        style,
      ),
      'data-rue-space': '',
      'data-rue-space-direction': resolvedDirection,
      'aria-orientation': resolvedDirection,
    },
    ...childNodes.map((child, index) => {
      const key = child?.key ?? child?.props?.key ?? index
      const showSeparator = mergedSeparator != null && index < childNodes.length - 1

      return (
        <div
          key={key}
          className={mergeClassNames('rue-space-item min-w-0 max-w-full', itemClassName)}
          style={mergeStyle(
            {
              display: 'flex',
              flexDirection: resolvedDirection === 'vertical' ? 'column' : 'row',
              alignItems: resolvedAlign,
              minWidth: 0,
              maxWidth: '100%',
              ...(showSeparator
                ? resolvedDirection === 'vertical'
                  ? { rowGap: separatorGap }
                  : { columnGap: separatorGap }
                : {}),
            },
            itemStyle,
          )}
        >
          {child}
          {showSeparator
            ? renderSpaceSeparator(resolveSeparatorContent(mergedSeparator), resolvedDirection)
            : null}
        </div>
      )
    }),
  )
}

const SpaceCompact: FC<SpaceCompactProps> = ({
  as = 'div',
  size,
  direction,
  orientation,
  vertical,
  block = false,
  className,
  style,
  children,
  ...rest
}) => {
  const Component = as as any
  const childNodes = toChildArray(children)

  if (childNodes.length === 0) {
    return null
  }

  const resolvedDirection = resolveDirection(orientation, direction, vertical)
  const blockItemStyle = block
    ? resolvedDirection === 'vertical'
      ? { width: '100%' }
      : { flex: '1 1 0%' }
    : undefined
  const compactShellStyle = resolveCompactShellStyle(size)

  return h(
    Component,
    {
      ...rest,
      className: mergeClassNames('rue-space-compact max-w-full', className),
      style: mergeStyle(
        {
          display: 'flex',
          flexDirection: resolvedDirection === 'vertical' ? 'column' : 'row',
          width: block ? '100%' : undefined,
          maxWidth: '100%',
        },
        style,
      ),
      'data-rue-space-compact': '',
      'data-rue-space-direction': resolvedDirection,
      'aria-orientation': resolvedDirection,
    },
    ...childNodes.map((child, index) => {
      return (
        <div
          key={index}
          data-rue-space-compact-item=""
          className={mergeClassNames(
            resolveCompactItemClassName(resolvedDirection, index, childNodes.length),
            block && (resolvedDirection === 'vertical' ? 'w-full' : 'flex-1'),
          )}
          style={mergeStyle(
            {
              display: 'flex',
              minWidth: 0,
              maxWidth: '100%',
            },
            blockItemStyle,
            compactShellStyle,
          )}
        >
          {child}
        </div>
      )
    }),
  )
}

type SpaceCompound = FC<SpaceProps> & {
  Compact: FC<SpaceCompactProps>
}

const Space: SpaceCompound = Object.assign(SpaceRoot, {
  Compact: SpaceCompact,
})

export default Space
