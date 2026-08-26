import {
  CLEANUP_BUCKET_KEY,
  DEFAULT_MOUNT_HANDLE_KEY,
  EFFECT_SCOPE_ID_KEY,
  KEEP_ALIVE_HOOK_TARGET_KEY,
  PORTABLE_COMPONENT_ID_KEY,
  PORTABLE_COMPONENT_TYPE_KEY,
  PORTABLE_HANDLE_KEYS,
  PORTABLE_VAPOR_SETUP_KEY,
  REPEATABLE_MOUNT_FACTORY_KEY,
  isObjectLike,
} from './types.js'
import type {
  ComponentProps,
  ComponentType,
  EffectScopeId,
  KernelBridge,
  MountChild,
  MountInput,
  MountInputType,
  MountKey,
  ObjectLike,
  PortableHandle,
  PortableMountHandle,
  RuntimeEntry,
  RuntimeState,
  VaporSetup,
} from './types.js'

const entryErrors: Record<RuntimeEntry, string> = {
  render: 'Rue runtime: render input not supported on the default path',
  renderAnchor: 'Rue runtime: renderAnchor input not supported on the default path',
  renderBetween: 'Rue runtime: renderBetween input not supported on the default path',
  renderStatic: 'Rue runtime: renderStatic input not supported on the default path',
}

const protocolError = (entry: RuntimeEntry, detail?: string): TypeError => {
  const prefix = entryErrors[entry] ?? `Rue runtime: ${entry} input not supported`
  return new TypeError(detail ? `${prefix}: ${detail}` : prefix)
}

const hasOwnOrInherited = (value: object, key: PropertyKey): boolean => {
  try {
    return Reflect.has(value, key)
  } catch {
    return false
  }
}

const read = (value: object, key: PropertyKey): unknown => {
  try {
    return Reflect.get(value, key)
  } catch {
    return undefined
  }
}

const copyProps = (value: unknown): ComponentProps => {
  if (!isObjectLike(value) || Array.isArray(value)) {
    return {}
  }
  const props: ComponentProps = {}
  for (const key of Object.keys(value)) {
    props[key] = read(value, key)
  }
  return props
}

const normalizeKey = (value: unknown): MountKey | undefined => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

const normalizeScopeId = (value: unknown): EffectScopeId | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined

interface MountMetadata {
  key: MountKey | undefined
  mountCleanupBucket: unknown[] | undefined
  mountEffectScopeId: EffectScopeId | undefined
}

const extractMetadata = (source: unknown, props: ComponentProps): MountMetadata => {
  const sourceCleanup = isObjectLike(source) ? read(source, CLEANUP_BUCKET_KEY) : undefined
  const propsCleanup = read(props, CLEANUP_BUCKET_KEY)
  const sourceScope = isObjectLike(source) ? read(source, EFFECT_SCOPE_ID_KEY) : undefined
  const propsScope = read(props, EFFECT_SCOPE_ID_KEY)
  const sourceKey = isObjectLike(source) ? normalizeKey(read(source, 'key')) : undefined
  const propsKey = normalizeKey(read(props, 'key'))

  delete props[CLEANUP_BUCKET_KEY]
  delete props[EFFECT_SCOPE_ID_KEY]

  return {
    key: sourceKey ?? propsKey,
    mountCleanupBucket: Array.isArray(sourceCleanup)
      ? sourceCleanup
      : Array.isArray(propsCleanup)
        ? propsCleanup
        : undefined,
    mountEffectScopeId: normalizeScopeId(sourceScope) ?? normalizeScopeId(propsScope),
  }
}

const copyPortableKeys = (source: object): PortableHandle => {
  const portable: PortableHandle = {}
  for (const key of PORTABLE_HANDLE_KEYS) {
    if (hasOwnOrInherited(source, key)) {
      portable[key] = read(source, key)
    }
  }
  return portable
}

interface CreateInputOptions<HostNode> {
  type: MountInputType<HostNode>
  props?: unknown
  children?: MountChild<HostNode>[]
  source?: object
  strictComponentReturns?: boolean
  mountEffectScopeId?: EffectScopeId
}

const createInput = <HostNode>({
  type,
  props = {},
  children = [],
  source,
  strictComponentReturns = false,
  mountEffectScopeId,
}: CreateInputOptions<HostNode>): MountInput<HostNode> => {
  const normalizedProps = copyProps(props)
  const metadata = extractMetadata(source, normalizedProps)
  return {
    type,
    props: normalizedProps,
    children,
    key: metadata.key,
    strictComponentReturns,
    mountCleanupBucket: metadata.mountCleanupBucket,
    mountEffectScopeId: mountEffectScopeId ?? metadata.mountEffectScopeId,
    elHint: undefined,
    ...(source ? { portable: copyPortableKeys(source) } : {}),
  } as MountInput<HostNode>
}

const normalizeChildren = <HostNode>(
  state: RuntimeState<HostNode>,
  value: unknown,
): MountChild<HostNode>[] => {
  const children: MountChild<HostNode>[] = []
  const push = (child: unknown): void => {
    if (Array.isArray(child)) {
      child.forEach(push)
      return
    }
    if (typeof child === 'string' || typeof child === 'number') {
      children.push({ kind: 'text', value: String(child) })
      return
    }
    if (isObjectLike(child)) {
      const input = normalizeMountInput(state, child, 'render')
      if (input) children.push({ kind: 'input', value: input })
    }
  }
  push(value)
  return children
}

const effectiveChildren = (props: ComponentProps, children: unknown): unknown => {
  if (Array.isArray(children)) {
    return children.length === 0 ? (props.children ?? children) : children
  }
  return children == null ? (props.children ?? children) : children
}

export const createElementMountInput = (
  state: RuntimeState,
  typeTag: unknown,
  propsValue: unknown,
  childrenValue: unknown,
  options: { strictComponentReturns?: boolean } = {},
): MountInput => {
  const props = copyProps(propsValue)
  if (Array.isArray(childrenValue)) {
    props.children = childrenValue
  } else if (childrenValue != null) {
    props.children = [childrenValue]
  }
  const children = normalizeChildren(state, effectiveChildren(props, childrenValue))
  let type: MountInputType
  if (typeof typeTag === 'function') {
    type = { kind: 'component', component: typeTag as ComponentType }
  } else if (typeTag === 'fragment') {
    type = { kind: 'fragment' }
  } else if (typeTag === 'vapor') {
    const setup = typeof props.setup === 'function' ? (props.setup as VaporSetup) : undefined
    type = setup ? { kind: 'vapor', setup } : { kind: 'vapor' }
  } else {
    type = { kind: 'element', tag: typeof typeTag === 'string' ? typeTag : 'div' }
  }
  return createInput({
    type,
    props,
    children,
    strictComponentReturns: options.strictComponentReturns === true,
  })
}

export const createVaporMountInput = (setup: unknown, kernel: KernelBridge): MountInput => {
  const hasSetup = typeof setup === 'function'
  return createInput({
    type: hasSetup ? { kind: 'vapor', setup: setup as VaporSetup } : { kind: 'vapor' },
    mountEffectScopeId: hasSetup ? kernel.createEffectScope() : undefined,
  })
}

export const storeMountInput = (state: RuntimeState, input: MountInput): PortableMountHandle => {
  const id = state.nextMountInputId++
  state.mountInputs.set(id, input)
  const handle: PortableMountHandle = { [DEFAULT_MOUNT_HANDLE_KEY]: id }
  if (input.key !== undefined) {
    handle.key = input.key
  }
  return handle
}

const mountHandleId = (value: unknown): number | undefined => {
  const candidate = isObjectLike(value) ? read(value, DEFAULT_MOUNT_HANDLE_KEY) : value
  const number =
    typeof candidate === 'string' && candidate.trim() !== '' ? Number(candidate) : candidate
  return typeof number === 'number' && Number.isSafeInteger(number) && number >= 0
    ? number
    : undefined
}

const takeTaggedMountInput = <HostNode>(
  state: RuntimeState<HostNode>,
  value: unknown,
  entry: RuntimeEntry,
): MountInput<HostNode> => {
  const id = mountHandleId(value)
  if (id === undefined) {
    throw protocolError(entry, 'invalid mount handle id')
  }
  if (!state.mountInputs.has(id)) {
    throw protocolError(entry, `stale or unknown mount handle ${id}`)
  }
  const input = state.mountInputs.get(id)
  state.mountInputs.delete(id)
  if (!input) {
    throw protocolError(entry, `stale or unknown mount handle ${id}`)
  }

  if (isObjectLike(value)) {
    const metadataProps = {
      key: read(value, 'key'),
      [CLEANUP_BUCKET_KEY]: read(value, CLEANUP_BUCKET_KEY),
      [EFFECT_SCOPE_ID_KEY]: read(value, EFFECT_SCOPE_ID_KEY),
    }
    const metadata = extractMetadata(value, metadataProps)
    if (metadata.key !== undefined) input.key = metadata.key
    if (hasOwnOrInherited(value, CLEANUP_BUCKET_KEY) && metadata.mountCleanupBucket !== undefined) {
      input.mountCleanupBucket = metadata.mountCleanupBucket
    }
    if (hasOwnOrInherited(value, EFFECT_SCOPE_ID_KEY)) {
      input.mountEffectScopeId = metadata.mountEffectScopeId
    }
  }
  return input
}

const portableComponentInput = <HostNode>(
  source: ObjectLike,
  entry: RuntimeEntry,
): MountInput<HostNode> => {
  const component = read(source, PORTABLE_COMPONENT_TYPE_KEY)
  if (typeof component !== 'function') {
    throw protocolError(entry, `${PORTABLE_COMPONENT_TYPE_KEY} must be a function`)
  }
  return createInput<HostNode>({
    type: { kind: 'component', component: component as ComponentType },
    props: read(source, 'props'),
    source,
  })
}

const portableVaporInput = <HostNode>(source: ObjectLike): MountInput<HostNode> => {
  const setup = read(source, PORTABLE_VAPOR_SETUP_KEY)
  return createInput<HostNode>({
    type:
      typeof setup === 'function'
        ? { kind: 'vapor', setup: setup as VaporSetup<HostNode> }
        : { kind: 'vapor' },
    source,
  })
}

const normalizeMountInputValue = <HostNode>(
  state: RuntimeState<HostNode>,
  value: unknown,
  entry: RuntimeEntry,
  allowRepeatableReplay: boolean,
): MountInput<HostNode> | null => {
  if (value == null) {
    return null
  }

  if (isObjectLike(value) && !Array.isArray(value)) {
    if (hasOwnOrInherited(value, DEFAULT_MOUNT_HANDLE_KEY)) {
      const id = mountHandleId(value)
      if (allowRepeatableReplay && id !== undefined && !state.mountInputs.has(id)) {
        const replayFactory = read(value, REPEATABLE_MOUNT_FACTORY_KEY)
        if (typeof replayFactory === 'function') {
          // default handle 仍是一次性令牌；只有显式声明为 repeatable 的结果在令牌
          // 已消费后才重新生产输入。工厂结果本轮不再递归 replay，避免错误工厂自循环。
          const replayed = Reflect.apply(replayFactory, undefined, [])
          return normalizeMountInputValue(state, replayed, entry, false)
        }
      }
      return takeTaggedMountInput(state, value, entry)
    }
    if (hasOwnOrInherited(value, PORTABLE_COMPONENT_TYPE_KEY)) {
      return portableComponentInput(value, entry)
    }
    if (hasOwnOrInherited(value, PORTABLE_VAPOR_SETUP_KEY)) {
      return portableVaporInput(value)
    }
    throw protocolError(entry)
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return takeTaggedMountInput(state, value, entry)
  }

  throw protocolError(entry)
}

export const normalizeMountInput = <HostNode>(
  state: RuntimeState<HostNode>,
  value: unknown,
  entry: RuntimeEntry = 'render',
): MountInput<HostNode> | null => normalizeMountInputValue(state, value, entry, true)

export const portableProtocolKeys = {
  cleanup: CLEANUP_BUCKET_KEY,
  component: PORTABLE_COMPONENT_TYPE_KEY,
  componentId: PORTABLE_COMPONENT_ID_KEY,
  effectScope: EFFECT_SCOPE_ID_KEY,
  keepAlive: KEEP_ALIVE_HOOK_TARGET_KEY,
  repeatable: REPEATABLE_MOUNT_FACTORY_KEY,
  vapor: PORTABLE_VAPOR_SETUP_KEY,
} as const
