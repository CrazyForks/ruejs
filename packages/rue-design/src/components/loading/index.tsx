/* RUE_VAPOR_TRANSFORMED */
/*
Loading 组件概述
- 保留 daisyUI loading 的 spinner / dots / ring 等 Rue 视觉语言。
- 补齐 Spin 常用能力：spinning、嵌套包裹、description、delay、indicator、fullscreen、percent。
- 继续兼容旧版 style="spinner" 写法；当 style 传入对象时作为根元素内联样式使用。
*/
import { h, onMounted, onUnmounted, ref, useRef, watch, type FC } from '@rue-js/rue'

/** LoadingStyle 样式值类型。 */
export type LoadingStyle = 'spinner' | 'dots' | 'ring' | 'ball' | 'bars' | 'infinity'
/** LoadingSize 尺寸类型。 */
export type LoadingSize =
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
/** LoadingPercent 类型。 */
export type LoadingPercent = number | 'auto'

/** LoadingIndicatorRenderProps 组件属性。 */
export interface LoadingIndicatorRenderProps {
  /** percent 配置项。 */
  percent?: number
  /** 组件尺寸。 */
  size: Exclude<LoadingSize, 'small' | 'default' | 'medium' | 'middle' | 'large'>
  /** 根节点内联样式。 */
  style: LoadingStyle
  /** spinning 配置项。 */
  spinning: boolean
}

/** LoadingClassNames 局部类名配置。 */
export interface LoadingClassNames {
  /** 根节点区域配置。 */
  root?: string
  /** section 配置项。 */
  section?: string
  /** indicator 配置项。 */
  indicator?: string
  /** 描述内容。 */
  description?: string
  /** 内容容器区域配置。 */
  container?: string
}

/** LoadingStyles 局部样式配置。 */
export interface LoadingStyles {
  /** 根节点区域配置。 */
  root?: Record<string, any>
  /** section 配置项。 */
  section?: Record<string, any>
  /** indicator 配置项。 */
  indicator?: Record<string, any>
  /** 描述内容。 */
  description?: Record<string, any>
  /** 内容容器区域配置。 */
  container?: Record<string, any>
}

type InlineStyle = string | Record<string, any>

/** LoadingProps 组件属性。 */
export interface LoadingProps {
  /** 自定义渲染的宿主元素。 */
  as?: string
  /** 根节点内联样式。 */
  style?: LoadingStyle | InlineStyle
  /** indicatorStyle 内联样式。 */
  indicatorStyle?: LoadingStyle
  /** 组件视觉变体。 */
  variant?: LoadingStyle
  /** 组件类型或语义类型。 */
  type?: LoadingStyle
  /** 组件尺寸。 */
  size?: LoadingSize
  /** spinning 配置项。 */
  spinning?: boolean
  /** delay 配置项。 */
  delay?: number
  /** indicator 配置项。 */
  indicator?: any | ((props: LoadingIndicatorRenderProps) => any)
  /** 描述内容。 */
  description?: any
  /** tip 配置项。 */
  tip?: any
  /** fullscreen 配置项。 */
  fullscreen?: boolean
  /** percent 配置项。 */
  percent?: LoadingPercent
  /** 根节点附加类名。 */
  rootClassName?: string
  /** wrapperClassName 附加类名。 */
  wrapperClassName?: string
  /** 按局部区域覆盖的类名集合。 */
  classNames?: LoadingClassNames
  /** 按局部区域覆盖的内联样式集合。 */
  styles?: LoadingStyles
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

type LoadingComponent = FC<LoadingProps> & {
  setDefaultIndicator: (indicator: any) => void
}

/** LOADING_STYLES 内部常量。 */
const LOADING_STYLES: LoadingStyle[] = ['spinner', 'dots', 'ring', 'ball', 'bars', 'infinity']
/** DEFAULT_PERCENT_LABEL 内部常量。 */
const DEFAULT_PERCENT_LABEL = 'Loading'

let defaultIndicator: any

/** merge Class Names 的内部工具函数。 */
const mergeClassNames = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

/** merge Styles 的内部工具函数。 */
const mergeStyles = (...parts: Array<Record<string, any> | undefined>) => {
  const merged: Record<string, any> = {}
  parts.forEach(part => {
    if (part) Object.assign(merged, part)
  })
  return Object.keys(merged).length > 0 ? merged : undefined
}

/** 判断 Loading Style 的内部工具函数。 */
const isLoadingStyle = (value: any): value is LoadingStyle => {
  return typeof value === 'string' && LOADING_STYLES.includes(value as LoadingStyle)
}

/** 解析 Indicator Style 的内部工具函数。 */
const resolveIndicatorStyle = (
  style?: LoadingStyle | InlineStyle,
  indicatorStyle?: LoadingStyle,
  variant?: LoadingStyle,
  type?: LoadingStyle,
) => {
  if (indicatorStyle) return indicatorStyle
  if (variant) return variant
  if (type) return type
  if (isLoadingStyle(style)) return style
  return 'spinner'
}

/** 解析 Root Style 的内部工具函数。 */
const resolveRootStyle = (style?: LoadingStyle | InlineStyle) => {
  if (isLoadingStyle(style)) return undefined
  return style as InlineStyle | undefined
}

/** 归一化 Size 的内部工具函数。 */
const normalizeSize = (
  size?: LoadingSize,
): Exclude<LoadingSize, 'small' | 'default' | 'medium' | 'middle' | 'large'> => {
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
      return size ?? 'md'
  }
}

/** clamp Percent 的内部工具函数。 */
const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** should Delay 的内部工具函数。 */
const shouldDelay = (spinning: boolean, delay?: number) => {
  return spinning && typeof delay === 'number' && delay > 0 && Number.isFinite(delay)
}

/** 转换为 Child Array 的内部工具函数。 */
const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null || typeof children === 'boolean' ? [] : [children]
}

/** 渲染 Element 的内部工具函数。 */
const renderElement = (as: string, props: Record<string, any>, children?: any) => {
  const nextChildren = toChildArray(children)
  switch (as) {
    case 'span':
      return <span {...props}>{nextChildren}</span>
    case 'section':
      return <section {...props}>{nextChildren}</section>
    case 'article':
      return <article {...props}>{nextChildren}</article>
    case 'main':
      return <main {...props}>{nextChildren}</main>
    case 'div':
      return <div {...props}>{nextChildren}</div>
    default:
      return h(as as any, props, ...nextChildren)
  }
}

/** 构建 Indicator Class Name 的内部工具函数。 */
const buildIndicatorClassName = (
  style: LoadingStyle,
  size: ReturnType<typeof normalizeSize>,
  className?: string,
) => {
  return mergeClassNames('loading', `loading-${style}`, `loading-${size}`, className)
}

/** 渲染 Default Indicator 的内部工具函数。 */
const renderDefaultIndicator = (
  indicatorClassName: string,
  indicatorStyle?: Record<string, any>,
  label?: any,
) => {
  return (
    <span
      className={indicatorClassName}
      style={indicatorStyle}
      aria-hidden={label != null ? 'true' : undefined}
    />
  )
}

/** Loading Root 的内部工具函数。 */
const LoadingRoot: FC<LoadingProps> = ({
  as,
  style,
  indicatorStyle,
  variant,
  type,
  size,
  spinning = true,
  delay = 0,
  indicator,
  description,
  tip,
  fullscreen = false,
  percent,
  rootClassName,
  wrapperClassName,
  classNames,
  styles,
  className,
  children,
  ...rest
}) => {
  const resolvedStyle = resolveIndicatorStyle(style, indicatorStyle, variant, type)
  const normalizedSize = normalizeSize(size)
  const rootStyle = resolveRootStyle(style)
  const descriptionNode = description ?? tip
  const childNodes = toChildArray(children)
  const hasChildren = childNodes.length > 0
  const hasDescription = descriptionNode != null
  const hasPercent = percent !== undefined
  const hasCustomIndicator = indicator != null || defaultIndicator != null
  const isEnhancedStandalone = hasDescription || hasPercent || hasCustomIndicator
  const isNested = hasChildren || fullscreen
  const visible = ref(spinning)
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayTargetRef = useRef<HTMLElement>()

  const clearDelayTimer = () => {
    if (delayTimerRef.current != null) {
      clearTimeout(delayTimerRef.current)
      delayTimerRef.current = null
    }
  }

  const syncVisible = () => {
    clearDelayTimer()

    if (!spinning) {
      visible.value = false
      return
    }

    visible.value = true

    if (shouldDelay(spinning, delay)) {
      delayTimerRef.current = setTimeout(() => {
        if (delayTargetRef.current) {
          delayTargetRef.current.classList.remove('opacity-0')
        }
      }, delay)
      return
    }

    if (delayTargetRef.current) {
      delayTargetRef.current.classList.remove('opacity-0')
    }
  }

  onMounted(() => {
    syncVisible()
  })

  onUnmounted(() => {
    clearDelayTimer()
  })

  watch(() => spinning, syncVisible, { immediate: true })
  watch(() => delay, syncVisible)

  const mergedPercent =
    percent === undefined ? undefined : percent === 'auto' ? undefined : clampPercent(percent)
  const progressValue = typeof mergedPercent === 'number' ? Math.round(mergedPercent) : undefined
  const delayHiddenClass = shouldDelay(spinning, delay)
    ? 'opacity-0 transition-opacity duration-200'
    : undefined

  const indicatorClassName = buildIndicatorClassName(
    resolvedStyle,
    normalizedSize,
    mergeClassNames(classNames?.indicator, styles?.indicator ? 'inline-flex' : undefined),
  )
  const indicatorNode = hasCustomIndicator
    ? typeof (indicator ?? defaultIndicator) === 'function'
      ? (indicator ?? defaultIndicator)({
          percent: mergedPercent,
          size: normalizedSize,
          style: resolvedStyle,
          spinning: visible.value,
        })
      : (indicator ?? defaultIndicator)
    : renderDefaultIndicator(indicatorClassName, styles?.indicator, hasDescription || hasPercent)

  const progressNode = hasPercent ? (
    <div
      className="flex w-full min-w-24 flex-col items-center gap-1.5"
      data-rue-loading-percent="true"
    >
      <progress className="progress progress-primary h-1 w-24" max="100" value={progressValue} />
      <span className="text-[0.68rem] leading-none tabular-nums opacity-70">
        {percent === 'auto' ? DEFAULT_PERCENT_LABEL : `${progressValue ?? 0}%`}
      </span>
    </div>
  ) : null

  const sectionClassName = mergeClassNames(
    fullscreen
      ? 'pointer-events-auto flex min-w-36 flex-col items-center justify-center gap-3 rounded-box border border-base-300 bg-base-100/95 p-6 text-center text-base-content shadow-2xl'
      : isNested
        ? 'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-box bg-base-100/70 text-center text-base-content backdrop-blur-[1px]'
        : 'inline-flex flex-col items-center justify-center gap-2 text-center align-middle',
    delayHiddenClass,
    classNames?.section,
  )
  const descriptionClassName = mergeClassNames(
    'text-sm leading-5 opacity-80',
    classNames?.description,
  )
  const containerClassName = mergeClassNames(
    'transition duration-200',
    visible.value && 'opacity-40 saturate-75',
    classNames?.container,
  )
  const rootClass = mergeClassNames(
    fullscreen
      ? 'fixed inset-0 z-50 grid place-items-center bg-base-100/55 p-6 text-base-content backdrop-blur-sm'
      : isNested
        ? 'relative block text-base-content'
        : 'inline-flex items-center text-base-content',
    visible.value && 'rue-loading-spinning',
    rootClassName,
    wrapperClassName,
    classNames?.root,
    className,
  )
  const mergedRootStyle = mergeStyles(
    typeof rootStyle === 'string' ? undefined : rootStyle,
    styles?.root,
  )
  const rootStyleValue = typeof rootStyle === 'string' ? rootStyle : mergedRootStyle

  const sectionNode = visible.value
    ? renderElement(
        !fullscreen && !isNested ? 'span' : 'div',
        {
          ref: delayTargetRef,
          className: sectionClassName,
          style: styles?.section,
          'data-rue-loading-section': 'true',
        },
        <>
          {hasCustomIndicator ? (
            <span
              className={mergeClassNames(
                'inline-flex items-center justify-center',
                classNames?.indicator,
              )}
              style={styles?.indicator}
            >
              {indicatorNode}
            </span>
          ) : (
            indicatorNode
          )}
          {hasDescription ? (
            <div className={descriptionClassName} style={styles?.description}>
              {descriptionNode}
            </div>
          ) : null}
          {progressNode}
        </>,
      )
    : null

  if (fullscreen) {
    if (!visible.value) return null
    return (
      <div
        {...rest}
        className={rootClass}
        style={rootStyleValue}
        role={rest.role ?? 'status'}
        aria-live={rest['aria-live'] ?? 'polite'}
        aria-busy="true"
      >
        {sectionNode}
      </div>
    )
  }

  if (hasChildren) {
    const rootTag = as ?? 'div'
    return renderElement(
      rootTag,
      {
        ...rest,
        className: rootClass,
        style: rootStyleValue,
        role: rest.role ?? 'status',
        'aria-live': rest['aria-live'] ?? 'polite',
        'aria-busy': visible.value ? 'true' : 'false',
      },
      <>
        {sectionNode}
        <div
          className={containerClassName}
          style={styles?.container}
          data-rue-loading-container="true"
        >
          {childNodes}
        </div>
      </>,
    )
  }

  if (!visible.value) return null

  if (!isEnhancedStandalone) {
    const rootTag = as ?? 'span'
    const standaloneStyle =
      typeof rootStyleValue === 'string'
        ? rootStyleValue
        : mergeStyles(rootStyleValue, styles?.indicator)
    return renderElement(rootTag, {
      ...rest,
      ref: delayTargetRef,
      className: mergeClassNames(
        indicatorClassName,
        delayHiddenClass,
        rootClassName,
        classNames?.root,
        className,
      ),
      style: standaloneStyle,
      role: rest.role ?? 'status',
      'aria-live': rest['aria-live'] ?? 'polite',
      'aria-busy': 'true',
    })
  }

  const rootTag = as ?? 'span'
  return renderElement(
    rootTag,
    {
      ...rest,
      className: rootClass,
      style: rootStyleValue,
      role: rest.role ?? 'status',
      'aria-live': rest['aria-live'] ?? 'polite',
      'aria-busy': 'true',
    },
    sectionNode,
  )
}

const Loading = LoadingRoot as LoadingComponent

Loading.setDefaultIndicator = (indicator: any) => {
  defaultIndicator = indicator
}

/** 默认导出加载组件。 */
export default Loading
