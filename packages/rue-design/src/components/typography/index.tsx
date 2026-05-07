/*
Typography 组件概述
- 参考 ant-design 的 Typography 复合 API，提供 Text、Link、Title、Paragraph 语义组件。
- 保留 Rue 当前偏轻量的实现方式，继续用 daisyUI 与原子类完成视觉表达，不强加额外样式系统。
- Text Rotate 等组件可以直接复用这些语义化排版能力，避免把排版职责塞进业务组件本身。
*/
import type { FC } from '@rue-js/rue'

export type TypographyTone = 'default' | 'secondary' | 'success' | 'warning' | 'danger'
export type TypographyHeadingLevel = 1 | 2 | 3 | 4 | 5
export type TypographyTextTag = 'span' | 'div' | 'p'
export type TypographyRootTag = 'div' | 'section' | 'article'

export interface TypographyInlineProps {
  type?: TypographyTone
  disabled?: boolean
  mark?: boolean
  code?: boolean
  keyboard?: boolean
  underline?: boolean
  delete?: boolean
  strong?: boolean
  italic?: boolean
  className?: string
  style?: any
  children?: any
  [key: string]: any
}

export interface TypographyProps {
  as?: TypographyRootTag
  className?: string
  style?: any
  children?: any
  [key: string]: any
}

export interface TypographyTextProps extends TypographyInlineProps {
  as?: TypographyTextTag
}

export interface TypographyLinkProps extends TypographyInlineProps {
  href?: string
  target?: string
  rel?: string
}

export interface TypographyTitleProps extends TypographyInlineProps {
  level?: TypographyHeadingLevel
}

export interface TypographyParagraphProps extends TypographyInlineProps {}

const mergeClassNames = (...parts: Array<string | undefined | false>) => {
  return parts.filter(Boolean).join(' ')
}

const resolveToneClass = (type?: TypographyTone) => {
  switch (type) {
    case 'secondary':
      return 'text-base-content/65'
    case 'success':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'danger':
      return 'text-error'
    default:
      return undefined
  }
}

const buildInlineClassName = ({
  type,
  disabled,
  underline,
  deleted,
  strong,
  italic,
  className,
  display,
  link,
}: {
  type?: TypographyTone
  disabled?: boolean
  underline?: boolean
  deleted?: boolean
  strong?: boolean
  italic?: boolean
  className?: string
  display?: 'inline' | 'block'
  link?: boolean
}) => {
  return mergeClassNames(
    display,
    link ? 'link link-hover decoration-current underline-offset-4' : undefined,
    resolveToneClass(type),
    disabled ? 'cursor-not-allowed opacity-45' : undefined,
    underline ? 'underline decoration-current underline-offset-4' : undefined,
    deleted ? 'line-through' : undefined,
    strong ? 'font-semibold' : undefined,
    italic ? 'italic' : undefined,
    className,
  )
}

const renderDecoratedContent = (
  content: any,
  {
    mark,
    code,
    keyboard,
  }: {
    mark?: boolean
    code?: boolean
    keyboard?: boolean
  },
) => {
  let node = content
  if (keyboard) {
    node = <kbd className="kbd kbd-sm align-middle">{node}</kbd>
  }
  if (code) {
    node = <code className="rounded bg-base-200 px-1.5 py-0.5 text-[0.9em]">{node}</code>
  }
  if (mark) {
    node = (
      <mark className="rounded bg-warning/20 px-1 py-0.5 text-inherit">
        {node}
      </mark>
    )
  }
  return node
}

const TypographyRoot: FC<TypographyProps> = ({
  as = 'div',
  className,
  style,
  children,
  ...rest
}) => {
  const props = {
    ...rest,
    className: mergeClassNames('rue-typography text-base-content', className),
    style,
  }

  if (as === 'article') {
    return <article {...props}>{children}</article>
  }
  if (as === 'section') {
    return <section {...props}>{children}</section>
  }
  return <div {...props}>{children}</div>
}

const Text: FC<TypographyTextProps> = ({
  as = 'span',
  type,
  disabled,
  mark,
  code,
  keyboard,
  underline,
  delete: deleted,
  strong,
  italic,
  className,
  style,
  children,
  ...rest
}) => {
  const content = renderDecoratedContent(children, { mark, code, keyboard })
  const props = {
    ...rest,
    className: buildInlineClassName({
      type,
      disabled,
      underline,
      deleted,
      strong,
      italic,
      className,
      display: as === 'span' ? 'inline' : 'block',
    }),
    style,
    'aria-disabled': disabled ? 'true' : undefined,
  }

  if (as === 'div') {
    return <div {...props}>{content}</div>
  }
  if (as === 'p') {
    return <p {...props}>{content}</p>
  }
  return <span {...props}>{content}</span>
}

const Link: FC<TypographyLinkProps> = ({
  href,
  target,
  rel,
  type,
  disabled,
  mark,
  code,
  keyboard,
  underline,
  delete: deleted,
  strong,
  italic,
  className,
  style,
  children,
  tabIndex,
  ...rest
}) => {
  const content = renderDecoratedContent(children, { mark, code, keyboard })

  return (
    <a
      {...rest}
      href={disabled ? undefined : href}
      target={target}
      rel={target === '_blank' && !rel ? 'noreferrer' : rel}
      className={buildInlineClassName({
        type,
        disabled,
        underline: underline ?? true,
        deleted,
        strong,
        italic,
        className,
        display: 'inline',
        link: true,
      })}
      style={style}
      aria-disabled={disabled ? 'true' : undefined}
      tabindex={disabled ? '-1' : tabIndex === undefined ? undefined : String(tabIndex)}
    >
      {content}
    </a>
  )
}

const resolveTitleClassName = (level: TypographyHeadingLevel) => {
  switch (level) {
    case 1:
      return 'block text-4xl font-semibold tracking-tight text-balance md:text-5xl'
    case 2:
      return 'block text-3xl font-semibold tracking-tight text-balance md:text-4xl'
    case 3:
      return 'block text-2xl font-semibold tracking-tight text-balance md:text-3xl'
    case 4:
      return 'block text-xl font-semibold tracking-tight text-balance md:text-2xl'
    default:
      return 'block text-lg font-semibold tracking-tight text-balance md:text-xl'
  }
}

const Title: FC<TypographyTitleProps> = ({
  level = 1,
  type,
  disabled,
  mark,
  code,
  keyboard,
  underline,
  delete: deleted,
  strong,
  italic,
  className,
  style,
  children,
  ...rest
}) => {
  const props = {
    ...rest,
    className: mergeClassNames(
      resolveTitleClassName(level),
      buildInlineClassName({
        type,
        disabled,
        underline,
        deleted,
        strong,
        italic,
        className,
      }),
    ),
    style,
    'aria-disabled': disabled ? 'true' : undefined,
  }
  const content = renderDecoratedContent(children, { mark, code, keyboard })

  if (level === 1) return <h1 {...props}>{content}</h1>
  if (level === 2) return <h2 {...props}>{content}</h2>
  if (level === 3) return <h3 {...props}>{content}</h3>
  if (level === 4) return <h4 {...props}>{content}</h4>
  return <h5 {...props}>{content}</h5>
}

const Paragraph: FC<TypographyParagraphProps> = ({
  type,
  disabled,
  mark,
  code,
  keyboard,
  underline,
  delete: deleted,
  strong,
  italic,
  className,
  style,
  children,
  ...rest
}) => {
  return (
    <p
      {...rest}
      className={mergeClassNames(
        'block leading-7 text-base-content/80',
        buildInlineClassName({
          type,
          disabled,
          underline,
          deleted,
          strong,
          italic,
          className,
        }),
      )}
      style={style}
      aria-disabled={disabled ? 'true' : undefined}
    >
      {renderDecoratedContent(children, { mark, code, keyboard })}
    </p>
  )
}

type TypographyCompound = FC<TypographyProps> & {
  Text: FC<TypographyTextProps>
  Link: FC<TypographyLinkProps>
  Title: FC<TypographyTitleProps>
  Paragraph: FC<TypographyParagraphProps>
}

const Typography: TypographyCompound = Object.assign(TypographyRoot, {
  Text,
  Link,
  Title,
  Paragraph,
})

export default Typography
