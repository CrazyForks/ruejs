import { createRueBase } from './create-rue-base.js'
import { createCompiledMountController } from './mount-compat.js'
import type { RueRuntime } from './types.js'

/** Create the runtime with only the portable compiled mount-input controller. */
export const createRue = (adapter: unknown, reactiveKernel?: unknown): RueRuntime =>
  createRueBase(adapter, reactiveKernel, createCompiledMountController())

export default createRue
