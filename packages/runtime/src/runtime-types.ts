import type { PortableHandle } from '@rue-js/runtime-vapor/protocol'
import type { DomNodeLike } from './dom'
import type { Renderable } from './renderable'

/** JSX/组件 props 的通用结构，允许任意属性和 children。 */
export interface ComponentProps {
  /** 组件或元素属性。 */
  [key: string]: any
  /** JSX 子节点。 */
  children?: ChildInput
}

/** Wasm/runtime-vapor 返回的可挂载句柄集合。 */
export type RueMountHandle = PortableHandle

/** 默认 runtime 可接受的顶层渲染输入。 */
export type RenderableInput = Renderable | RueMountHandle | ReadonlyArray<RenderableInput>

/** 组件和 JSX 工厂可返回的渲染输出。 */
export type RenderableOutput = Renderable | RueMountHandle | ReadonlyArray<RenderableOutput>

/** @deprecated Prefer RenderableOutput. */
export type RenderOutput = RenderableOutput

/** Vapor setup 返回的 DOM 节点。 */
export type VaporSetupResult = DomNodeLike

export type Child = RenderableOutput
export type ChildInput = Child | ReadonlyArray<ChildInput>

/** 给组件 props 自动附加 children 字段。 */
export type PropsWithChildren<P = {}> = P & { children?: ChildInput }

/** Rue 函数组件类型。 */
export type FC<P = {}> = (props: PropsWithChildren<P>) => RenderableOutput

/** 组件实例类型，当前等价于函数组件。 */
export type ComponentInstance<P = {}> = FC<P>

/** Rue runtime 实例类型；底层由 Wasm 工厂返回，暂以 any 兼容。 */
export type Rue = any

export type OwnedMountProtocol = {
  buildOwnedMount(): unknown
  commitMounted(token: unknown, deferMounted?: boolean): boolean
  flushMounted(token: unknown): boolean
  updateOwnedMount(token: unknown): boolean
  disposeOwnedMount(token: unknown): boolean
  abortOwnedMount(token: unknown): boolean
}

export type OwnedMountContinuation = {
  /** 返回 false 表示 owner generation 已失效，调用方不得回退到全局提交。 */
  run(run: () => void): boolean
}
