/*
Hover3D 组件概述
- 保持 daisyUI 所需的 9 个直系子节点结构，同时补齐链接语义、根节点透传和 surface 包装层能力。
- 默认仍是最轻量的包裹器；只有在需要控制第一层倾斜面板时，才额外创建 surface wrapper。
*/
import type { FC } from '@rue-js/rue'

/** Hover3DAs 类型。 */
export type Hover3DAs = 'div' | 'a'
/** Hover3DSurfaceAs 类型。 */
export type Hover3DSurfaceAs = 'div' | 'figure' | 'article' | 'section'

/** Hover3DSurfaceProps 组件属性。 */
export interface Hover3DSurfaceProps {
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** Hover3DProps 组件属性。 */
export interface Hover3DProps {
  /** 自定义渲染的宿主元素。 */
  as?: Hover3DAs
  /** 链接地址。 */
  href?: string
  /** 链接或定位目标。 */
  target?: string
  /** 链接 rel 属性。 */
  rel?: string
  /** 根节点附加类名。 */
  className?: string
  /** surfaceAs 配置项。 */
  surfaceAs?: Hover3DSurfaceAs
  /** surfaceClassName 附加类名。 */
  surfaceClassName?: string
  /** surfaceProps 透传属性。 */
  surfaceProps?: Hover3DSurfaceProps
  /** overlays 配置项。 */
  overlays?: boolean
  /** overlayClassName 附加类名。 */
  overlayClassName?: string
  /** 组件子内容。 */
  children?: any
  /** 允许透传原生属性或扩展字段。 */
  [key: string]: any
}

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (...classNames: Array<string | undefined | false>) => {
  return classNames.filter(Boolean).join(' ')
}

/** Hover3D Surface 的内部工具组件。 */
const Hover3DSurface: FC<{
  as?: Hover3DSurfaceAs
  className?: string
  props?: Hover3DSurfaceProps
  children?: any
}> = ({ as = 'div', className, props, children }) => {
  const {
    className: surfacePropClassName,
    children: _surfaceChildren,
    ...surfaceRest
  } = props ?? {}
  const mergedClassName = mergeClassName(surfacePropClassName, className)
  const finalClassName = mergedClassName || undefined

  if (as === 'figure') {
    return (
      <figure {...surfaceRest} data-hover3d-surface="" className={finalClassName}>
        {children}
      </figure>
    )
  }

  if (as === 'article') {
    return (
      <article {...surfaceRest} data-hover3d-surface="" className={finalClassName}>
        {children}
      </article>
    )
  }

  if (as === 'section') {
    return (
      <section {...surfaceRest} data-hover3d-surface="" className={finalClassName}>
        {children}
      </section>
    )
  }

  return (
    <div {...surfaceRest} data-hover3d-surface="" className={finalClassName}>
      {children}
    </div>
  )
}

/** Hover3 D 的内部工具函数。 */
const Hover3D: FC<Hover3DProps> = ({
  as,
  href,
  target,
  rel,
  className,
  surfaceAs,
  surfaceClassName,
  surfaceProps,
  overlays = true,
  overlayClassName,
  children,
  ...rest
}) => {
  const renderAs = as ?? (href ? 'a' : 'div')
  const mergedRel = target === '_blank' && !rel ? 'noreferrer' : rel
  const rootClassName = mergeClassName('hover-3d', className)
  const wrappedSurface = surfaceAs || surfaceClassName || surfaceProps
  const overlayClass = overlayClassName || ''

  if (renderAs === 'a') {
    return (
      <a {...rest} href={href} target={target} rel={mergedRel} className={rootClassName}>
        {wrappedSurface ? (
          <Hover3DSurface as={surfaceAs} className={surfaceClassName} props={surfaceProps}>
            {children}
          </Hover3DSurface>
        ) : (
          children
        )}
        {overlays ? (
          <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
        ) : null}
        {overlays ? (
          <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
        ) : null}
        {overlays ? (
          <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
        ) : null}
        {overlays ? (
          <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
        ) : null}
        {overlays ? (
          <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
        ) : null}
        {overlays ? (
          <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
        ) : null}
        {overlays ? (
          <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
        ) : null}
        {overlays ? (
          <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
        ) : null}
      </a>
    )
  }

  if (!wrappedSurface) {
    return (
      <div {...rest} className={rootClassName}>
        {children}
        {Array.from({ length: overlays ? 8 : 0 }).map((_, index) => (
          <div
            key={index}
            aria-hidden="true"
            data-hover3d-overlay=""
            className={overlayClass}
          ></div>
        ))}
      </div>
    )
  }

  return (
    <div {...rest} className={rootClassName}>
      {wrappedSurface ? (
        <Hover3DSurface as={surfaceAs} className={surfaceClassName} props={surfaceProps}>
          {children}
        </Hover3DSurface>
      ) : (
        children
      )}
      {overlays ? (
        <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
      ) : null}
      {overlays ? (
        <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
      ) : null}
      {overlays ? (
        <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
      ) : null}
      {overlays ? (
        <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
      ) : null}
      {overlays ? (
        <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
      ) : null}
      {overlays ? (
        <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
      ) : null}
      {overlays ? (
        <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
      ) : null}
      {overlays ? (
        <div aria-hidden="true" data-hover3d-overlay="" className={overlayClass}></div>
      ) : null}
    </div>
  )
}

/** 默认导出Hover3d组件。 */
export default Hover3D
