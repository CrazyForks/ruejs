import { createRueBase } from './create-rue-base.js'
import { createCompatMountController } from './mount-compat.js'
import type { RueRuntime } from './types.js'

/** Create the full runtime, including the hand-written h() Element/Fragment compatibility path. */
export const createRue = (adapter: unknown, reactiveKernel?: unknown): RueRuntime =>
  createRueBase(adapter, reactiveKernel, createCompatMountController())

export default createRue
