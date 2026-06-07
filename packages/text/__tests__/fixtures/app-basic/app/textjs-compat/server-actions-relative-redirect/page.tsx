'use client'

import { absoluteRedirect, relativeRedirect } from './actions'

function startTransition(callback: () => void | Promise<void>): void {
  void Promise.resolve().then(callback)
}

export default function Page() {
  return (
    <>
      <p>hello root page</p>
      <button
        onClick={() => {
          startTransition(async () => {
            await relativeRedirect()
          })
        }}
        id="relative-redirect"
      >
        relative redirect
      </button>
      <button
        onClick={() => {
          startTransition(async () => {
            await absoluteRedirect()
          })
        }}
        id="absolute-redirect"
      >
        absolute redirect
      </button>
    </>
  )
}
