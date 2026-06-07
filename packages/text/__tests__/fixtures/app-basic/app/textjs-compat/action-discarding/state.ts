type ActionDiscardingGlobal = typeof globalThis & {
  __textActionDiscardingState?: {
    value: number
  }
}

const actionDiscardingGlobal: ActionDiscardingGlobal = globalThis
const state = (actionDiscardingGlobal.__textActionDiscardingState ??= { value: 0 })

export function getValue(): number {
  return state.value
}

export function incrementValue(): number {
  state.value += 1
  return state.value
}
