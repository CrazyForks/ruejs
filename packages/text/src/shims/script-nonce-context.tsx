import {
  createTextCompatElement,
  createRequiredTextCompatContext,
  useTextCompatContext,
  type TextCompatElement,
} from './context-adapter.js'
import type { TextPropsWithChildren } from '../runtime/render-protocol.js'

const SCRIPT_NONCE_CONTEXT_KEY = Symbol.for('text.scriptNonceContext')
const SCRIPT_NONCE_STACK_KEY = Symbol.for('text.scriptNonceStack')

type ScriptNonceGlobal = typeof globalThis & {
  [SCRIPT_NONCE_STACK_KEY]?: string[]
}

export const ScriptNonceContext = createRequiredTextCompatContext<string | undefined>(
  SCRIPT_NONCE_CONTEXT_KEY,
  undefined,
)

export function ScriptNonceProvider(
  props: TextPropsWithChildren<{
    nonce?: string
  }>,
): TextCompatElement {
  const childrenWithNonce = applyNonceToDirectScriptChildren(props.children, props.nonce)
  if (props.nonce && containsDirectScriptComponent(props.children)) {
    pushScriptNonceUntilCurrentRenderSettles(props.nonce)
    return childrenWithNonce as TextCompatElement
  }

  return createTextCompatElement(
    ScriptNonceContext.Provider,
    { value: props.nonce },
    childrenWithNonce,
  )
}

export function withScriptNonce(element: TextCompatElement, nonce?: string): TextCompatElement {
  if (!nonce) {
    return element
  }

  return createTextCompatElement(ScriptNonceProvider, { nonce }, element)
}

function getScriptNonceStack(): string[] {
  const globalState = globalThis as ScriptNonceGlobal
  globalState[SCRIPT_NONCE_STACK_KEY] ??= []
  return globalState[SCRIPT_NONCE_STACK_KEY]
}

function readCurrentScriptNonce(): string | undefined {
  const stack = getScriptNonceStack()
  return stack.length > 0 ? stack[stack.length - 1] : undefined
}

function pushScriptNonceUntilCurrentRenderSettles(nonce: string): void {
  const stack = getScriptNonceStack()
  stack.push(nonce)
  queueMicrotask(() => {
    const index = stack.lastIndexOf(nonce)
    if (index !== -1) {
      stack.splice(index, 1)
    }
  })
}

function applyNonceToDirectScriptChildren(
  node: TextPropsWithChildren['children'],
  nonce?: string,
): TextPropsWithChildren['children'] {
  if (!nonce) return node
  if (Array.isArray(node)) {
    return node.map(child => applyNonceToDirectScriptChildren(child, nonce))
  }
  if (typeof node !== 'object' || node === null) return node

  const element = node as {
    props?: Record<string, unknown> | null
    type?: unknown
  }
  if (!element.props) return node

  const children = applyNonceToDirectScriptChildren(element.props.children, nonce)
  const isScriptComponent = isScriptComponentType(element.type) || isScriptLikeProps(element.props)

  return {
    ...element,
    props: {
      ...element.props,
      ...(children !== element.props.children ? { children } : null),
      ...(isScriptComponent && typeof element.props.nonce !== 'string' ? { nonce } : null),
    },
  }
}

function containsDirectScriptComponent(node: TextPropsWithChildren['children']): boolean {
  if (Array.isArray(node)) return node.some(containsDirectScriptComponent)
  if (typeof node !== 'object' || node === null) return false
  const element = node as {
    props?: Record<string, unknown> | null
    type?: unknown
  }
  if (isScriptComponentType(element.type) || isScriptLikeProps(element.props)) return true
  return containsDirectScriptComponent(element.props?.children)
}

function isScriptComponentType(type: unknown): type is { displayName?: string; name?: string } {
  return (
    typeof type === 'function' &&
    (type.name === 'Script' || (type as { displayName?: string }).displayName === 'Script')
  )
}

function isScriptLikeProps(props: Record<string, unknown> | null | undefined): boolean {
  if (!props) return false
  return (
    props.strategy === 'beforeInteractive' &&
    (typeof props.src === 'string' ||
      typeof props.id === 'string' ||
      typeof props.dangerouslySetInnerHTML === 'object')
  )
}

export function runWithScriptNonce<T>(nonce: string | undefined, callback: () => T): T {
  if (!nonce) return callback()
  const stack = getScriptNonceStack()
  stack.push(nonce)
  let popOnReturn = true
  try {
    const result = callback()
    if (isThenable(result)) {
      popOnReturn = false
      return Promise.resolve(result).finally(() => {
        stack.pop()
      }) as T
    }
    return result
  } finally {
    if (popOnReturn) {
      stack.pop()
    }
  }
}

export function useScriptNonce(): string | undefined {
  try {
    const nonce = useTextCompatContext(ScriptNonceContext) ?? readCurrentScriptNonce()
    if (nonce) pushScriptNonceUntilCurrentRenderSettles(nonce)
    return nonce
  } catch {
    return readCurrentScriptNonce()
  }
}

function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}
