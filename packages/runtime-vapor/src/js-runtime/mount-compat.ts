import { createMountController, appendMounted } from './mount.js'
import { postPatchElement, patchProps } from './props.js'
import { isObjectLike } from './types.js'
import type {
  DOMHost,
  ElementMountInput,
  FragmentMountInput,
  MountChild,
  MountCompatibilityController,
  MountController,
  Mounted,
  MountedElement,
  MountedFragment,
  RenderRuntimeState,
} from './types.js'

const mountChild = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  child: MountChild<HostNode>,
  parent: HostNode,
  controller: MountController<HostNode>,
): Mounted<HostNode> | undefined => {
  if (child.kind === 'text') {
    const text = host.createTextNode(child.value)
    host.appendChild(parent, text)
    return { kind: 'text', host: text, value: child.value }
  }
  const mounted = controller.mountInput(state, host, child.value, parent)
  appendMounted(host, parent, mounted)
  return mounted
}

const mountChildren = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  input: ElementMountInput<HostNode> | FragmentMountInput<HostNode>,
  parent: HostNode,
  controller: MountController<HostNode>,
): Mounted<HostNode>[] => {
  const mounted: Mounted<HostNode>[] = []
  for (const child of input.children) {
    const childMount = mountChild(state, host, child, parent, controller)
    if (childMount) mounted.push(childMount)
  }
  return mounted
}

const contextualElementProps = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  input: ElementMountInput<HostNode>,
): ElementMountInput<HostNode>['props'] => {
  if (!input.type.tag.includes('-')) return input.props
  const parentInstance = state.components.current()?.host
  if (!parentInstance) return input.props
  return { ...input.props, __rue_context_parent_instance__: parentInstance }
}

const mountedNodes = <HostNode>(mounted: Mounted<HostNode> | undefined): HostNode[] => {
  if (!mounted) return []
  if (mounted.kind === 'fragment' || mounted.fragmentNodes?.length) {
    return mounted.fragmentNodes ?? []
  }
  return mounted.host ? [mounted.host] : []
}

const nextMountedSibling = <HostNode>(mounted: Mounted<HostNode> | undefined): HostNode | null => {
  const nodes = mountedNodes(mounted)
  const last = nodes[nodes.length - 1]
  return isObjectLike(last)
    ? ((Reflect.get(last, 'nextSibling') as HostNode | null | undefined) ?? null)
    : null
}

const insertMountedBefore = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  mounted: Mounted<HostNode> | undefined,
  before: HostNode | null,
): void => {
  for (const node of mountedNodes(mounted)) {
    if (before && host.getParentNode(before) === parent) host.insertBefore(parent, node, before)
    else if (host.getParentNode(node) !== parent) host.appendChild(parent, node)
  }
}

const removeMountedHost = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  mounted: Mounted<HostNode> | undefined,
): void => {
  for (const node of mountedNodes(mounted)) {
    if (host.contains(parent, node)) host.removeChild(parent, node)
  }
}

const disposeMountedChild = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  mounted: Mounted<HostNode> | undefined,
): void => {
  mounted?.dispose?.()
  removeMountedHost(host, parent, mounted)
}

const patchMountChildren = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  mounted: MountedElement<HostNode> | MountedFragment<HostNode>,
  input: ElementMountInput<HostNode> | FragmentMountInput<HostNode>,
  parent: HostNode,
  controller: MountController<HostNode>,
): void => {
  const previous = mounted.children.slice()
  const next: Mounted<HostNode>[] = []
  const length = Math.max(previous.length, input.children.length)
  for (let index = 0; index < length; index += 1) {
    const oldChild = previous[index]
    const child = input.children[index]
    if (!child) {
      disposeMountedChild(host, parent, oldChild)
      continue
    }
    const before = nextMountedSibling(oldChild)
    let nextChild: Mounted<HostNode> | undefined
    if (child.kind === 'text') {
      if (oldChild?.kind === 'text') {
        if (oldChild.value !== child.value) host.setTextContent(oldChild.host, child.value)
        oldChild.value = child.value
        nextChild = oldChild
      } else {
        disposeMountedChild(host, parent, oldChild)
        nextChild = { kind: 'text', host: host.createTextNode(child.value), value: child.value }
      }
    } else {
      nextChild = controller.patchMountedInput(state, host, oldChild, child.value, parent)
    }
    insertMountedBefore(host, parent, nextChild, before)
    if (nextChild) next.push(nextChild)
  }
  mounted.children.splice(0, mounted.children.length, ...next)
}

const compatibility: MountCompatibilityController<unknown> = {
  mountElement(state, host, input, parentContext, controller) {
    const element = host.createElement(input.type.tag, parentContext)
    const props = contextualElementProps(state, input)
    patchProps(host, element, {}, props)
    const children = Object.prototype.hasOwnProperty.call(props, 'dangerouslySetInnerHTML')
      ? []
      : mountChildren(state, host, input, element, controller)
    postPatchElement(host, element, props)
    const mounted: MountedElement<unknown> = {
      kind: 'element',
      host: element,
      tag: input.type.tag,
      key: input.key,
      props,
      children,
      resetHostProps() {
        patchProps(host, element, mounted.props, {})
      },
      dispose() {
        for (const child of mounted.children) child.dispose?.()
      },
    }
    return mounted
  },
  mountFragment(state, host, input, controller) {
    const fragment = host.createDocumentFragment()
    const children = mountChildren(state, host, input, fragment, controller)
    const fragmentNodes = host.collectFragmentChildren(fragment)
    return {
      kind: 'fragment',
      host: fragment,
      fragmentNodes,
      key: input.key,
      props: input.props,
      children,
      dispose() {
        for (const child of children) child.dispose?.()
      },
    }
  },
  patchElement(state, host, mounted, input, controller) {
    const props = contextualElementProps(state, input)
    const usesInnerHTML = Object.prototype.hasOwnProperty.call(props, 'dangerouslySetInnerHTML')
    if (usesInnerHTML) {
      for (const child of mounted.children.splice(0)) child.dispose?.()
    }
    patchProps(host, mounted.host, mounted.props, props)
    if (!usesInnerHTML) patchMountChildren(state, host, mounted, input, mounted.host, controller)
    postPatchElement(host, mounted.host, props)
    mounted.props = props
    mounted.key = input.key
    return mounted
  },
  patchFragment(state, host, mounted, input, parentContext, controller) {
    patchMountChildren(state, host, mounted, input, parentContext, controller)
    mounted.fragmentNodes = mounted.children.flatMap(child => mountedNodes(child))
    mounted.props = input.props
    mounted.key = input.key
    return mounted
  },
}

export const createCompatMountController = <HostNode>(): MountController<HostNode> =>
  createMountController(compatibility as MountCompatibilityController<HostNode>)
