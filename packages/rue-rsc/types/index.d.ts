declare global {
  interface ImportMeta {
    readonly viteRsc: {
      loadCss: (importer?: string) => import('rue').RueNode
      loadModule: <T>(environmentName: string, entryName?: string) => Promise<T>
      loadBootstrapScriptContent: (entryName: string) => Promise<string>
      /**
       * Import a module from another environment using a module specifier.
       *
       * A more ergonomic alternative to `loadModule` that takes a relative path
       * instead of an entry name, so the specifier matches what you'd use in
       * `typeof import(...)` type annotations.
       *
       * @example
       * ```ts
       * const ssr = await import.meta.viteRsc.import<typeof import('./entry.ssr')>(
       *   './entry.ssr',
       *   { environment: 'ssr' }
       * );
       * ```
       *
       * @param specifier - Relative path to the module (e.g., './entry.ssr')
       * @param options - Options object with `environment` specifying the target environment
       * @returns Promise resolving to the module exports
       */
      import: <T>(specifier: string, options: { environment: string }) => Promise<T>
    }
  }

  interface ImportMetaEnv {
    readonly __vite_rsc_build__: boolean
  }
}

declare module 'vite' {
  interface UserConfig {
    /** Options for `@rue-js/rsc` */
    rsc?: import('@rue-js/rsc').RscPluginOptions
  }
}

declare module 'virtual:rue-rsc/assets-manifest' {
  const assetsManifest: import('@rue-js/rsc/plugin').ResolvedAssetsManifest
  export default assetsManifest
}

declare module 'virtual:rue-rsc/client-references' {
  const default_: Record<string, () => Promise<unknown>>
  export default default_
  export const assetDeps: Record<string, import('@rue-js/rsc/plugin').AssetDeps> | undefined
}

declare module 'virtual:rue-rsc/server-references' {
  const default_: Record<string, () => Promise<unknown>>
  export default default_
}

declare module 'virtual:rue-rsc/encryption-key' {
  const default_: () => string | Promise<string>
  export default default_
}

declare module 'virtual:vite-rsc/assets-manifest' {
  const assetsManifest: import('@rue-js/rsc/plugin').ResolvedAssetsManifest
  export default assetsManifest
}

declare module 'virtual:vite-rsc/client-references' {
  const default_: Record<string, () => Promise<unknown>>
  export default default_
  export const assetDeps: Record<string, import('@rue-js/rsc/plugin').AssetDeps> | undefined
}

declare module 'virtual:vite-rsc/server-references' {
  const default_: Record<string, () => Promise<unknown>>
  export default default_
}

declare module 'virtual:vite-rsc/encryption-key' {
  const default_: () => string | Promise<string>
  export default default_
}

export {}
