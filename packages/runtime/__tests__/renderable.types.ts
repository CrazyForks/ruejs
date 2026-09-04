import type { RenderInput, RenderOutput } from '../src/runtime-types'
import type { DomNodeLike } from '../src/dom'
import type { CompiledRootHandle } from '../src/compiled-root'

declare const node: DomNodeLike
declare const root: CompiledRootHandle

const input: RenderInput = ['text', 1, false, null, undefined, node, root]
const output: RenderOutput = input

void input
void output
