// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { customElement } from '../index.mjs'

describe('customElement build helper', () => {
  it('creates a Vite library config for Rue custom elements', () => {
    const config = customElement({
      entry: 'src/elements.ts',
      name: 'DemoElements',
      externalRue: true,
      rue: { include: ['/src/'] },
      vite: {
        build: {
          outDir: 'dist/elements',
        },
      },
    })

    expect(config.plugins?.[0]).toMatchObject({ name: '@rue-js/vite-plugin-rue' })
    expect(config.build?.target).toBe('es2020')
    expect(config.build?.cssCodeSplit).toBe(false)
    expect(config.build?.outDir).toBe('dist/elements')
    expect(config.build?.lib).toMatchObject({
      entry: 'src/elements.ts',
      name: 'DemoElements',
      fileName: 'rue-custom-elements',
      formats: ['es'],
    })
    expect(config.build?.rollupOptions?.external).toEqual(
      expect.arrayContaining(['@rue-js/rue', '@rue-js/runtime']),
    )
    expect(config.build?.rollupOptions?.output).toMatchObject({
      globals: {
        '@rue-js/rue': 'Rue',
      },
    })
  })

  it('requires an entry', () => {
    expect(() => customElement({} as any)).toThrow(/entry/)
  })

  it('merges user plugins, externals, output globals, and library overrides', () => {
    const existingExternal = (source: string) => source === 'already-external'
    const fileName = (format: string, entryName: string) => `${entryName}.${format}.js`
    const config = customElement({
      entry: { dashboard: 'src/dashboard.ts', widget: 'src/widget.ts' },
      fileName,
      formats: ['es', 'iife'],
      externalRue: true,
      vite: {
        plugins: [{ name: 'existing-a' }, [false, { name: 'existing-b' }]],
        build: {
          target: 'es2022',
          cssCodeSplit: true,
          lib: {
            name: 'UserOverride',
          },
          rollupOptions: {
            external: existingExternal,
            output: [
              {
                globals: {
                  '@rue-js/rue': 'CustomRue',
                  lodash: '_',
                },
              },
              {
                globals: {
                  react: 'React',
                },
              },
            ],
          },
        },
      },
    })

    expect(config.plugins?.map(plugin => plugin && 'name' in plugin && plugin.name)).toEqual([
      '@rue-js/vite-plugin-rue',
      'existing-a',
      'existing-b',
    ])
    expect(config.build?.target).toBe('es2022')
    expect(config.build?.cssCodeSplit).toBe(true)
    expect(config.build?.lib).toMatchObject({
      entry: { dashboard: 'src/dashboard.ts', widget: 'src/widget.ts' },
      name: 'UserOverride',
      fileName,
      formats: ['es', 'iife'],
    })

    const external = config.build?.rollupOptions?.external as (
      source: string,
      importer?: string,
      isResolved?: boolean,
    ) => boolean
    expect(external('@rue-js/rue')).toBe(true)
    expect(external('@rue-js/runtime-vapor/reactive')).toBe(true)
    expect(external('already-external')).toBe(true)
    expect(external('local-module')).toBe(false)

    const output = config.build?.rollupOptions?.output as Array<Record<string, unknown>>
    expect(Array.isArray(output)).toBe(true)
    expect(output[0]).toMatchObject({
      globals: {
        '@rue-js/rue': 'CustomRue',
        '@rue-js/runtime': 'RueRuntime',
        lodash: '_',
      },
    })
    expect(output[1]).toMatchObject({
      globals: {
        '@rue-js/rue': 'Rue',
        react: 'React',
      },
    })
  })

  it('leaves rollup externals alone when Rue is bundled', () => {
    const config = customElement({
      entry: 'src/elements.ts',
      externalRue: false,
      vite: {
        build: {
          rollupOptions: {
            external: ['peer-only'],
            output: {
              globals: {
                'peer-only': 'PeerOnly',
              },
            },
          },
        },
      },
    })

    expect(config.build?.rollupOptions?.external).toEqual(['peer-only'])
    expect(config.build?.rollupOptions?.output).toEqual({
      globals: {
        'peer-only': 'PeerOnly',
      },
    })
  })
})
