/**
 * text/legacy/image shim
 *
 * Provides the pre-Text.js 13 Image component API with layout prop.
 * Translates legacy props (layout, objectFit, objectPosition) to the
 * modern Image component's fill/style props.
 *
 * This module is used by apps that ran the `text-image-to-legacy-image`
 * codemod when upgrading from Text.js 12.
 */
import Image from './image.js'
import {
  type RueElementProps,
  type RueEventHandler,
  type RueRef,
  type RueStyle,
} from './rue-shim-types.js'
import type { TextNode } from '../runtime/render-protocol.js'

type LegacyImageProps = {
  src: string | { src: string; width: number; height: number; blurDataURL?: string }
  alt: string
  width?: number | string
  height?: number | string
  /** Legacy layout mode */
  layout?: 'fixed' | 'intrinsic' | 'responsive' | 'fill'
  /** CSS object-fit (used with layout="fill") */
  objectFit?: string
  /** CSS object-position (used with layout="fill") */
  objectPosition?: string
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  loader?: (params: { src: string; width: number; quality?: number }) => string
  sizes?: string
  className?: string
  style?: RueStyle
  onLoad?: RueEventHandler<HTMLImageElement>
  onLoadingComplete?: (result: { naturalWidth: number; naturalHeight: number }) => void
  onError?: RueEventHandler<HTMLImageElement>
  loading?: 'lazy' | 'eager'
  unoptimized?: boolean
  id?: string
} & Omit<
  RueElementProps<HTMLImageElement>,
  'src' | 'alt' | 'width' | 'height' | 'onLoad' | 'onError' | 'style'
>

function LegacyImage(props: LegacyImageProps & { ref?: RueRef<HTMLImageElement> }): TextNode {
  const {
    layout = 'intrinsic',
    objectFit,
    objectPosition,
    onLoadingComplete,
    onLoad,
    width,
    height,
    style,
    ref,
    ...rest
  } = props

  // Translate legacy props to modern Image props
  const modernStyle: RueStyle = { ...style }

  if (objectFit) modernStyle.objectFit = objectFit
  if (objectPosition) modernStyle.objectPosition = objectPosition

  const handleLoad = onLoadingComplete
    ? ((e => {
        const img = e.currentTarget
        onLoadingComplete({
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        })
        onLoad?.(e)
      }) satisfies RueEventHandler<HTMLImageElement>)
    : onLoad

  if (layout === 'fill') {
    return <Image ref={ref} fill style={modernStyle} onLoad={handleLoad} {...rest} />
  }

  if (layout === 'responsive') {
    // Responsive: takes full width, maintains aspect ratio
    modernStyle.width = '100%'
    modernStyle.height = 'auto'
  }

  // For "fixed" and "intrinsic", pass width/height directly
  const w = typeof width === 'string' ? parseInt(width, 10) : width
  const h = typeof height === 'string' ? parseInt(height, 10) : height

  return <Image ref={ref} width={w} height={h} style={modernStyle} onLoad={handleLoad} {...rest} />
}

export default LegacyImage
