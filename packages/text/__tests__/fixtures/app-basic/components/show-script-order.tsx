'use client'

import { useState } from '@rue-js/rue'

export function ShowScriptOrder(): import('@rue-js/rue').RenderableOutput {
  const [order, setOrder] = useState<number[] | null>(null)

  return (
    <>
      <p id="order">{JSON.stringify(order)}</p>
      <button
        id="get-order"
        onClick={() => {
          setOrder([
            ...(((window as typeof window & { _script_order?: number[] })._script_order ??
              []) as number[]),
          ])
        }}
      >
        get order
      </button>
    </>
  )
}
