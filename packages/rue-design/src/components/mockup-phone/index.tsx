import type { FC } from '@rue-js/rue'

export type MockupPhoneTone =
  | 'default'
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type MockupPhoneSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'

export interface MockupPhonePartProps {
  className?: string
  children?: any
  [key: string]: any
}

export interface MockupPhoneCameraConfig extends MockupPhonePartProps {}

export interface MockupPhoneDisplayConfig {
  className?: string
  contentClassName?: string
  children?: any
  src?: string
  alt?: string
  imgClassName?: string
}

export interface MockupPhoneRootProps {
  className?: string
  size?: MockupPhoneSize
  color?: MockupPhoneTone
  camera?: boolean | MockupPhoneCameraConfig
  display?: MockupPhoneDisplayConfig
  children?: any
  [key: string]: any
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const resolveSizeClass = (size?: MockupPhoneSize) => {
  switch (size) {
    case 'xs':
      return 'w-52'
    case 'sm':
    case 'small':
      return 'w-60'
    case 'md':
    case 'medium':
    case 'middle':
      return 'w-72'
    case 'lg':
    case 'large':
      return 'w-80'
    case 'xl':
      return 'w-96'
    default:
      return undefined
  }
}

const resolveToneClass = (color?: MockupPhoneTone) => {
  if (!color || color === 'default') {
    return undefined
  }
  return `border-${color}`
}

const Camera: FC<MockupPhonePartProps> = ({ className, children, ...rest }) => {
  return (
    <div {...rest} className={mergeClassName('mockup-phone-camera', className)}>
      {children}
    </div>
  )
}

const Display: FC<MockupPhonePartProps> = ({ className, children, ...rest }) => {
  return (
    <div {...rest} className={mergeClassName('mockup-phone-display', className)}>
      {children}
    </div>
  )
}

const renderDisplayContent = (display: MockupPhoneDisplayConfig) => {
  const {
    src,
    alt = 'mockup phone wallpaper',
    imgClassName,
    children,
    contentClassName,
  } = display

  const contentNode =
    children == null ? null : contentClassName ? <div className={contentClassName}>{children}</div> : children

  return (
    <>
      {src ? <img alt={alt} src={src} className={imgClassName} /> : null}
      {contentNode}
    </>
  )
}

const Root: FC<MockupPhoneRootProps> = ({
  className,
  size,
  color,
  camera,
  display,
  children,
  ...rest
}) => {
  let cls = 'mockup-phone'
  const sizeClass = resolveSizeClass(size)
  const toneClass = resolveToneClass(color)
  if (sizeClass) cls += ` ${sizeClass}`
  if (toneClass) cls += ` ${toneClass}`
  if (className) cls += ` ${className}`

  if (!display) {
    return (
      <div {...rest} className={cls}>
        {children}
      </div>
    )
  }

  const showCamera = camera !== false
  const cameraProps = typeof camera === 'object' ? camera : undefined

  return (
    <div {...rest} className={cls}>
      {showCamera ? <Camera {...cameraProps} /> : null}
      <Display className={display.className}>{renderDisplayContent(display)}</Display>
    </div>
  )
}

type MockupPhoneCompound = FC<MockupPhoneRootProps> & {
  Camera: FC<MockupPhonePartProps>
  Display: FC<MockupPhonePartProps>
}

const MockupPhone: MockupPhoneCompound = Object.assign(Root, {
  Camera,
  Display,
})

export default MockupPhone
