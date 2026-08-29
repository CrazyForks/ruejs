import { RUE_EFFECT_SCOPE_ID_KEY } from '../protocol.js'
import { isSameComponent, mountComponent, patchComponent } from './patch/component.js'
import { dropRenderEntriesWithin } from './render/helpers.js'
import { isObjectLike } from './types.js'
import type {
  DOMHost,
  EffectScopeId,
  ElementMountInput,
  FragmentMountInput,
  MountCleanupBucket,
  MountCompatibilityController,
  MountController,
  MountInput,
  Mounted,
  MountedText,
  MountedVapor,
  RenderRuntimeState,
  TextMountInput,
  VaporMountInput,
} from './types.js'

const isComponentMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is import('./types.js').ComponentMountInput<HostNode> => input.type.kind === 'component'

const isElementMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is ElementMountInput<HostNode> => input.type.kind === 'element'

const isFragmentMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is FragmentMountInput<HostNode> => input.type.kind === 'fragment'

const isVaporMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is VaporMountInput<HostNode> => input.type.kind === 'vapor'

const isTextMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is TextMountInput<HostNode> => input.type.kind === 'text'

const invalidMountInput = (input: { type: { kind: string } }): never => {
  throw new TypeError(`Invalid mount input discriminant: ${String(input.type.kind)}`)
}

const compatibilityEntryError = (): never => {
  throw new TypeError(
    'Rue runtime: Element and Fragment inputs require the full runtime-vapor entry',
  )
}

const isMountableVaporHost = (value: unknown): boolean => {
  if (!isObjectLike(value)) return value == null
  const nodeType = Reflect.get(value, 'nodeType')
  return [1, 3, 11].includes(nodeType as number) || typeof Reflect.get(value, 'tag') === 'string'
}

const invokeCleanupBucket = (bucket: MountCleanupBucket | undefined): void => {
  if (!Array.isArray(bucket)) return
  for (const cleanup of bucket.splice(0)) {
    if (typeof cleanup !== 'function') continue
    try {
      cleanup()
    } catch {}
  }
}

const disposeVaporResources = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  cleanupBucket: MountCleanupBucket | undefined,
  scopeId: EffectScopeId | undefined,
): void => {
  invokeCleanupBucket(cleanupBucket)
  if (scopeId === undefined) return
  state.kernel.disposeEffectScope(scopeId)
  state.effectScopeIds.delete(scopeId)
}

interface VaporSetupResult<HostNode> {
  host: HostNode | null | undefined
  scopeId: EffectScopeId | undefined
}

const runVaporSetup = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  input: VaporMountInput<HostNode>,
  parentContext: HostNode,
): VaporSetupResult<HostNode> | undefined => {
  const setup = input.type.setup
  if (typeof setup !== 'function') return undefined

  const scopeId = input.mountEffectScopeId ?? state.kernel.createEffectScope()
  if (scopeId !== undefined) state.effectScopeIds.add(scopeId)
  const reactive = state.kernel.reactive
  if (scopeId !== undefined) reactive.__ruePushEffectScope?.(scopeId)
  try {
    return { host: setup(parentContext), scopeId }
  } catch (error) {
    disposeVaporResources(state, input.mountCleanupBucket, scopeId)
    throw error
  } finally {
    if (scopeId !== undefined) reactive.__ruePopEffectScope?.()
  }
}

const mountVapor = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  input: VaporMountInput<HostNode>,
  parentContext: HostNode,
): MountedVapor<HostNode> => {
  const result = runVaporSetup(state, input, parentContext)
  const effectScopeId = result?.scopeId ?? input.mountEffectScopeId
  const vaporHost = result?.host ?? input.elHint
  const cleanupBucket = input.mountCleanupBucket

  if (!isMountableVaporHost(vaporHost)) {
    disposeVaporResources(state, cleanupBucket, effectScopeId)
    throw new TypeError('Unsupported object returns are no longer accepted for vapor setup')
  }

  if (isObjectLike(vaporHost) && effectScopeId !== undefined) {
    try {
      Object.defineProperty(vaporHost, RUE_EFFECT_SCOPE_ID_KEY, {
        configurable: true,
        value: effectScopeId,
      })
    } catch {}
  }

  const fragmentNodes =
    vaporHost && host.isFragment(vaporHost) ? host.collectFragmentChildren(vaporHost) : []
  const renderEntryRoots = fragmentNodes.length > 0 ? fragmentNodes : vaporHost ? [vaporHost] : []
  let disposed = false
  return {
    kind: 'vapor',
    host: vaporHost,
    fragmentNodes,
    props: input.props,
    cleanupBucket,
    effectScopeId,
    key: input.key,
    dispose() {
      if (disposed) return
      disposed = true
      for (const root of renderEntryRoots) dropRenderEntriesWithin(state, root)
      disposeVaporResources(state, cleanupBucket, effectScopeId)
    },
  }
}

const removeMountedHost = <HostNode>(
  host: DOMHost<HostNode>,
  mounted: Mounted<HostNode> | undefined,
  parent: HostNode,
): void => {
  const nodes =
    mounted?.kind === 'fragment' || mounted?.fragmentNodes?.length
      ? mounted.fragmentNodes
      : [mounted?.host]
  for (const node of nodes ?? []) {
    if (node && host.contains(parent, node)) host.removeChild(parent, node)
  }
}

const resetDirectCompatibleHostProps = <HostNode>(mounted: Mounted<HostNode> | undefined): void => {
  if (mounted?.kind === 'element') {
    mounted.resetHostProps()
    return
  }
  if (mounted?.kind === 'fragment') {
    for (const child of mounted.children) resetDirectCompatibleHostProps(child)
  }
}

export const appendMounted = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  mounted: Mounted<HostNode> | undefined,
): void => {
  if (!mounted?.host) return
  if (mounted.kind === 'fragment' || mounted.fragmentNodes?.length) {
    for (const child of mounted.fragmentNodes ?? host.collectFragmentChildren(mounted.host)) {
      host.appendChild(parent, child)
    }
  } else {
    host.appendChild(parent, mounted.host)
  }
}

export const createMountController = <HostNode>(
  compatibility?: MountCompatibilityController<HostNode>,
): MountController<HostNode> => {
  let controller: MountController<HostNode>
  let componentTreeController: MountController<HostNode>

  const patchMountedInput = (
    preserveCompatibleTree: boolean,
    state: RenderRuntimeState<HostNode>,
    host: DOMHost<HostNode>,
    mounted: Mounted<HostNode> | undefined,
    input: MountInput<HostNode> | null,
    parentContext: HostNode,
  ): Mounted<HostNode> | undefined => {
    if (input && isComponentMountInput(input) && isSameComponent(mounted, input)) {
      return patchComponent(state, mounted, input, next =>
        patchMountedInput(true, state, host, mounted.subtree, next, parentContext),
      )
    }
    if (
      preserveCompatibleTree &&
      compatibility &&
      input &&
      isElementMountInput(input) &&
      mounted?.kind === 'element' &&
      mounted.tag === input.type.tag &&
      mounted.key === input.key
    ) {
      return compatibility.patchElement(state, host, mounted, input, componentTreeController)
    }
    if (
      preserveCompatibleTree &&
      compatibility &&
      input &&
      isFragmentMountInput(input) &&
      mounted?.kind === 'fragment' &&
      mounted.key === input.key
    ) {
      return compatibility.patchFragment(
        state,
        host,
        mounted,
        input,
        parentContext,
        componentTreeController,
      )
    }
    if (!preserveCompatibleTree) resetDirectCompatibleHostProps(mounted)
    mounted?.dispose?.()
    removeMountedHost(host, mounted, parentContext)
    return controller.mountInput(state, host, input, parentContext)
  }

  controller = {
    mountInput(state, host, input, parentContext) {
      if (!input) return undefined
      switch (input.type.kind) {
        case 'component':
          if (!isComponentMountInput(input)) return invalidMountInput(input)
          return mountComponent(
            state,
            host,
            input,
            parentContext,
            controller.mountInput,
            (mounted, next, currentParent) =>
              patchMountedInput(true, state, host, mounted, next, currentParent),
          )
        case 'element':
          if (!isElementMountInput(input)) return invalidMountInput(input)
          return compatibility
            ? compatibility.mountElement(state, host, input, parentContext, controller)
            : compatibilityEntryError()
        case 'fragment':
          if (!isFragmentMountInput(input)) return invalidMountInput(input)
          return compatibility
            ? compatibility.mountFragment(state, host, input, controller)
            : compatibilityEntryError()
        case 'vapor':
          if (!isVaporMountInput(input)) return invalidMountInput(input)
          return mountVapor(state, host, input, parentContext)
        case 'text': {
          if (!isTextMountInput(input)) return invalidMountInput(input)
          const text = host.createTextNode(input.type.value)
          return {
            kind: 'text',
            host: text,
            value: input.type.value,
          } satisfies MountedText<HostNode>
        }
      }
    },
    patchMountedInput(state, host, mounted, input, parentContext) {
      return patchMountedInput(false, state, host, mounted, input, parentContext)
    },
  }
  componentTreeController = {
    mountInput: (...args) => controller.mountInput(...args),
    patchMountedInput: (state, host, mounted, input, parentContext) =>
      patchMountedInput(true, state, host, mounted, input, parentContext),
  }
  return controller
}

export const createCoreMountController = <HostNode>(): MountController<HostNode> =>
  createMountController()
