type KeepAlivePropsUpdater = (props: unknown) => void

const updaterByProps = new WeakMap<object, KeepAlivePropsUpdater>()
const updaterByHandle = new WeakMap<object, KeepAlivePropsUpdater>()
const registrationTargets: Array<{
  handle: object | null
  props: object | null
}> = []

const toObject = (value: unknown): object | null =>
  (typeof value === 'object' || typeof value === 'function') && value !== null ? value : null

const readPropsObject = (handle: unknown): object | null => {
  const record = toObject(handle) as Record<string, unknown> | null
  return record ? toObject(record.props) : null
}

export const registerKeepAlivePropsUpdater = (props: unknown, update: KeepAlivePropsUpdater) => {
  const propsObject = toObject(props)
  if (propsObject) {
    updaterByProps.set(propsObject, update)
  }
  const target = registrationTargets[registrationTargets.length - 1]
  if (target) {
    if (target.props) {
      updaterByProps.set(target.props, update)
    }
    if (target.handle) {
      updaterByHandle.set(target.handle, update)
    }
  }
}

export const withKeepAlivePropsRegistrationTarget = <T>(handle: unknown, callback: () => T): T => {
  const nextTarget = readPropsObject(handle)
  const nextHandle = toObject(handle)
  if (!nextTarget && !nextHandle) {
    return callback()
  }

  const target = {
    handle: nextHandle,
    props: nextTarget,
  }
  registrationTargets.push(target)
  let completed = false
  try {
    const result = callback()
    completed = true
    const restore = () => {
      const index = registrationTargets.indexOf(target)
      if (index >= 0) {
        registrationTargets.splice(index, 1)
      }
    }
    queueMicrotask(() => {
      queueMicrotask(restore)
    })
    return result
  } finally {
    if (!completed) {
      const index = registrationTargets.indexOf(target)
      if (index >= 0) {
        registrationTargets.splice(index, 1)
      }
    }
  }
}

export const updateKeepAlivePropsFromPreviousHandle = (
  previousHandle: unknown,
  nextHandle: unknown,
) => {
  const previousProps = readPropsObject(previousHandle)
  if (!previousProps) {
    return false
  }

  const previousHandleObject = toObject(previousHandle)
  const update =
    updaterByProps.get(previousProps) ??
    (previousHandleObject ? updaterByHandle.get(previousHandleObject) : undefined)
  if (!update) {
    return false
  }

  const nextProps = readPropsObject(nextHandle)
  update(nextProps ?? {})
  if (nextProps) {
    updaterByProps.set(nextProps, update)
  }
  return true
}
