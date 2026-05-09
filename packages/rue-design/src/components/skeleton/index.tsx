/* RUE_VAPOR_TRANSFORMED */
import {
  h,
  onMounted,
  onUnmounted,
  renderBetween,
  signal,
  useSetup,
  vapor,
  watchEffect,
  type FC,
} from '@rue-js/rue'

export type SkeletonSize =
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
  | number
export type SkeletonAvatarShape = 'circle' | 'square'
export type SkeletonButtonShape = 'default' | 'square' | 'round' | 'circle'
export type SkeletonWidth = string | number

export interface SkeletonClassNames {
  root?: string
  header?: string
  section?: string
  avatar?: string
  title?: string
  paragraph?: string
}

export interface SkeletonStyles {
  root?: Record<string, any>
  header?: Record<string, any>
  section?: Record<string, any>
  avatar?: Record<string, any>
  title?: Record<string, any>
  paragraph?: Record<string, any>
}

interface SkeletonBaseProps {
  active?: boolean
  className?: string
  style?: Record<string, any>
  children?: any
  [key: string]: any
}

type SkeletonReactiveValue<T> = T | (() => T) | { value?: T; get?: () => T }

export interface SkeletonAvatarProps extends SkeletonBaseProps {
  size?: SkeletonSize
  shape?: SkeletonAvatarShape
}

export interface SkeletonButtonProps extends SkeletonBaseProps {
  size?: SkeletonSize
  shape?: SkeletonButtonShape
  block?: boolean
}

export interface SkeletonInputProps extends SkeletonBaseProps {
  size?: SkeletonSize
  block?: boolean
}

export interface SkeletonNodeProps extends Omit<SkeletonBaseProps, 'active'> {
  active?: SkeletonReactiveValue<boolean>
  as?: any
}

export interface SkeletonImageProps extends SkeletonNodeProps {
  aspect?: SkeletonReactiveValue<'square' | 'video'>
}

export interface SkeletonTitleProps extends SkeletonBaseProps {
  width?: SkeletonWidth
}

export interface SkeletonParagraphProps extends SkeletonBaseProps {
  rows?: number
  width?: SkeletonWidth | SkeletonWidth[]
  rowClassName?: string
}

export interface SkeletonProps extends SkeletonBaseProps {
  as?: any
  text?: boolean
  loading?: boolean
  avatar?: boolean | SkeletonAvatarProps
  title?: boolean | SkeletonTitleProps
  paragraph?: boolean | SkeletonParagraphProps
  round?: boolean
  rootClassName?: string
  classNames?: SkeletonClassNames
  styles?: SkeletonStyles
}

interface NormalizedToggleProps<T> {
  enabled: boolean
  props: Partial<T>
}

const mergeClassName = (...values: Array<string | false | null | undefined>) => {
  return values.filter(Boolean).join(' ')
}

const mergeStyle = (...values: Array<Record<string, any> | undefined>) => {
  const merged: Record<string, any> = {}
  values.forEach(value => {
    if (value) {
      Object.assign(merged, value)
    }
  })
  return Object.keys(merged).length > 0 ? merged : undefined
}

const resolveDimension = (value?: SkeletonWidth) => {
  if (value == null) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

const normalizeSize = (size?: SkeletonSize): Exclude<SkeletonSize, number> | number => {
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

const normalizeToggleProps = <T extends Record<string, any>>(
  value: boolean | T | undefined,
  defaultEnabled: boolean,
) => {
  if (value === false) {
    return { enabled: false, props: {} } as NormalizedToggleProps<T>
  }
  if (value && typeof value === 'object') {
    return { enabled: true, props: value } as NormalizedToggleProps<T>
  }
  return { enabled: value === true || defaultEnabled, props: {} } as NormalizedToggleProps<T>
}

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null || typeof children === 'boolean' ? [] : [children]
}

const cloneRenderableChildren = (children: unknown): unknown =>
  Array.isArray(children) ? children.map(child => cloneRenderableChildren(child)) : children

const snapshotSkeletonNodeProps = <T extends SkeletonNodeProps>(props: T): T =>
  ({
    ...(props as Record<string, unknown>),
    children: cloneRenderableChildren(props.children),
  }) as unknown as T

const resolveReactiveValue = <T,>(value: SkeletonReactiveValue<T> | undefined): T | undefined => {
  if (value == null) {
    return undefined
  }
  if (typeof value === 'function') {
    return (value as () => T)()
  }
  if (typeof value === 'object') {
    const reactiveValue = value as { value?: T; get?: () => T }
    if (typeof reactiveValue.get === 'function') {
      return reactiveValue.get()
    }
    if ('value' in reactiveValue) {
      return reactiveValue.value
    }
  }
  return value as T
}

const renderElement = (as: any, props: Record<string, any>, children?: any) => {
  const nextChildren = toChildArray(children)
  return h(as as any, props, ...nextChildren)
}

const buildPrimitiveClassName = (className?: string, text?: boolean, active?: boolean) => {
  return mergeClassName('skeleton', text && 'skeleton-text', active && 'animate-pulse', className)
}

const buildAvatarSize = (size?: SkeletonSize) => {
  const normalized = normalizeSize(size)
  if (typeof normalized === 'number') {
    return {
      className: undefined,
      style: {
        width: `${normalized}px`,
        height: `${normalized}px`,
      },
    }
  }

  switch (normalized) {
    case 'xs':
      return { className: 'h-8 w-8', style: undefined }
    case 'sm':
      return { className: 'h-10 w-10', style: undefined }
    case 'lg':
      return { className: 'h-16 w-16', style: undefined }
    case 'xl':
      return { className: 'h-20 w-20', style: undefined }
    default:
      return { className: 'h-12 w-12', style: undefined }
  }
}

const buildControlHeight = (size?: SkeletonSize) => {
  const normalized = normalizeSize(size)
  if (typeof normalized === 'number') {
    return {
      className: undefined,
      style: {
        height: `${normalized}px`,
      },
    }
  }

  switch (normalized) {
    case 'xs':
      return { className: 'h-7', style: undefined }
    case 'sm':
      return { className: 'h-8', style: undefined }
    case 'lg':
      return { className: 'h-12', style: undefined }
    case 'xl':
      return { className: 'h-14', style: undefined }
    default:
      return { className: 'h-10', style: undefined }
  }
}

const renderSkeletonNodeView = ({
  as = 'div',
  active,
  className,
  style,
  children,
  ...rest
}: SkeletonNodeProps) => {
  const Component = as as any
  const resolvedActive = resolveReactiveValue(active)

  return renderElement(
    Component,
    {
      ...rest,
      className: buildPrimitiveClassName(
        mergeClassName(
          'flex min-h-24 w-full items-center justify-center rounded-2xl text-base-content/40',
          className,
        ),
        false,
        resolvedActive,
      ),
      style,
    },
    children,
  )
}

const buildSkeletonNodeClassName = (className?: string, active?: boolean) =>
  buildPrimitiveClassName(
    mergeClassName(
      'flex min-h-24 w-full items-center justify-center rounded-2xl text-base-content/40',
      className,
    ),
    false,
    active,
  )

const buildSkeletonImageClassName = (
  className?: string,
  aspect: 'square' | 'video' = 'video',
  active?: boolean,
) =>
  buildSkeletonNodeClassName(
    mergeClassName(aspect === 'square' ? 'aspect-square w-32' : 'aspect-video w-48', className),
    active,
  )

const getAvatarBasicProps = (
  hasTitle: boolean,
  hasParagraph: boolean,
): Partial<SkeletonAvatarProps> => {
  if (hasTitle && !hasParagraph) {
    return { size: 'lg', shape: 'square' }
  }
  return { size: 'lg', shape: 'circle' }
}

const getTitleBasicProps = (
  hasAvatar: boolean,
  hasParagraph: boolean,
): Partial<SkeletonTitleProps> => {
  if (!hasAvatar && hasParagraph) {
    return { width: '38%' }
  }
  if (hasAvatar && hasParagraph) {
    return { width: '50%' }
  }
  return {}
}

const getParagraphBasicProps = (
  hasAvatar: boolean,
  hasTitle: boolean,
): Partial<SkeletonParagraphProps> => {
  return {
    rows: !hasAvatar && hasTitle ? 3 : 2,
    width: !hasAvatar || !hasTitle ? '61%' : undefined,
  }
}

const PrimitiveSkeleton: FC<SkeletonProps> = ({
  as = 'div',
  text,
  active,
  className,
  rootClassName,
  classNames,
  style,
  styles,
  children,
  ...rest
}) => {
  const Component = as as any
  return renderElement(
    Component,
    {
      ...rest,
      className: buildPrimitiveClassName(
        mergeClassName(classNames?.root, className, rootClassName),
        text,
        active,
      ),
      style: mergeStyle(styles?.root, style),
    },
    children,
  )
}

const SkeletonAvatar: FC<SkeletonAvatarProps> = ({
  active,
  className,
  style,
  size,
  shape = 'circle',
  ...rest
}) => {
  const sizeConfig = buildAvatarSize(size)
  return (
    <div
      {...rest}
      className={buildPrimitiveClassName(
        mergeClassName(
          sizeConfig.className,
          shape === 'square' ? 'rounded-2xl' : 'rounded-full',
          className,
        ),
        false,
        active,
      )}
      style={{ ...sizeConfig.style, ...style }}
    />
  )
}

const SkeletonButton: FC<SkeletonButtonProps> = ({
  active,
  className,
  style,
  size,
  shape = 'default',
  block,
  ...rest
}) => {
  const heightConfig = buildControlHeight(size)
  const squareShape = shape === 'square' || shape === 'circle'
  return (
    <div
      {...rest}
      className={buildPrimitiveClassName(
        mergeClassName(
          heightConfig.className,
          block ? 'w-full' : squareShape ? 'w-10' : 'w-24',
          shape === 'circle' ? 'rounded-full' : shape === 'round' ? 'rounded-full' : 'rounded-xl',
          className,
        ),
        false,
        active,
      )}
      style={{
        ...heightConfig.style,
        ...(squareShape && heightConfig.style?.height ? { width: heightConfig.style.height } : {}),
        ...style,
      }}
    />
  )
}

const SkeletonInput: FC<SkeletonInputProps> = ({
  active,
  className,
  style,
  size,
  block,
  ...rest
}) => {
  const heightConfig = buildControlHeight(size)
  return (
    <div
      {...rest}
      className={buildPrimitiveClassName(
        mergeClassName(heightConfig.className, block ? 'w-full' : 'w-56', 'rounded-xl', className),
        false,
        active,
      )}
      style={{ ...heightConfig.style, ...style }}
    />
  )
}

const SkeletonNode: FC<SkeletonNodeProps> = ({ ...props }) => {
  const ctx = useSetup(() => ({
    container: null as HTMLElement | null,
    startEl: null as Comment | null,
    endEl: null as Comment | null,
    propsSig: signal(snapshotSkeletonNodeProps(props), {}, true),
    started: false,
    effect: null as { dispose: () => void } | null,
  }))

  const ensureHost = () => {
    if (ctx.container || typeof document === 'undefined') {
      return
    }

    const container = document.createElement('span')
    container.style.display = 'contents'

    const startEl = document.createComment('rue-skeleton-node-start')
    const endEl = document.createComment('rue-skeleton-node-end')

    container.appendChild(startEl)
    container.appendChild(endEl)

    ctx.container = container
    ctx.startEl = startEl
    ctx.endEl = endEl
  }

  const resolveHostElement = () => {
    if (!ctx.startEl || !ctx.endEl) {
      return null
    }

    let node = ctx.startEl.nextSibling
    while (node && node !== ctx.endEl) {
      if (node.nodeType === 1) {
        return node as HTMLElement
      }
      node = node.nextSibling
    }

    return null
  }

  onMounted(() => {
    if (ctx.started) {
      return
    }

    ctx.started = true
    ensureHost()

    if (ctx.container && ctx.startEl && ctx.endEl) {
      renderBetween(
        renderSkeletonNodeView(ctx.propsSig.get()) as any,
        ctx.container as any,
        ctx.startEl as any,
        ctx.endEl as any,
      )
    }

    ctx.effect = watchEffect(() => {
      const curProps = ctx.propsSig.get()
      const host = resolveHostElement()
      const resolvedActive = resolveReactiveValue(curProps.active)

      if (!host) {
        return
      }

      host.className = buildSkeletonNodeClassName(curProps.className, resolvedActive)
    })
  })

  onUnmounted(() => {
    if (ctx.effect) {
      ctx.effect.dispose()
      ctx.effect = null
    }

    ctx.started = false

    if (ctx.container && ctx.startEl && ctx.endEl) {
      renderBetween([], ctx.container as any, ctx.startEl as any, ctx.endEl as any)
    }
  })

  return vapor(() => {
    ensureHost()

    if (!ctx.container) {
      return renderSkeletonNodeView(props) as any
    }

    ctx.propsSig.set(snapshotSkeletonNodeProps(props))
    return ctx.container as any
  })
}

const renderImagePlaceholderIcon = () =>
  h(
    'svg',
    { viewBox: '0 0 64 64', className: 'h-10 w-10 fill-current opacity-60', 'aria-hidden': 'true' },
    h('path', {
      d: 'M10 14a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4v36a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V14Zm4 0v28.28l9.64-9.63a3 3 0 0 1 4.24 0L36 40.77l6.64-6.63a3 3 0 0 1 4.24 0L50 37.25V14H14Zm36 36V42.9l-5.24-5.23L38.12 44.3a3 3 0 0 1-4.24 0l-8.12-8.11L14 47.97V50h36ZM22 28a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
    }),
  )

const renderSkeletonImageView = ({
  as = 'div',
  active,
  aspect = 'video',
  className,
  children,
  style,
  ...rest
}: SkeletonImageProps) => {
  const resolvedAspect = resolveReactiveValue(aspect) ?? 'video'
  const resolvedActive = resolveReactiveValue(active)
  const resolvedChildren =
    toChildArray(children).length > 0 ? children : renderImagePlaceholderIcon()

  return renderElement(
    as as any,
    {
      ...rest,
      className: buildSkeletonImageClassName(className, resolvedAspect, resolvedActive),
      style,
    },
    resolvedChildren,
  )
}

const SkeletonImage: FC<SkeletonImageProps> = ({ ...props }) => {
  const ctx = useSetup(() => ({
    container: null as HTMLElement | null,
    startEl: null as Comment | null,
    endEl: null as Comment | null,
    propsSig: signal(snapshotSkeletonNodeProps(props), {}, true),
    started: false,
    effect: null as { dispose: () => void } | null,
  }))

  const ensureHost = () => {
    if (ctx.container || typeof document === 'undefined') {
      return
    }

    const container = document.createElement('span')
    container.style.display = 'contents'

    const startEl = document.createComment('rue-skeleton-image-start')
    const endEl = document.createComment('rue-skeleton-image-end')

    container.appendChild(startEl)
    container.appendChild(endEl)

    ctx.container = container
    ctx.startEl = startEl
    ctx.endEl = endEl
  }

  const resolveHostElement = () => {
    if (!ctx.startEl || !ctx.endEl) {
      return null
    }

    let node = ctx.startEl.nextSibling
    while (node && node !== ctx.endEl) {
      if (node.nodeType === 1) {
        return node as HTMLElement
      }
      node = node.nextSibling
    }

    return null
  }

  onMounted(() => {
    if (ctx.started) {
      return
    }

    ctx.started = true
    ensureHost()

    if (ctx.container && ctx.startEl && ctx.endEl) {
      renderBetween(
        renderSkeletonImageView(ctx.propsSig.get() as SkeletonImageProps) as any,
        ctx.container as any,
        ctx.startEl as any,
        ctx.endEl as any,
      )
    }

    ctx.effect = watchEffect(() => {
      const curProps = ctx.propsSig.get() as SkeletonImageProps
      const host = resolveHostElement()
      const resolvedAspect = resolveReactiveValue(curProps.aspect) ?? 'video'
      const resolvedActive = resolveReactiveValue(curProps.active)

      if (!host) {
        return
      }

      host.className = buildSkeletonImageClassName(
        curProps.className,
        resolvedAspect,
        resolvedActive,
      )
    })
  })

  onUnmounted(() => {
    if (ctx.effect) {
      ctx.effect.dispose()
      ctx.effect = null
    }

    ctx.started = false

    if (ctx.container && ctx.startEl && ctx.endEl) {
      renderBetween([], ctx.container as any, ctx.startEl as any, ctx.endEl as any)
    }
  })

  return vapor(() => {
    ensureHost()

    if (!ctx.container) {
      return renderSkeletonImageView(props) as any
    }

    ctx.propsSig.set(snapshotSkeletonNodeProps(props))
    return ctx.container as any
  })
}

const renderTitle = (
  props: Partial<SkeletonTitleProps>,
  active?: boolean,
  round?: boolean,
  extraClassName?: string,
  extraStyle?: Record<string, any>,
) => {
  const { className, style, width, ...rest } = props
  return (
    <div
      {...rest}
      className={buildPrimitiveClassName(
        mergeClassName('h-4 max-w-full', round && 'rounded-full', extraClassName, className),
        false,
        active,
      )}
      style={mergeStyle({ width: resolveDimension(width) }, extraStyle, style)}
    />
  )
}

const resolveParagraphRowWidth = (
  width: SkeletonParagraphProps['width'],
  index: number,
  rows: number,
) => {
  if (Array.isArray(width)) {
    const value = width[index]
    if (value != null) return value
    if (index === rows - 1 && width.length > 0) return width[width.length - 1]
    return undefined
  }
  if (index === rows - 1) return width
  return undefined
}

const renderParagraph = (
  props: Partial<SkeletonParagraphProps>,
  active?: boolean,
  round?: boolean,
  extraClassName?: string,
  extraStyle?: Record<string, any>,
) => {
  const { className, style, rows = 2, width, rowClassName, ...rest } = props
  return (
    <div
      {...rest}
      className={mergeClassName('flex flex-col gap-3', extraClassName, className)}
      style={mergeStyle(extraStyle, style)}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={buildPrimitiveClassName(
            mergeClassName('h-4 max-w-full', round && 'rounded-full', rowClassName),
            false,
            active,
          )}
          style={{ width: resolveDimension(resolveParagraphRowWidth(width, index, rows)) }}
        />
      ))}
    </div>
  )
}

const SkeletonRoot: FC<SkeletonProps> = props => {
  const {
    loading,
    active,
    avatar,
    title,
    paragraph,
    round,
    className,
    rootClassName,
    classNames,
    style,
    styles,
    children,
    ...rest
  } = props
  const hasLoadingProp = Object.prototype.hasOwnProperty.call(props, 'loading')
  const shouldRenderComposite =
    hasLoadingProp ||
    avatar !== undefined ||
    title !== undefined ||
    paragraph !== undefined ||
    !!round

  if (!shouldRenderComposite) {
    return <PrimitiveSkeleton {...props} />
  }

  if (loading === false) {
    return children ?? null
  }

  const avatarConfig = normalizeToggleProps<SkeletonAvatarProps>(avatar, false)
  const titleConfig = normalizeToggleProps<SkeletonTitleProps>(title, true)
  const paragraphConfig = normalizeToggleProps<SkeletonParagraphProps>(paragraph, true)
  const hasAvatar = avatarConfig.enabled
  const hasTitle = titleConfig.enabled
  const hasParagraph = paragraphConfig.enabled
  const mergedAvatarProps = hasAvatar
    ? { ...getAvatarBasicProps(hasTitle, hasParagraph), ...avatarConfig.props }
    : null
  const mergedTitleProps = hasTitle
    ? { ...getTitleBasicProps(hasAvatar, hasParagraph), ...titleConfig.props }
    : null
  const mergedParagraphProps = hasParagraph
    ? { ...getParagraphBasicProps(hasAvatar, hasTitle), ...paragraphConfig.props }
    : null

  return (
    <div
      {...rest}
      className={mergeClassName(
        'flex w-full gap-4',
        !hasAvatar && 'flex-col',
        classNames?.root,
        className,
        rootClassName,
      )}
      style={mergeStyle(styles?.root, style)}
    >
      {hasAvatar ? (
        <div className={mergeClassName('shrink-0', classNames?.header)} style={styles?.header}>
          <SkeletonAvatar
            active={active}
            {...mergedAvatarProps}
            className={mergeClassName(classNames?.avatar, mergedAvatarProps?.className)}
            style={mergeStyle(styles?.avatar, mergedAvatarProps?.style)}
          />
        </div>
      ) : null}
      {hasTitle || hasParagraph ? (
        <div
          className={mergeClassName('flex min-w-0 flex-1 flex-col gap-3', classNames?.section)}
          style={styles?.section}
        >
          {hasTitle
            ? renderTitle(mergedTitleProps ?? {}, active, round, classNames?.title, styles?.title)
            : null}
          {hasParagraph
            ? renderParagraph(
                mergedParagraphProps ?? {},
                active,
                round,
                classNames?.paragraph,
                styles?.paragraph,
              )
            : null}
        </div>
      ) : null}
    </div>
  )
}

type SkeletonCompound = FC<SkeletonProps> & {
  Avatar: FC<SkeletonAvatarProps>
  Button: FC<SkeletonButtonProps>
  Input: FC<SkeletonInputProps>
  Image: FC<SkeletonImageProps>
  Node: FC<SkeletonNodeProps>
}

const Skeleton: SkeletonCompound = Object.assign(SkeletonRoot, {
  Avatar: SkeletonAvatar,
  Button: SkeletonButton,
  Input: SkeletonInput,
  Image: SkeletonImage,
  Node: SkeletonNode,
})

export default Skeleton
