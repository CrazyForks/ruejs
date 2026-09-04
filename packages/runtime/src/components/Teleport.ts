import type { FC } from '../rue'
import { Teleport as compiledTeleport } from '../compiler-runtime/builtins'

/** Public Teleport props; the compiler lowers children to a CompiledSlotFactory. */
export interface TeleportProps {
  to?: string | HTMLElement
  disabled?: boolean
  defer?: boolean
  children?: unknown
}

/** Compiler-recognized builtin. Runtime execution is provided by the closed block ABI. */
export const Teleport = compiledTeleport as unknown as FC<TeleportProps>
