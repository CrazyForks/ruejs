import type {
  ChildInput,
  ComponentInstance,
  ComponentProps,
  RenderableOutput,
} from './runtime-types'

type CreateElement = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  ...children: ChildInput[]
) => RenderableOutput

let createElement: CreateElement | undefined

/** 由默认 runtime 入口安装实际 createElement，避免 JSX 基础工厂反向依赖总入口。 */
export const installJSXCreateElement = (implementation: CreateElement) => {
  createElement = implementation
}

const getCreateElement = (): CreateElement => {
  if (!createElement) {
    throw new Error('[rue] JSX runtime was used before the default runtime initialized')
  }
  return createElement
}

/** JSX/TSX 工厂函数：与默认 runtime 的 createElement 同源。 */
export function h<P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  ...children: ChildInput[]
): RenderableOutput {
  return getCreateElement()(type, props, ...children)
}

const normalizeJsxProps = (
  props: ComponentProps | null | undefined,
  key?: unknown,
): ComponentProps | null => {
  if (!props && key === undefined) return null
  const nextProps: ComponentProps = {}
  if (props) {
    for (const propKey in props) {
      const value = props[propKey]
      if (value !== undefined) nextProps[propKey] = value
    }
  }
  if (key !== undefined) nextProps.key = key
  return Object.keys(nextProps).length > 0 ? nextProps : null
}

export function jsx<P = {}>(
  type: string | ComponentInstance<P>,
  props?: ComponentProps | null,
  key?: unknown,
): RenderableOutput {
  const nextProps = normalizeJsxProps(props, key)
  const children = props ? props.children : undefined
  return Array.isArray(children)
    ? getCreateElement()(type, nextProps, ...children)
    : children !== undefined
      ? getCreateElement()(type, nextProps, children)
      : getCreateElement()(type, nextProps)
}

export const jsxs = jsx

export function jsxDEV<P = {}>(
  type: string | ComponentInstance<P>,
  props?: ComponentProps | null,
  key?: unknown,
): RenderableOutput {
  return jsx(type, props, key)
}

/** JSX Fragment 标记，最终由底层 runtime 识别为片段渲染。 */
export const Fragment = 'fragment'
