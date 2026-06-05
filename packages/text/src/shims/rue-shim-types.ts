export type RueRenderable = unknown

export type RueStyle = Record<string, string | number | null | undefined>

export type RueRef<T> =
  | ((instance: T | null) => void | (() => void))
  | { current: T | null }
  | null
  | undefined

export type RueEvent<T extends EventTarget, TEvent extends Event = Event> = TEvent & {
  currentTarget: T
}

export type RueMouseEvent<T extends EventTarget> = RueEvent<T, globalThis.MouseEvent>
export type RueTouchEvent<T extends EventTarget> = RueEvent<T, globalThis.TouchEvent>
export type RueSubmitEvent<T extends EventTarget> = RueEvent<T, SubmitEvent>

export type RueEventHandler<T extends EventTarget, TEvent extends Event = Event> = (
  event: RueEvent<T, TEvent>,
) => void

export type RueElementProps<T extends EventTarget = EventTarget> = {
  children?: RueRenderable
  className?: string
  id?: string
  style?: RueStyle
  ref?: RueRef<T>
  [key: string]: unknown
}

export function assignRueRef<T>(ref: RueRef<T>, value: T | null): void {
  if (!ref) return
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  ref.current = value
}
