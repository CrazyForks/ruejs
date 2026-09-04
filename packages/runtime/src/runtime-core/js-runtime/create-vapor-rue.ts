import { createRueBase } from './create-rue-base.js'
import { createMountController } from './mount.js'
import type { RueRuntime } from './types.js'

/** Create the compiled Vapor runtime with the portable compiled mount-input controller. */
export const createVaporRue = (adapter: unknown, reactiveKernel?: unknown): RueRuntime =>
  createRueBase(adapter, reactiveKernel, createMountController())

export default createVaporRue
