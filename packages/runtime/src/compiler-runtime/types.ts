import type { CompiledOwner } from '../reactive-core'

export interface CompiledTarget {
  parent: ParentNode
  before: Node | null
  batch?: true
}

export interface CompiledBlock {
  readonly first: Node
  readonly last: Node
  readonly owner: CompiledOwner
  dispose(): void
}

export type CompiledGetterProps<Props extends object> = {
  readonly [Key in keyof Props]: () => Props[Key]
}

export type CompiledComponent<Props extends object = Record<string, never>> = (
  target: CompiledTarget,
  props: CompiledGetterProps<Props>,
  owner: CompiledOwner,
) => CompiledBlock

export interface CompiledRange {
  readonly first: Node
  readonly last: Node
}
