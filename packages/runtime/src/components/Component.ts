/*
Component 组件概述
- 使用场景：根据 is prop 在运行时切换原生标签或已注册组件。
- 解析策略：函数值直接视为组件；字符串优先查当前 runtime 的注册表，未命中时回退为原生标签名。
- 属性语义：除 is 外的其他 props 和 children 原样透传给最终解析结果。
*/

import {
  h,
  type ComponentInstance,
  type ComponentProps,
  type FC,
  type PropsWithChildren,
} from '../rue'
import { withParentContextProps } from '../context'
import { resolveCurrentRuntimeComponent } from '../component-registry'

/** <Component> 动态组件属性。 */
export interface DynamicComponentProps extends PropsWithChildren<Record<string, unknown>> {
  /** 目标标签名、已注册组件名或组件函数。 */
  is?: string | ComponentInstance<any> | null
}

const BUILTIN_COMPONENT_TAG = 'component'

const resolveDynamicComponentType = (value: DynamicComponentProps['is']) => {
  if (value == null) {
    return null
  }

  if (typeof value !== 'string') {
    return value
  }

  return resolveCurrentRuntimeComponent(value) ?? value
}

type ForwardedComponentInput = {
  forwardedProps: ComponentProps
  forwardedChildren: unknown[]
}

const splitForwardedProps = (props: DynamicComponentProps): ForwardedComponentInput => {
  const forwardedProps: ComponentProps = {}
  const forwardedChildren: unknown[] = []

  for (const [key, value] of Object.entries(props)) {
    if (key === 'is') {
      continue
    }
    if (key === '__rue_context_parent_instance__') {
      continue
    }
    if (key === 'children') {
      if (Array.isArray(value)) {
        forwardedChildren.push(...value)
      } else if (value != null) {
        forwardedChildren.push(value)
      }
      continue
    }
    forwardedProps[key] = value
  }

  return {
    forwardedProps,
    forwardedChildren,
  }
}

/** 根据 is 属性动态渲染原生标签或已注册组件。 */
export const Component: FC<DynamicComponentProps> = props => {
  const resolvedType = resolveDynamicComponentType(props.is)

  if (!resolvedType || resolvedType === BUILTIN_COMPONENT_TAG || resolvedType === Component) {
    return null as any
  }

  const { forwardedProps, forwardedChildren } = splitForwardedProps(props)

  return h(
    resolvedType as any,
    withParentContextProps(resolvedType as any, forwardedProps) as ComponentProps,
    ...(forwardedChildren as any[]),
  )
}
