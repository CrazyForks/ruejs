/*
HoverGallery 组件概述
- 数据驱动：支持字符串 src、对象项或自定义节点 node。
- 标签：可渲染为 figure 或 div。
*/
import type { FC } from '@rue-js/rue'

export interface HoverGalleryItem {
  key?: string | number
  src?: string
  alt?: string
  className?: string
  imageClassName?: string
  label?: any
  node?: any
}

export type HoverGalleryFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'

export interface HoverGalleryProps {
  as?: 'figure' | 'div'
  className?: string
  wrapperClassName?: string
  children?: any
  items?: ReadonlyArray<HoverGalleryItem | string | any>
  imageClassName?: string
  fit?: HoverGalleryFit
  showGuide?: boolean
  guideLabels?: ReadonlyArray<any>
  guideClassName?: string
  guideItemClassName?: string
  [key: string]: any
}

interface NormalizedGalleryItem {
  key: string | number
  node: any
  label?: any
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const resolveFitClass = (fit?: HoverGalleryFit) => {
  switch (fit) {
    case 'contain':
      return 'object-contain'
    case 'fill':
      return 'object-fill'
    case 'none':
      return 'object-none'
    case 'scale-down':
      return 'object-scale-down'
    case 'cover':
    default:
      return fit ? 'object-cover' : undefined
  }
}

const toArray = (value: any): any[] => {
  if (value == null || value === false) return []
  if (!Array.isArray(value)) return [value]

  const result: any[] = []
  value.forEach(item => {
    result.push(...toArray(item))
  })
  return result
}

const normalizeItem = (
  item: HoverGalleryItem | string | any,
  index: number,
  fitClass?: string,
  imageClassName?: string,
): NormalizedGalleryItem => {
  if (typeof item === 'string') {
    return {
      key: index,
      node: <img key={index} src={item} alt="" className={mergeClassName('', mergeClassName(fitClass ?? '', imageClassName)).trim() || undefined} />,
    }
  }

  if (item && typeof item === 'object') {
    const objectItem = item as HoverGalleryItem

    if (objectItem.node != null) {
      return {
        key: objectItem.key ?? index,
        node: objectItem.node,
        label: objectItem.label,
      }
    }

    if (objectItem.src) {
      return {
        key: objectItem.key ?? index,
        label: objectItem.label,
        node: (
          <img
            key={objectItem.key ?? index}
            src={objectItem.src}
            alt={objectItem.alt ?? ''}
            className={mergeClassName(
              mergeClassName(fitClass ?? '', imageClassName),
              mergeClassName(objectItem.className ?? '', objectItem.imageClassName),
            ).trim() || undefined}
          />
        ),
      }
    }
  }

  return {
    key: index,
    node: item,
  }
}

const normalizeItems = (
  items: HoverGalleryProps['items'],
  children: any,
  fitClass?: string,
  imageClassName?: string,
) => {
  if (items && items.length > 0) {
    return items.map((item, index) => normalizeItem(item, index, fitClass, imageClassName))
  }

  return toArray(children).map((child, index) => ({
    key: index,
    node: child,
  }))
}

/**
 * 悬浮画廊：保持 daisyUI 的 hover-gallery 视觉基础，同时补齐数据驱动、图片层配置与引导遮罩。
 */
const HoverGallery: FC<HoverGalleryProps> = props => {
  const as = props.as ?? 'figure'
  const className = props.className
  const wrapperClassName = props.wrapperClassName
  const children = props.children
  const items = props.items
  const imageClassName = props.imageClassName
  const fit = props.fit
  const showGuide = props.showGuide
  const guideLabels = props.guideLabels
  const guideClassName = props.guideClassName
  const guideItemClassName = props.guideItemClassName
  const fitClass = resolveFitClass(fit)
  const normalizedItems = normalizeItems(items, children, fitClass, imageClassName)
  const galleryContent = normalizedItems.map(item => item.node)
  const guideCount = normalizedItems.length > 1 ? normalizedItems.length - 1 : 0
  const Component = as as any
  const galleryClassName = mergeClassName('hover-gallery', className)
  const rootProps = Object.assign({}, props) as Record<string, any>

  delete rootProps.as
  delete rootProps.className
  delete rootProps.wrapperClassName
  delete rootProps.children
  delete rootProps.items
  delete rootProps.imageClassName
  delete rootProps.fit
  delete rootProps.showGuide
  delete rootProps.guideLabels
  delete rootProps.guideClassName
  delete rootProps.guideItemClassName

  const galleryNode = (
    <Component {...rootProps} className={galleryClassName}>
      {galleryContent}
    </Component>
  )

  if (!showGuide || guideCount === 0) {
    return galleryNode
  }

  return (
    <div className={mergeClassName('grid *:[grid-area:1/1]', wrapperClassName)}>
      {galleryNode}
      <div
        className={mergeClassName('pointer-events-none grid font-mono text-white text-shadow-lg', guideClassName)}
        style={{ gridTemplateColumns: `repeat(${guideCount}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {normalizedItems.slice(1).map((item, index) => (
          <div
            key={item.key}
            className={mergeClassName(
              'from-white/10 via-transparent to-black/10 bg-linear-80 grid place-content-center',
              guideItemClassName,
            )}
          >
            {guideLabels?.[index] ?? item.label ?? index + 2}
          </div>
        ))}
      </div>
    </div>
  )
}

export default HoverGallery
