import {
  TextFragment,
  TextSuspense,
  createTextElement,
  type TextComponentType,
  type TextElement,
  type TextNode,
} from '../runtime/render-protocol.js'
import {
  createSafeTextElement,
  isTextCompatRendererActive,
  isTextCompatServerRendererActive,
  readTextCompatCreateElement,
  readTextCompatFragment,
  readTextCompatSuspense,
} from './rue-element-compat.js'
import { readContextRuntime } from './context-runtime-global.js'

type TextCompatStateUpdate<S, P> =
  | Partial<S>
  | S
  | null
  | ((state: Readonly<S>, props: Readonly<P>) => Partial<S> | S | null)

export type TextCompatNode = TextNode
export type TextCompatElement = TextElement
export type TextCompatClassComponentType<P = Record<string, unknown>> = new (
  props: P,
) => TextCompatComponent<P, any>
export type TextCompatComponentType<P = Record<string, unknown>> =
  | TextComponentType<P>
  | TextCompatClassComponentType<P>

export class TextCompatComponent<P = {}, S = {}> {
  props: Readonly<P>
  state: Readonly<S>

  constructor(props: P) {
    this.props = props
    this.state = {} as Readonly<S>
  }

  setState(update: TextCompatStateUpdate<S, P>, callback?: () => void): void {
    const textState = typeof update === 'function' ? update(this.state, this.props) : update
    if (textState && typeof textState === 'object') {
      this.state = {
        ...(this.state as object),
        ...(textState as object),
      } as Readonly<S>
    }
    callback?.()
  }

  forceUpdate(callback?: () => void): void {
    callback?.()
  }

  render(): TextCompatNode {
    return null
  }
}

;(TextCompatComponent.prototype as { isRueComponent?: Record<string, never> }).isRueComponent = {}

export const TextCompatFragment = TextFragment
export const TextCompatSuspense = TextSuspense

type TextCompatRenderRuntime = {
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown
}

function getInstalledTextCompatRuntime(): TextCompatRenderRuntime | null {
  return readContextRuntime<TextCompatRenderRuntime>() ?? null
}

function getActiveTextCompatRuntime(): TextCompatRenderRuntime | null {
  const runtime = getInstalledTextCompatRuntime()
  if (runtime) return runtime
  const createElement = readTextCompatCreateElement()
  return isTextCompatRendererActive() && createElement ? { createElement } : null
}

function isClassComponentType<P>(type: unknown): type is TextCompatClassComponentType<P> {
  return (
    typeof type === 'function' &&
    !!(type as { prototype?: { render?: unknown } }).prototype &&
    typeof (type as { prototype?: { render?: unknown } }).prototype?.render === 'function'
  )
}

function createClassComponentAdapter<P>(ClassComponent: TextCompatClassComponentType<P>) {
  return function TextCompatClassComponentAdapter(componentProps: P): TextCompatNode {
    const instance = new ClassComponent(componentProps)
    return instance.render()
  }
}

export function createTextCompatElement<P = Record<string, unknown>>(
  type: string | TextCompatComponentType<P>,
  props: P | null,
  ...children: TextCompatNode[]
): TextCompatElement {
  const runtime = getActiveTextCompatRuntime()
  const elementType = isClassComponentType<P>(type) ? createClassComponentAdapter(type) : type
  if (runtime) {
    return createSafeTextElement(
      runtime.createElement,
      elementType === TextCompatFragment
        ? (readTextCompatFragment() ?? type)
        : elementType === TextCompatSuspense
          ? (readTextCompatSuspense() ?? type)
          : elementType,
      cleanElementProps(props),
      ...(children as unknown[]),
    ) as TextCompatElement
  }
  if (isClassComponentType<P>(type)) {
    return createTextElement(elementType, props, ...children)
  }
  return createTextElement(type, props, ...children)
}

function cleanElementProps<P>(props: P | null): Record<string, unknown> | null {
  if (!props) return null
  const cleanedProps: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) cleanedProps[key] = value
  }
  return cleanedProps
}

export function startTextCompatTransition(callback: () => void): void {
  callback()
}

export function isTextCompatRenderRuntime(): boolean {
  return !!getActiveTextCompatRuntime()
}

export function isTextCompatServerRender(): boolean {
  return typeof window === 'undefined' || isTextCompatServerRendererActive()
}

export {
  TextCompatComponent as RueCompatComponent,
  TextCompatFragment as RueCompatFragment,
  TextCompatSuspense as RueCompatSuspense,
  createTextCompatElement as createRueCompatElement,
  isTextCompatRenderRuntime as isRueCompatRenderRuntime,
  isTextCompatServerRender as isRueCompatServerRender,
  startTextCompatTransition as startRueCompatTransition,
}
export type {
  TextCompatClassComponentType as RueCompatClassComponentType,
  TextCompatComponentType as RueCompatComponentType,
  TextCompatElement as RueCompatElement,
  TextCompatNode as RueCompatNode,
}
