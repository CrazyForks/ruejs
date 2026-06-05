function hasParamProperty<T extends Record<string, unknown>>(obj: T, prop: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop)
}

// Properties that cannot be shadowed by param names because they need to
// remain the true underlying value for Promises / render runtimes to work correctly.
//
// Text.js comments out `value` and `error` in reflect-utils.ts because they
// use `Promise.resolve(underlyingParams)` directly in production, so runtime
// mutations on the promise object are never shadowed. text uses a Proxy
// that intercepts sync reads through a separate `plain` object, which means
// a param named `value` or `error` would shadow `.status`/`.value`
// attachments that render runtimes add to resolved promises for `use()` caching.
// https://github.com/vercel/next.js/blob/canary/packages/text/src/shared/lib/utils/reflect-utils.ts
const WELL_KNOWN_PROPERTIES = [
  // Object prototype
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toString',
  'valueOf',
  'toLocaleString',

  // Promise prototype
  'then',
  'catch',
  'finally',

  // Promise extension (status is explicitly reserved by Text.js;
  // value/error are reserved here because our Proxy-based approach creates
  // a shadowing risk that native Promise does not have)
  'status',
  'value',
  'error',

  // Runtime introspection
  'displayName',
  '_debugInfo',

  // Common tested properties
  'toJSON',
  '$$typeof',
  '__esModule',

  // Tested by RSC payload decoders when checking for iterables
  '@@iterator',
] as const

// The type-level set of well-known properties is derived directly from the
// runtime array above, so they can never drift out of sync. These properties
// are omitted from the synchronous intersection because the Proxy returns
// Promise/runtime internals for them, not the param value. After awaiting, the
// resolved object contains the actual param values for all keys.
type WellKnownProperty = (typeof WELL_KNOWN_PROPERTIES)[number]

const wellKnownProperties = new Set<PropertyKey>(WELL_KNOWN_PROPERTIES)
const THENABLE_PARAMS_SYMBOL = Symbol.for('text.thenableParams')

function isWellKnownProperty(prop: PropertyKey): boolean {
  return wellKnownProperties.has(prop)
}

export type ThenableParams<T extends Record<string, unknown>> = Promise<T> &
  Omit<T, WellKnownProperty>

export function isThenableParams(value: unknown): value is ThenableParams<Record<string, unknown>> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    Reflect.get(value, THENABLE_PARAMS_SYMBOL) === true
  )
}

export function makeThenableParams<T extends Record<string, unknown>>(obj: T): ThenableParams<T> {
  const plain = { ...obj }
  const promise = Promise.resolve(plain)
  const thenableTarget: Record<PropertyKey, unknown> = {}
  const promiseThenKey = WELL_KNOWN_PROPERTIES[6]

  Object.defineProperties(thenableTarget, {
    [promiseThenKey]: {
      configurable: true,
      enumerable: false,
      value: promise.then.bind(promise),
      writable: false,
    },
    catch: {
      configurable: true,
      enumerable: false,
      value: promise.catch.bind(promise),
      writable: false,
    },
    finally: {
      configurable: true,
      enumerable: false,
      value: promise.finally.bind(promise),
      writable: false,
    },
    [THENABLE_PARAMS_SYMBOL]: {
      configurable: true,
      enumerable: false,
      value: true,
      writable: false,
    },
  })

  // The Proxy implements both thenable and plain-object behaviour so that
  // `await params` and `params.id` both work. It intentionally does not wrap a
  // native Promise object: Rue's server renderer may eagerly unwrap native
  // Promise props before calling Server Components, which would make
  // `typeof params.then` observable as "undefined" inside the component.
  return new Proxy(thenableTarget, {
    get(target, prop, receiver) {
      if (!isWellKnownProperty(prop) && hasParamProperty(plain, prop)) {
        return Reflect.get(plain, prop)
      }

      return Reflect.get(target, prop, receiver)
    },
    getOwnPropertyDescriptor(target, prop) {
      if (!isWellKnownProperty(prop) && hasParamProperty(plain, prop)) {
        return {
          configurable: true,
          enumerable: true,
          value: Reflect.get(plain, prop),
          writable: true,
        }
      }

      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
    has(target, prop) {
      return (
        Reflect.has(target, prop) || (!isWellKnownProperty(prop) && hasParamProperty(plain, prop))
      )
    },
    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, value, receiver)
    },
    ownKeys(target) {
      return Array.from(
        new Set([
          ...Reflect.ownKeys(target),
          ...Reflect.ownKeys(plain).filter(prop => !isWellKnownProperty(prop)),
        ]),
      )
    },
  }) as unknown as ThenableParams<T>
}
