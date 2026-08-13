type KeepAlivePropsUpdater = (props: unknown) => void

const updaterByProps = new WeakMap<object, KeepAlivePropsUpdater>()
const updaterByHandle = new WeakMap<object, KeepAlivePropsUpdater>()
type RegistrationTarget = [handle: object, props: object | null]
const registrationTargets: RegistrationTarget[] = []

const toObject = (value: unknown): object | null =>
  (typeof value === 'object' || typeof value === 'function') && value !== null ? value : null

const readPropsObject = (handle: object) => toObject((handle as Record<string, unknown>).props)

const removeRegistrationTarget = (target: RegistrationTarget) => {
  const index = registrationTargets.indexOf(target)
  if (index >= 0) {
    registrationTargets.splice(index, 1)
  }
}

export const registerKeepAlivePropsUpdater = (props: unknown, update: KeepAlivePropsUpdater) => {
  const propsObject = toObject(props)
  if (propsObject) {
    updaterByProps.set(propsObject, update)
  }
  const target = registrationTargets[registrationTargets.length - 1]
  if (target) {
    if (target[1]) {
      updaterByProps.set(target[1], update)
    }
    updaterByHandle.set(target[0], update)
  }
}

export const withKeepAlivePropsRegistrationTarget = <T>(handle: unknown, callback: () => T): T => {
  const nextHandle = toObject(handle)
  if (!nextHandle) {
    return callback()
  }

  const target: RegistrationTarget = [nextHandle, readPropsObject(nextHandle)]
  registrationTargets.push(target)
  let completed = false
  try {
    const result = callback()
    completed = true
    queueMicrotask(() => {
      queueMicrotask(() => removeRegistrationTarget(target))
    })
    return result
  } finally {
    if (!completed) {
      removeRegistrationTarget(target)
    }
  }
}

export const updateKeepAlivePropsFromPreviousHandle = (
  previousHandle: unknown,
  nextHandle: unknown,
) => {
  const previousHandleObject = toObject(previousHandle)
  if (!previousHandleObject) {
    return false
  }

  const previousProps = readPropsObject(previousHandleObject)
  const update =
    (previousProps ? updaterByProps.get(previousProps) : undefined) ??
    updaterByHandle.get(previousHandleObject)
  if (!update) {
    return false
  }

  const nextHandleObject = toObject(nextHandle)
  const nextProps = nextHandleObject ? readPropsObject(nextHandleObject) : null
  update(nextProps ?? {})
  if (nextProps) {
    updaterByProps.set(nextProps, update)
  }
  return true
}
