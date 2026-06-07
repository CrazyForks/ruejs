import { clientRef } from './client-component'

export const contentType = 'image/png'
function cache<T extends (...args: never[]) => unknown>(callback: T): T {
  return callback
}

const cachedNoop = cache(() => null)

function noopCall(value: unknown) {
  return value
}

export default function sitemap() {
  // Keep the variable from being tree-shaken, matching the upstream fixture.
  noopCall(clientRef)
  cachedNoop()
  return []
}
