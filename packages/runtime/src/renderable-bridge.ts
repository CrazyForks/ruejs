import {
  appendChild,
  collectFragmentChildren,
  createComment,
  createDocumentFragment,
  getParentNode,
  insertBefore,
  removeChild,
  setInnerHTML,
} from './dom'
import type { DomElementLike, DomNodeLike } from './dom'
import {
  attachBlockCleanup,
  RUE_CLEANUP_BUCKET_KEY,
  runOwnerCleanupBucket,
} from './renderable-lifecycle'
import type { BlockFactory, BlockInstance, NormalizedRenderable, RenderTarget } from './renderable'

/*
默认 Renderable 桥接层概述
- materializeRenderable 先把 NormalizedRenderable 挂载到临时 Fragment，统一收集最终 DOM 节点。
- mountNormalizedRenderableToTarget 负责清理旧 owner、清空目标区间，再把新节点插入真实目标。
- BlockFactory / BlockInstance 会通过 RenderTarget 协议接入，并把 cleanup 挂到 owner 上。
- markers 是临时桥接锚点，只用于物化阶段，插入真实 DOM 前会被移除。
*/

/** RenderTarget 的 kind 联合类型，便于桥接函数复用目标分支。 */
export type BridgeTargetKind = RenderTarget['kind']

/** 默认 renderable 路径创建的 owner，用于记录本次渲染实际插入的 DOM 节点。 */
export type DirectRenderableOwner = Record<string, unknown> & { nodes: DomNodeLike[] }

const RUE_EFFECT_SCOPE_ID_KEY = '__rue_effect_scope_id'

const assignOwnerMetadata = (
  owner: Record<string, unknown>,
  bridgeOwner: Record<string, unknown>,
) => {
  const cleanupBucket = bridgeOwner[RUE_CLEANUP_BUCKET_KEY]
  if (Array.isArray(cleanupBucket)) {
    owner[RUE_CLEANUP_BUCKET_KEY] = cleanupBucket
  }

  const scopeId = bridgeOwner[RUE_EFFECT_SCOPE_ID_KEY]
  if (typeof scopeId === 'number') {
    owner[RUE_EFFECT_SCOPE_ID_KEY] = scopeId
  }
}

const materializeRenderable = (value: NormalizedRenderable, kind: BridgeTargetKind) => {
  const context = createBridgeTarget(kind)
  mountNormalizedRenderable(value, context.fragment, context.target)
  stripMarkers(context.fragment, context.markers)
  return {
    fragment: context.fragment,
    nodes: [...collectFragmentChildren(context.fragment)],
  }
}

const clearBetween = (parent: DomNodeLike, start: DomNodeLike, end: DomNodeLike) => {
  let current = start.nextSibling

  while (current && current !== end) {
    const next = current.nextSibling ?? null
    removeChild(parent, current)
    current = next
  }
}

const removeTrackedNodes = (nodes: readonly DomNodeLike[]) => {
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const current = nodes[index]
    const next = nodes[index + 1]
    if (!current || !next) {
      continue
    }

    const parent = getParentNode(current)
    if (parent && getParentNode(next) === parent) {
      clearBetween(parent, current, next)
    }
  }

  for (const node of nodes) {
    const parent = getParentNode(node)
    if (parent) {
      removeChild(parent, node)
    }
  }
}

/** 把规范化后的默认渲染值挂载到指定目标，并返回可供下次更新清理的 owner。 */
export const mountNormalizedRenderableToTarget = (
  value: NormalizedRenderable,
  target: RenderTarget,
  prevOwner?: DirectRenderableOwner,
): DirectRenderableOwner => {
  const { fragment, nodes } = materializeRenderable(value, target.kind)

  if (prevOwner) {
    // 先执行旧 owner 的 cleanup，让 block.unmount 仍能访问旧的锚点/父节点。
    // 若先删 DOM，再跑 cleanup，像 RouterView 这样的 block 会因为 start/end 已脱离父节点而空跑。
    runOwnerCleanupBucket(prevOwner)
  }

  switch (target.kind) {
    case 'container':
      setInnerHTML(target.container, '')
      break
    case 'between':
      clearBetween(target.parent, target.start, target.end)
      break
    case 'anchor': {
      const prevNodes = (prevOwner as DirectRenderableOwner | undefined)?.nodes
      if (Array.isArray(prevNodes)) {
        removeTrackedNodes(prevNodes)
      }
      break
    }
    case 'static':
      break
  }

  switch (target.kind) {
    case 'container':
      for (const node of nodes) {
        appendChild(target.container, node)
      }
      break
    case 'between':
      for (const node of nodes) {
        insertBefore(target.parent, node, target.end)
      }
      break
    case 'anchor':
    case 'static':
      for (const node of nodes) {
        insertBefore(target.parent, node, target.anchor)
      }
      break
  }

  if (target.kind === 'static' && getParentNode(target.anchor) === target.parent) {
    removeChild(target.parent, target.anchor)
  }

  const owner: DirectRenderableOwner = { nodes }
  assignOwnerMetadata(owner, fragment as Record<string, unknown>)
  return owner
}

type BridgeContext = {
  fragment: DomElementLike
  markers: DomNodeLike[]
  target: RenderTarget
}

const isBlockInstance = (value: NormalizedRenderable): value is BlockInstance =>
  !!value &&
  typeof value === 'object' &&
  (value as BlockInstance).kind === 'block' &&
  typeof (value as BlockInstance).mount === 'function'

const isBlockFactory = (value: NormalizedRenderable): value is BlockFactory =>
  typeof value === 'function' && (value as BlockFactory).kind === 'block-factory'

const createBridgeTarget = (kind: BridgeTargetKind): BridgeContext => {
  const fragment = createDocumentFragment() as DomElementLike

  switch (kind) {
    case 'container':
      return {
        fragment,
        markers: [],
        target: {
          kind: 'container',
          container: fragment,
        },
      }
    case 'between': {
      const start = createComment('rue:renderable:start')
      const end = createComment('rue:renderable:end')
      appendChild(fragment, start)
      appendChild(fragment, end)
      return {
        fragment,
        markers: [start, end],
        target: {
          kind: 'between',
          parent: fragment,
          start,
          end,
        },
      }
    }
    case 'anchor':
    case 'static': {
      const anchor = createComment('rue:renderable:anchor')
      appendChild(fragment, anchor)
      return {
        fragment,
        markers: [anchor],
        target: {
          kind,
          parent: fragment,
          anchor,
        },
      }
    }
  }
}

const insertIntoTarget = (node: DomNodeLike, target: RenderTarget) => {
  switch (target.kind) {
    case 'container':
      appendChild(target.container, node)
      return
    case 'between':
      insertBefore(target.parent, node, target.end)
      return
    case 'anchor':
    case 'static':
      insertBefore(target.parent, node, target.anchor)
      return
  }
}

const mountNormalizedRenderable = (
  value: NormalizedRenderable,
  owner: DomNodeLike,
  target: RenderTarget,
): void => {
  if (Array.isArray(value)) {
    for (const child of value) {
      mountNormalizedRenderable(child, owner, target)
    }
    return
  }

  if (isBlockFactory(value)) {
    mountNormalizedRenderable(value(), owner, target)
    return
  }

  if (isBlockInstance(value)) {
    value.mount(target)
    attachBlockCleanup(owner, value)
    return
  }

  insertIntoTarget(value as DomNodeLike, target)
}

const stripMarkers = (fragment: DomNodeLike, markers: readonly DomNodeLike[]) => {
  for (const marker of markers) {
    if (getParentNode(marker) === fragment) {
      removeChild(fragment, marker)
    }
  }
}
