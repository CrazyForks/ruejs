type PropsUpdater = (props: unknown) => void

const updaterByProps = new WeakMap<object, PropsUpdater>()
const updaterByHandle = new WeakMap<object, PropsUpdater>()
type RegistrationTarget = [handle: object, props: object | null]
const registrationTargets: RegistrationTarget[] = []

const toObject = (value: unknown): object | null =>
  (typeof value === 'object' || typeof value === 'function') && value !== null ? value : null

const readPropsObject = (handle: object) => toObject((handle as Record<string, unknown>).props)

export const registerAsyncExternalPropsUpdater = (props: unknown, update: PropsUpdater) => {
  const propsObject = toObject(props)
  if (propsObject) updaterByProps.set(propsObject, update)
  const target = registrationTargets[registrationTargets.length - 1]
  if (target) {
    if (target[1]) updaterByProps.set(target[1], update)
    updaterByHandle.set(target[0], update)
  }
}

export const withAsyncExternalPropsRegistrationTarget = <T>(
  handle: unknown,
  callback: () => T,
): T => {
  const handleObject = toObject(handle)
  if (!handleObject) return callback()
  const target: RegistrationTarget = [handleObject, readPropsObject(handleObject)]
  registrationTargets.push(target)
  try {
    return callback()
  } finally {
    const index = registrationTargets.lastIndexOf(target)
    if (index >= 0) registrationTargets.splice(index, 1)
  }
}

export const updateAsyncExternalPropsFromPreviousHandle = (
  previousHandle: unknown,
  nextHandle: unknown,
) => {
  const previousHandleObject = toObject(previousHandle)
  if (!previousHandleObject) return false
  const previousProps = readPropsObject(previousHandleObject)
  const update =
    (previousProps ? updaterByProps.get(previousProps) : undefined) ??
    updaterByHandle.get(previousHandleObject)
  if (!update) return false
  const nextHandleObject = toObject(nextHandle)
  const nextProps = nextHandleObject ? readPropsObject(nextHandleObject) : null
  update(nextProps ?? {})
  if (nextHandleObject) updaterByHandle.set(nextHandleObject, update)
  if (nextProps) updaterByProps.set(nextProps, update)
  return true
}
