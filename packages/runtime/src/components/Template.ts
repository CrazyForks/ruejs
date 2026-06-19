/*
Template 组件概述
- 职责：为被编译器识别的特殊 <template> 用法提供运行时占位，不渲染额外元素包装。
- 容器策略：返回一个带起止注释锚点的 DocumentFragment，并把 children 始终渲染在该区间内。
- 属性语义：除 children 外的属性在运行时均忽略；普通原生 <template> 应由编译器保留为原生元素。
*/

import { type FC, type PropsWithChildren, renderAnchor, renderBetween, vapor } from '../rue'
import { appendChild, createComment, createDocumentFragment } from '../dom'
import { markBuiltinComponent } from './builtinMarkers'

/** Template 组件属性；运行时只关心 children。 */
export type TemplateProps = PropsWithChildren<Record<string, unknown>>

type TemplateChildInput = Parameters<typeof renderBetween>[0]

const toRenderable = (children: unknown): TemplateChildInput => {
  if (Array.isArray(children)) {
    return children.filter(child => child != null) as TemplateChildInput
  }
  return (children ?? []) as TemplateChildInput
}

/** 无包装渲染 children 的模板占位组件。 */
export const Template: FC<TemplateProps> = props => {
  return vapor(() => {
    const root = createDocumentFragment()
    const anchor = createComment('rue-template-anchor')

    appendChild(root, anchor)
    renderAnchor(toRenderable(props.children) as any, root as any, anchor as any)
    return root as any
  })
}

markBuiltinComponent(Template, 'Template')
