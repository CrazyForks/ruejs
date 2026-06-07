/* RUE_VAPOR_TRANSFORMED */
/*
Hover3D 组件概述
- 保持 daisyUI 所需的 9 个直系子节点结构，同时补齐链接语义、根节点透传和 surface 包装层能力。
- 默认仍是最轻量的包裹器；只有在需要控制第一层倾斜面板时，才额外创建 surface wrapper。
*/
import type { FC } from '@rue-js/rue'

/** Hover3DAs 类型。 */
export type Hover3DAs = 'div' | 'a'

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
  surfaceAs?: string
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

/** Overlay Divs 的内部工具函数。 */
const OverlayDivs: FC<{ className?: string }> = ({ className }) => (
  <>
    <div aria-hidden="true" data-hover3d-overlay="" className={className}></div>
    <div aria-hidden="true" data-hover3d-overlay="" className={className}></div>
    <div aria-hidden="true" data-hover3d-overlay="" className={className}></div>
    <div aria-hidden="true" data-hover3d-overlay="" className={className}></div>
    <div aria-hidden="true" data-hover3d-overlay="" className={className}></div>
    <div aria-hidden="true" data-hover3d-overlay="" className={className}></div>
    <div aria-hidden="true" data-hover3d-overlay="" className={className}></div>
    <div aria-hidden="true" data-hover3d-overlay="" className={className}></div>
  </>
)

/** 渲染 Surface 的内部工具函数。 */
const renderSurface = (
  children: any,
  surfaceAs?: string,
  surfaceClassName?: string,
  surfaceProps?: Hover3DSurfaceProps,
) => {
  if (!surfaceAs && !surfaceClassName && !surfaceProps) {
    return children
  }

  const {
    className: surfacePropClassName,
    children: _surfaceChildren,
    ...surfaceRest
  } = surfaceProps ?? {}
  const Surface = (surfaceAs ?? 'div') as any
  const mergedClassName = mergeClassName(surfacePropClassName, surfaceClassName)

  return (
    <Surface {...surfaceRest} data-hover3d-surface="" className={mergedClassName || undefined}>
      {children}
    </Surface>
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
  const Component = (as ?? (href ? 'a' : 'div')) as any
  const mergedRel = target === '_blank' && !rel ? 'noreferrer' : rel

  return (
    <Component
      {...rest}
      {...(Component === 'a' && href != null ? { href } : {})}
      target={Component === 'a' ? target : undefined}
      rel={Component === 'a' ? mergedRel : undefined}
      className={mergeClassName('hover-3d', className)}
    >
      {renderSurface(children, surfaceAs, surfaceClassName, surfaceProps)}
      {overlays ? <OverlayDivs className={overlayClassName} /> : null}
    </Component>
  )
}

/** 默认导出Hover3d组件。 */
export default Hover3D
