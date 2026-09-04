export type AppRouterRenderPhase = 'rsc' | 'ssr' | null

const APP_ROUTER_RENDER_PHASE_READER = Symbol.for('text.appRouterRenderPhase.reader')

type AppRouterRenderPhaseGlobal = typeof globalThis & {
  [APP_ROUTER_RENDER_PHASE_READER]?: () => AppRouterRenderPhase
}

export function installAppRouterRenderPhaseReader(reader: () => AppRouterRenderPhase): void {
  ;(globalThis as AppRouterRenderPhaseGlobal)[APP_ROUTER_RENDER_PHASE_READER] = reader
}

export function readAppRouterRenderPhase(): AppRouterRenderPhase {
  return (globalThis as AppRouterRenderPhaseGlobal)[APP_ROUTER_RENDER_PHASE_READER]?.() ?? null
}
