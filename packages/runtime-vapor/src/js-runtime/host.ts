import { isObjectLike } from './types.js'
import type { DOMHost, DOMHostAdapter } from './types.js'

type RequiredHostMethodName = Exclude<keyof DOMHostAdapter, 'getParentNode'>

const requiredHostMethods = [
  'createElement',
  'createTextNode',
  'createDocumentFragment',
  'isFragment',
  'collectFragmentChildren',
  'setTextContent',
  'appendChild',
  'insertBefore',
  'removeChild',
  'contains',
  'setClassName',
  'patchStyle',
  'setInnerHTML',
  'setValue',
  'setChecked',
  'setDisabled',
  'clearRef',
  'applyRef',
  'setAttribute',
  'removeAttribute',
  'getTagName',
  'addEventListener',
  'removeEventListener',
  'hasValueProperty',
  'isSelectMultiple',
] as const satisfies readonly RequiredHostMethodName[]

/** Check adapter shape without reading methods, so MountInput-only backends remain lazy. */
export const hasDOMHostAdapter = (adapter: unknown): adapter is DOMHostAdapter =>
  isObjectLike(adapter) && requiredHostMethods.every(name => name in adapter)

const bindRequired = <HostNode, Name extends RequiredHostMethodName>(
  adapter: DOMHostAdapter<HostNode>,
  name: Name,
): DOMHostAdapter<HostNode>[Name] => {
  const method = Reflect.get(adapter, name)
  if (typeof method !== 'function') {
    throw new Error(`Rue runtime: dom-adapter.${name} not found`)
  }
  return ((...args: unknown[]) =>
    Reflect.apply(method, adapter, args)) as DOMHostAdapter<HostNode>[Name]
}

const readParentNode = <HostNode>(node: HostNode): HostNode | null => {
  if (!isObjectLike(node)) return null
  return (Reflect.get(node, 'parentNode') as HostNode | null | undefined) ?? null
}

/** Bind one stable set of operations from the injected host adapter. */
export const createHost = <HostNode = unknown>(adapter: unknown): DOMHost<HostNode> | undefined => {
  if (!hasDOMHostAdapter(adapter)) {
    return undefined
  }

  const bound = Object.fromEntries(
    requiredHostMethods.map(name => [name, bindRequired(adapter, name)]),
  ) as Omit<DOMHostAdapter<HostNode>, 'getParentNode'>

  return {
    ...bound,
    getParentNode: readParentNode,
  }
}
