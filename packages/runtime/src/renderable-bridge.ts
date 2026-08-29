import {
  appendChild,
  createComment,
  createDocumentFragment,
  getParentNode,
  insertBefore,
  removeChild,
} from './dom'
import type { DomElementLike, DomNodeLike } from './dom'
import { attachBlockCleanup, runOwnerCleanupBucket } from './renderable-lifecycle'
import type { BlockFactory, BlockInstance, NormalizedRenderable, RenderTarget } from './renderable'

/*
Renderable 物化桥接层概述
- materializeNormalizedRenderable 把 NormalizedRenderable 挂载到独立 Fragment。
- 真实目标的插入、替换和卸载全部交给 canonical backend。
- BlockFactory / BlockInstance 会通过 RenderTarget 协议接入，并把 cleanup 挂到 owner 上。
- markers 是临时桥接锚点，只用于物化阶段，插入真实 DOM 前会被移除。
*/

/** RenderTarget 的 kind 联合类型，便于桥接函数复用目标分支。 */
export type BridgeTargetKind = RenderTarget['kind']

export const materializeNormalizedRenderable = (
  value: NormalizedRenderable,
  kind: BridgeTargetKind,
): DomElementLike => {
  const context = createBridgeTarget(kind)
  try {
    mountNormalizedRenderable(value, context.fragment, context.target)
    stripMarkers(context.fragment, context.markers)
    return context.fragment
  } catch (error) {
    try {
      runOwnerCleanupBucket(context.fragment)
    } catch {}
    throw error
  }
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
