import type { FC, PropsWithChildren } from '../rue'
import type { BaseTransitionProps } from './BaseTransition'
import { TransitionGroup as compiledTransitionGroup } from '../compiler-runtime/builtins'

export type TransitionGroupProps = PropsWithChildren<
  BaseTransitionProps & {
    tag?: string
    moveClass?: string
  }
>

/** Compiler-recognized keyed-range transition coordinator. */
export const TransitionGroup = compiledTransitionGroup as unknown as FC<TransitionGroupProps>
