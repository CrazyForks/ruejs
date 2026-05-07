/*
TextRotate 组件概述
- 保留 Rue 当前 text-rotate 结构与视觉，并把排版语义职责交给独立 Typography 组件。
- 根组件继续支持 children / items 两种用法；items 内部会自动复用 Typography.Text / Typography.Link 渲染。
- 为了兼容旧写法，仍然保留 Text、Link、Title、Paragraph 这组别名，但推荐直接使用 Typography。
*/
import type { FC } from '@rue-js/rue'
import Typography, {
  type TypographyHeadingLevel,
  type TypographyInlineProps,
  type TypographyLinkProps,
  type TypographyParagraphProps,
  type TypographyTextProps,
  type TypographyTextTag,
  type TypographyTitleProps,
  type TypographyTone,
} from '../typography'

export type TextRotateTone = TypographyTone
export type TextRotateHeadingLevel = TypographyHeadingLevel
export type TextRotateTextTag = TypographyTextTag
export type TextRotateInlineProps = TypographyInlineProps
export type TextRotateTextProps = TypographyTextProps
export type TextRotateLinkProps = TypographyLinkProps
export type TextRotateTitleProps = TypographyTitleProps
export type TextRotateParagraphProps = TypographyParagraphProps

export interface TextRotateItem extends TypographyInlineProps {
  key?: string | number
  text?: any
  href?: string
  target?: string
  rel?: string
  as?: TextRotateTextTag
}

export interface TextRotateProps {
  as?: 'span' | 'div'
  className?: string
  style?: any
  children?: any
  items?: ReadonlyArray<TextRotateItem>
  innerClassName?: string
  innerStyle?: any
  itemClassName?: string
  itemStyle?: any
  [key: string]: any
}

const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const mergeStyle = (base?: any, extra?: any) => {
  if (base && extra) return { ...base, ...extra }
  return extra ?? base
}

const renderItem = (
  item: TextRotateItem,
  index: number,
  itemClassName?: string,
  itemStyle?: any,
) => {
  const key = item.key ?? index
  const content = item.children ?? item.text
  const mergedClassName = appendClassName(itemClassName ?? '', item.className).trim() || undefined
  const mergedStyle = mergeStyle(itemStyle, item.style)

  if (item.href) {
    return (
      <Typography.Link
        key={key}
        href={item.href}
        target={item.target}
        rel={item.rel}
        type={item.type}
        disabled={item.disabled}
        mark={item.mark}
        code={item.code}
        keyboard={item.keyboard}
        underline={item.underline}
        delete={item.delete}
        strong={item.strong}
        italic={item.italic}
        className={mergedClassName}
        style={mergedStyle}
      >
        {content}
      </Typography.Link>
    )
  }

  return (
    <Typography.Text
      key={key}
      as={item.as}
      type={item.type}
      disabled={item.disabled}
      mark={item.mark}
      code={item.code}
      keyboard={item.keyboard}
      underline={item.underline}
      delete={item.delete}
      strong={item.strong}
      italic={item.italic}
      className={mergedClassName}
      style={mergedStyle}
    >
      {content}
    </Typography.Text>
  )
}

const TextRotateRoot: FC<TextRotateProps> = ({
  as = 'span',
  className,
  style,
  children,
  items,
  innerClassName,
  innerStyle,
  itemClassName,
  itemStyle,
  ...rest
}) => {
  const cls = appendClassName('text-rotate', className)
  const content =
    items && items.length ? (
      <span className={innerClassName} style={innerStyle}>
        {items.map((item, index) => renderItem(item, index, itemClassName, itemStyle))}
      </span>
    ) : (
      children
    )

  if (as === 'div') {
    return (
      <div {...rest} className={cls} style={style}>
        {content}
      </div>
    )
  }

  return (
    <span {...rest} className={cls} style={style}>
      {content}
    </span>
  )
}

type TextRotateCompound = FC<TextRotateProps> & {
  Text: typeof Typography.Text
  Link: typeof Typography.Link
  Title: typeof Typography.Title
  Paragraph: typeof Typography.Paragraph
}

const TextRotate: TextRotateCompound = Object.assign(TextRotateRoot, {
  Text: Typography.Text,
  Link: Typography.Link,
  Title: Typography.Title,
  Paragraph: Typography.Paragraph,
})

export default TextRotate
