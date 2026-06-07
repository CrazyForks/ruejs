declare module 'private-text-instrumentation-client' {
  // NOTE: This declaration is intentionally explicit for autocomplete.
  // When Text.js adds new hooks to the instrumentation-client API, add them here.
  export function onRouterTransitionStart(
    href: string,
    navigationType: 'push' | 'replace' | 'traverse',
  ): void
}
