export type AppSsrThenableReader = <T>(thenable: PromiseLike<T>) => T

type ThenableRecord<T> =
  | { status: 'pending'; value: PromiseLike<T> }
  | { status: 'fulfilled'; value: T }
  | { reason: unknown; status: 'rejected' }

const thenableRecords = new WeakMap<PromiseLike<unknown>, ThenableRecord<unknown>>()

export const appSsrThenableReader: AppSsrThenableReader = <T>(thenable: PromiseLike<T>): T => {
  const existing = thenableRecords.get(thenable as PromiseLike<unknown>) as
    | ThenableRecord<T>
    | undefined
  if (existing) {
    if (existing.status === 'fulfilled') return existing.value
    if (existing.status === 'rejected') throw existing.reason
    throw existing.value
  }

  const record: ThenableRecord<T> = {
    status: 'pending',
    value: thenable,
  }
  thenableRecords.set(thenable as PromiseLike<unknown>, record as ThenableRecord<unknown>)

  Promise.resolve(thenable).then(
    value => {
      thenableRecords.set(
        thenable as PromiseLike<unknown>,
        {
          status: 'fulfilled',
          value,
        } as ThenableRecord<unknown>,
      )
    },
    reason => {
      thenableRecords.set(thenable as PromiseLike<unknown>, {
        reason,
        status: 'rejected',
      })
    },
  )

  throw thenable
}

export const defaultAppSsrThenableReader = appSsrThenableReader

export function readAppSsrThenableValue<T>(thenable: PromiseLike<T>): T {
  return defaultAppSsrThenableReader(thenable)
}
