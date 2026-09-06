type BrandedDisplayRef = {
  readonly __rue_ref__: true
  readonly value: unknown
}

const isObjectLike = (value: unknown): value is Record<PropertyKey, unknown> | Function =>
  (typeof value === 'object' && value !== null) || typeof value === 'function'

export const unwrapDisplayRef = (value: unknown): unknown =>
  isObjectLike(value) && Reflect.get(value, '__rue_ref__') === true
    ? (value as BrandedDisplayRef).value
    : value
