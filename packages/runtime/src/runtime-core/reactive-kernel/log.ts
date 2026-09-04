/**
 * Development diagnostics with level, include, and exclude filtering. Host
 * storage is optional and probed defensively; messages are sanitized before
 * console output and context placeholders are expanded without an FFI layer.
 * Every branch is guarded by the build-time development constant so production
 * logging remains removable.
 */

declare const __DEV__: boolean

export type LogLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'critical'
  | 'alert'
  | 'emergency'
  | string

const LOG_CONFIG_SYNC_INTERVAL = 10_024
const NOISY_DEBUG_PREFIXES = [
  'reactive:scope create',
  'reactive:scope push',
  'reactive:scope pop',
  'reactive:effect create',
  'reactive:effect run start',
  'reactive:effect run end',
  'reactive:schedule queued id=',
  'reactive:schedule default_frame id=',
  'reactive:schedule default_microtask id=',
] as const

let enabled = false
let consoleEnabled = true
let minimumLevel = 0
let verboseDebug = false
let includeFilters: string[] = []
let excludeFilters: string[] = []
let storageProbeCount = 0

const levelToNumber = (level: LogLevel): number => {
  switch (level) {
    case 'info':
      return 1
    case 'notice':
      return 2
    case 'warning':
      return 3
    case 'error':
      return 4
    case 'critical':
      return 5
    case 'alert':
      return 6
    case 'emergency':
      return 7
    default:
      return 0
  }
}

const parseBoolean = (value: string): boolean | undefined => {
  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false
    default:
      return undefined
  }
}

const isNodeLocalStorageAccessor = (): boolean => {
  const processValue = Reflect.get(globalThis, 'process') as
    | { versions?: { node?: unknown } }
    | undefined
  if (typeof processValue?.versions?.node !== 'string') return false
  return typeof Object.getOwnPropertyDescriptor(globalThis, 'localStorage')?.get === 'function'
}

const readStorageValue = (key: string): string | undefined => {
  if (isNodeLocalStorageAccessor()) return undefined
  try {
    const storage = Reflect.get(globalThis, 'localStorage') as { getItem?: unknown } | undefined
    if (storage === undefined || typeof storage.getItem !== 'function') return undefined
    const value = Reflect.apply(storage.getItem, storage, [key]) as unknown
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

const splitFilters = (value: string): string[] =>
  value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)

/** Host configuration is sampled, not read on every diagnostic hot path. */
const syncFromStorage = (): void => {
  const current = storageProbeCount
  storageProbeCount = (storageProbeCount + 1) >>> 0
  if (current !== 0 && current % LOG_CONFIG_SYNC_INTERVAL !== 0) return

  const storedEnabled = readStorageValue('rue.logs.enabled')
  if (storedEnabled !== undefined) enabled = parseBoolean(storedEnabled) ?? enabled
  const storedLevel = readStorageValue('rue.logs.level')
  if (storedLevel !== undefined) minimumLevel = levelToNumber(storedLevel.trim().toLowerCase())
  const storedVerbose = readStorageValue('rue.logs.verboseDebug')
  if (storedVerbose !== undefined) verboseDebug = parseBoolean(storedVerbose) ?? verboseDebug
  const storedInclude = readStorageValue('rue.logs.include')
  if (storedInclude !== undefined) includeFilters = splitFilters(storedInclude)
  const storedExclude = readStorageValue('rue.logs.exclude')
  if (storedExclude !== undefined) excludeFilters = splitFilters(storedExclude)
}

const shouldLog = (level: LogLevel, message: string): boolean => {
  if (!__DEV__) return false
  syncFromStorage()
  if (!enabled || levelToNumber(level) < minimumLevel) return false
  const included = includeFilters.some(filter => message.includes(filter))
  if (includeFilters.length > 0 && !included) return false
  if (
    levelToNumber(level) === 0 &&
    !included &&
    NOISY_DEBUG_PREFIXES.some(prefix => message.startsWith(prefix))
  )
    return false
  return !excludeFilters.some(filter => message.includes(filter))
}

const sanitize = (value: string): string =>
  [...value]
    .map(character => {
      const code = character.codePointAt(0) ?? 0
      return code < 32 && character !== '\n' && character !== '\r' && character !== '\t'
        ? ' '
        : character
    })
    .join('')

const write = (level: LogLevel, message: string): void => {
  if (!shouldLog(level, message) || !consoleEnabled) return
  const consoleValue = Reflect.get(globalThis, 'console')
  if (
    (typeof consoleValue !== 'object' || consoleValue === null) &&
    typeof consoleValue !== 'function'
  )
    return
  const logger = Reflect.get(consoleValue, 'log')
  if (typeof logger !== 'function') return
  const entry = sanitize(`${new Date().toISOString()} [${level}] ${message}`)
  Reflect.apply(logger, consoleValue, [entry])
}

export const setLogEnabled = (value: boolean): void => {
  if (__DEV__) enabled = value
}

export const setLogConsole = (value: boolean): void => {
  if (__DEV__) consoleEnabled = value
}

export const setLogLevel = (level: LogLevel): void => {
  if (__DEV__) minimumLevel = levelToNumber(level)
}

export const addLogInclude = (filter: string): void => {
  if (__DEV__) includeFilters.push(filter)
}

export const clearLogInclude = (): void => {
  if (__DEV__) includeFilters = []
}

export const addLogExclude = (filter: string): void => {
  if (__DEV__) excludeFilters.push(filter)
}

export const clearLogExclude = (): void => {
  if (__DEV__) excludeFilters = []
}

export const wantLog = (level: LogLevel, hint: string): boolean => shouldLog(level, hint)
export const log = (level: LogLevel, message: string): void => write(level, message)

export const logWithContext = (level: LogLevel, message: string, context: unknown): void => {
  if (!__DEV__) return
  if (typeof context !== 'object' || context === null) {
    write(level, message)
    return
  }
  let interpolated = message
  for (const key of Object.keys(context)) {
    if (key.length === 0) continue
    const value = Reflect.get(context, key)
    let replacement = ''
    if (typeof value === 'string') replacement = value
    else {
      try {
        replacement = JSON.stringify(value) ?? ''
      } catch {
        replacement = ''
      }
    }
    interpolated = interpolated.split(`{${key}}`).join(replacement)
  }
  write(level, interpolated)
}

export const debug = (message: string): void => write('debug', message)
export const info = (message: string): void => write('info', message)
export const notice = (message: string): void => write('notice', message)
export const warning = (message: string): void => write('warning', message)
export const error = (message: string): void => write('error', message)
export const critical = (message: string): void => write('critical', message)
export const alert = (message: string): void => write('alert', message)
export const emergency = (message: string): void => write('emergency', message)

export const logJs = (label: string, values: readonly unknown[]): void => {
  if (!__DEV__ || !consoleEnabled) return
  const consoleValue = Reflect.get(globalThis, 'console')
  if (
    (typeof consoleValue !== 'object' || consoleValue === null) &&
    typeof consoleValue !== 'function'
  )
    return
  const logger = Reflect.get(consoleValue, 'log')
  if (typeof logger === 'function') Reflect.apply(logger, consoleValue, [label, ...values])
}

export const logJsValue = (label: string, value: unknown): void => logJs(label, [value])
export const logJsLabel = (label: string): void => logJs(label, [])
