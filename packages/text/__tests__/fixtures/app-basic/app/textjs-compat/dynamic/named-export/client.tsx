'use client'

export function Button({ id, children }: { id?: string; children: unknown }) {
  return <button id={id}>{children}</button>
}
