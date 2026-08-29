import { createRueBase } from './create-rue-base.js'
import { createCoreMountController } from './mount.js'
import type { RueRuntime } from './types.js'

/** Create the compiled Vapor runtime without the hand-written h() compatibility renderer. */
export const createVaporRue = (adapter: unknown, reactiveKernel?: unknown): RueRuntime =>
  createRueBase(adapter, reactiveKernel, createCoreMountController())

export default createVaporRue
