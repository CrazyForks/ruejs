export type AppRscPluginRuntime = {
  loadBootstrapScriptContent: (entry: string) => Promise<string | undefined>
  loadModule: <T>(environment: 'rsc' | 'ssr', entry: string) => Promise<T>
}

export function readAppRscPluginRuntime(meta: ImportMeta): AppRscPluginRuntime {
  const runtime = (meta as ImportMeta & { viteRsc?: AppRscPluginRuntime }).viteRsc
  if (!runtime) {
    throw new Error('[text] App Router RSC plugin runtime is unavailable.')
  }
  return runtime
}
