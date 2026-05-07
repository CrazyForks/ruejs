/*
Footer 组件概述
- 保留原有 `children + className` 直出方式，继续兼容 daisyUI 风格拼装。
- 新增结构化 `brand + sections` 模式，便于更清晰地组织品牌区、链接列与自定义内容。
*/
import type { FC } from '@rue-js/rue'

export type FooterDirection = 'vertical' | 'horizontal'

export interface FooterLinkProps {
  as?: any
  className?: string
  children?: any
  content?: any
  href?: string
  target?: string
  rel?: string
  hover?: boolean
  [key: string]: any
}

export interface FooterItem extends Omit<FooterLinkProps, 'content'> {
  key?: string | number
  label?: any
  content?: any
}

export interface FooterTitleProps {
  as?: any
  className?: string
  children?: any
  content?: any
  [key: string]: any
}

export interface FooterBrandProps {
  as?: any
  className?: string
  children?: any
  content?: any
  [key: string]: any
}

export interface FooterSectionProps {
  as?: any
  className?: string
  children?: any
  title?: any
  titleClassName?: string
  content?: any
  items?: ReadonlyArray<FooterItem | any>
  inline?: boolean
  contentClassName?: string
  [key: string]: any
}

export interface FooterSection extends Omit<FooterSectionProps, 'content'> {
  key?: string | number
  content?: any
}

export interface FooterProps {
  as?: any
  direction?: FooterDirection
  center?: boolean
  className?: string
  children?: any
  brand?: any
  sections?: ReadonlyArray<FooterSection>
  wrap?: boolean
  bordered?: boolean
  [key: string]: any
}

const joinClassName = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(' ')

const hasRenderableContent = (value: any): boolean => {
  if (value == null) return false
  if (Array.isArray(value)) return value.some(item => hasRenderableContent(item))
  return true
}

const Title: FC<FooterTitleProps> = ({ as = 'h6', className, children, content, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={joinClassName('footer-title', className)}>
      {content ?? children}
    </Component>
  )
}

const Link: FC<FooterLinkProps> = ({
  as,
  className,
  children,
  content,
  href,
  target,
  rel,
  hover = true,
  ...rest
}) => {
  const Component = (as ?? (href ? 'a' : 'button')) as any
  const anchorRel = target === '_blank' && !rel ? 'noreferrer' : rel

  if (Component === 'a') {
    return (
      <a {...rest} href={href} target={target} rel={anchorRel} className={joinClassName('link', hover && 'link-hover', className)}>
        {content ?? children}
      </a>
    )
  }

  if (Component === 'button') {
    return (
      <button
        {...rest}
        type={rest.type ?? 'button'}
        className={joinClassName('link', hover && 'link-hover', className)}
      >
        {content ?? children}
      </button>
    )
  }

  return (
    <Component {...rest} className={joinClassName('link', hover && 'link-hover', className)}>
      {content ?? children}
    </Component>
  )
}

const isFooterItemConfig = (value: any): value is FooterItem => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return (
    'label' in value ||
    'content' in value ||
    'children' in value ||
    'href' in value ||
    'target' in value ||
    'rel' in value ||
    'as' in value ||
    'className' in value ||
    'hover' in value
  )
}

const renderFooterItem = (item: FooterItem | any, index: number) => {
  if (!hasRenderableContent(item)) return null

  if (isFooterItemConfig(item)) {
    const { key, label, content, children, ...rest } = item
    return (
      <Link key={key ?? `item-${index}`} {...rest}>
        {content ?? children ?? label}
      </Link>
    )
  }

  return <Link key={`item-${index}`}>{item}</Link>
}

const Brand: FC<FooterBrandProps> = ({ as = 'aside', className, children, content, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={className}>
      {content ?? children}
    </Component>
  )
}

const Section: FC<FooterSectionProps> = ({
  as = 'nav',
  className,
  children,
  title,
  titleClassName,
  content,
  items,
  inline,
  contentClassName,
  ...rest
}) => {
  const Component = as as any
  const renderedItems = (items ?? []).map((item, index) => renderFooterItem(item, index)).filter(Boolean)
  const body =
    hasRenderableContent(content) || hasRenderableContent(children) ? (
      content ?? children
    ) : inline ? (
      <div className={joinClassName('grid grid-flow-col auto-cols-max gap-4', contentClassName)}>{renderedItems}</div>
    ) : (
      renderedItems
    )

  return (
    <Component {...rest} className={className}>
      {hasRenderableContent(title) ? <Title className={titleClassName}>{title}</Title> : null}
      {body}
    </Component>
  )
}

const Root: FC<FooterProps> = ({
  as = 'footer',
  direction,
  center,
  className,
  children,
  brand,
  sections,
  wrap,
  bordered,
  ...rest
}) => {
  const Component = as as any
  const hasChildren = hasRenderableContent(children)
  const hasStructuredContent = hasRenderableContent(brand) || (sections?.length ?? 0) > 0

  return (
    <Component
      {...rest}
      className={joinClassName(
        'footer',
        direction && `footer-${direction}`,
        center && 'footer-center',
        wrap && 'gap-y-6',
        bordered && 'border-t border-base-300',
        className,
      )}
    >
      {hasChildren || !hasStructuredContent ? (
        children
      ) : (
        <>
          {hasRenderableContent(brand) ? <Brand>{brand}</Brand> : null}
          {(sections ?? []).map((section, index) => {
            const { key, ...sectionProps } = section
            return <Section key={key ?? `section-${index}`} {...sectionProps} />
          })}
        </>
      )}
    </Component>
  )
}

type FooterCompound = FC<FooterProps> & {
  Brand: FC<FooterBrandProps>
  Section: FC<FooterSectionProps>
  Title: FC<FooterTitleProps>
  Link: FC<FooterLinkProps>
}

const Footer: FooterCompound = Object.assign(Root, {
  Brand,
  Section,
  Title,
  Link,
})

export default Footer
