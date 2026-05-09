/* RUE_VAPOR_TRANSFORMED */
/*
Hover3D 组件概述
- 保持 daisyUI 所需的 9 个直系子节点结构，同时补齐链接语义、根节点透传和 surface 包装层能力。
- 默认仍是最轻量的包裹器；只有在需要控制第一层倾斜面板时，才额外创建 surface wrapper。
*/
import type { FC } from '@rue-js/rue'

export type Hover3DAs = 'div' | 'a'

export interface Hover3DSurfaceProps {
  [key: string]: any
}

export interface Hover3DProps {
  as?: Hover3DAs
  href?: string
  target?: string
  rel?: string
  className?: string
  surfaceAs?: string
  surfaceClassName?: string
  surfaceProps?: Hover3DSurfaceProps
  overlays?: boolean
  overlayClassName?: string
  children?: any
  [key: string]: any
}

const mergeClassName = (...classNames: Array<string | undefined | false>) => {
  return classNames.filter(Boolean).join(' ')
}

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

export default Hover3D
