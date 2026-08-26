import type {
  ObjectLike,
  RuntimeAssertActive,
  RuntimeEmitter,
  RuntimePluginController,
} from './types.js'

type PluginInstall = (app: undefined, options: unknown[]) => unknown

const objectLike = (value: unknown): value is ObjectLike =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const readInstall = (plugin: unknown): PluginInstall | undefined => {
  if (!objectLike(plugin)) return undefined
  try {
    const install = Reflect.get(plugin, 'install')
    return typeof install === 'function' ? install : undefined
  } catch {
    return undefined
  }
}

const eventHandlerNames = (event: unknown): [string, string] => {
  const name = typeof event === 'string' ? event : ''
  const camel = `on${name
    .split(/[-_ ]/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')}`
  return [camel, `on${name.toLowerCase()}`]
}

const snapshotProps = (props: unknown): Record<string, unknown> => {
  if (!objectLike(props)) return {}
  const snapshot: Record<string, unknown> = Object.create(null)
  for (const key of Object.keys(props)) {
    try {
      snapshot[key] = Reflect.get(props, key)
    } catch {
      snapshot[key] = undefined
    }
  }
  return snapshot
}

/** Owns deferred plugin installation for one JavaScript Runtime instance. */
export const createPluginController = (
  assertActive: RuntimeAssertActive,
): RuntimePluginController => {
  let pending: Array<{ plugin: unknown; options: unknown[] }> = []

  return {
    clear() {
      pending = []
    },
    flush() {
      const installing = pending
      pending = []
      for (const { plugin, options } of installing) {
        const install = readInstall(plugin)
        if (!install) continue
        try {
          Reflect.apply(install, plugin, [undefined, options])
        } catch {
          // Plugin installation is a best-effort deferred task.
        }
      }
    },
    use(plugin, options) {
      assertActive()
      pending.push({ plugin, options: Array.isArray(options) ? Array.from(options) : [] })
      return undefined
    },
  }
}

/** Create a stable props snapshot emitter for component helpers. */
export const createEmitter = (
  props: unknown,
  assertActive: RuntimeAssertActive,
): RuntimeEmitter => {
  assertActive()
  const snapshot = snapshotProps(props)
  return (event, args) => {
    const callArgs = Array.isArray(args) ? args : []
    for (const name of eventHandlerNames(event)) {
      const handler = snapshot[name]
      if (typeof handler !== 'function') continue
      try {
        Reflect.apply(handler, undefined, callArgs)
      } catch {
        // Handler failures do not cross this low-level emitter boundary.
      }
    }
    return undefined
  }
}
