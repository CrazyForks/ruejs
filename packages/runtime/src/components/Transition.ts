import type { FC, PropsWithChildren } from '../rue'
import type { BaseTransitionProps } from './BaseTransition'
import { Transition as compiledTransition } from '../compiler-runtime/builtins'

export type TransitionMode = 'default' | 'out-in' | 'in-out'
export type TransitionProps = PropsWithChildren<BaseTransitionProps & { mode?: TransitionMode }>

/** Compiler-recognized single-range transition state machine. */
export const Transition = compiledTransition as unknown as FC<TransitionProps>
