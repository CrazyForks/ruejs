import type { DomElementLike, DomNodeLike } from './dom'

/*
Renderable 类型模型概述
- RenderTarget 描述运行时可写入 DOM 的四种位置：整容器、双锚点区间、尾锚点和静态锚点。
- BlockInstance / BlockFactory 是框架层适配为 mount handle 的块协议，用于 RouterView、native events 等 DOM 子树。
- NormalizedRenderable 是完成规范化后的安全渲染值，只包含 DOM 节点、块或嵌套数组。
- Renderable 是用户侧和组件侧可返回的默认渲染值，会由 normalizeRenderable 转成 NormalizedRenderable。
*/

/** 默认渲染桥的目标位置。 */
export type RenderTarget =
  | {
      /** 清空并填充整个容器。 */
      kind: 'container'
      /** 目标容器节点。 */
      container: DomElementLike
    }
  | {
      /** 只替换 start/end 两个锚点之间的内容。 */
      kind: 'between'
      /** start/end 所在父节点。 */
      parent: DomElementLike
      /** 区间起始锚点，渲染时会保留。 */
      start: DomNodeLike
      /** 区间结束锚点，新的节点会插入到它之前。 */
      end: DomNodeLike
    }
  | {
      /** 在单个尾锚点之前渲染，可重复更新。 */
      kind: 'anchor'
      /** anchor 所在父节点。 */
      parent: DomElementLike
      /** 尾锚点，新的节点会插入到它之前。 */
      anchor: DomNodeLike
    }
  | {
      /** 在临时锚点前执行静态渲染，完成后会移除锚点。 */
      kind: 'static'
      /** anchor 所在父节点。 */
      parent: DomElementLike
      /** 一次性静态渲染锚点。 */
      anchor: DomNodeLike
    }

/** 可直接挂载到 RenderTarget 的块实例。 */
export interface BlockInstance {
  /** 固定协议标记，用于区分普通函数和块实例。 */
  readonly kind: 'block'
  /** 将块内容挂载到指定目标。 */
  mount(target: RenderTarget): void
  /** 与块绑定的清理回调集合，会在替换或卸载时执行。 */
  cleanupBucket?: Array<() => void>
  /** 可选卸载钩子，通常用于释放事件监听或外部资源。 */
  unmount?(): void
}

/** 延迟创建 BlockInstance 的工厂函数。 */
export interface BlockFactory {
  /** 创建新的块实例；每次挂载都应返回独立实例。 */
  (): BlockInstance
  /** 固定协议标记，用于 normalizeRenderable 识别。 */
  readonly kind: 'block-factory'
}

/** 规范化后的默认渲染值，只保留运行时能安全处理的形态。 */
export type NormalizedRenderable =
  | DomNodeLike
  | BlockFactory
  | BlockInstance
  | ReadonlyArray<NormalizedRenderable>

/** normalizeRenderable 的判别式返回值。 */
export type NormalizeRenderableResult =
  | {
      /** 输入已经成功转换为可渲染值。 */
      kind: 'renderable'
      /** 可直接交给 renderable bridge 挂载的值。 */
      value: NormalizedRenderable
    }
  | {
      /** 输入是默认运行时不再接受的对象形态。 */
      kind: 'unsupported-object'
      /** 原始输入值，供调用方决定是否抛错或走兼容路径。 */
      value: unknown
    }

/** 组件、块和手写 render 可返回的默认渲染值集合。 */
export type Renderable =
  | string
  | number
  | boolean
  | null
  | undefined
  | DomNodeLike
  | BlockFactory
  | BlockInstance
  | ReadonlyArray<Renderable>
