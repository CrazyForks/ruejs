// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import vitePluginRsc from '../plugin'

describe('rsc plugin config', () => {
  it('scans use-client directives before JSX transforms without moving proxy transforms early', () => {
    const plugins = vitePluginRsc()
    const scanPlugin = plugins.find(plugin => plugin.name === 'rsc:use-client/scan-directive')
    const useClientPlugin = plugins.find(plugin => plugin.name === 'rsc:use-client')
    const scanIndex = plugins.findIndex(plugin => plugin.name === 'rsc:use-client/scan-directive')
    const useClientIndex = plugins.findIndex(plugin => plugin.name === 'rsc:use-client')

    expect(scanPlugin?.enforce).toBe('pre')
    expect(useClientPlugin?.enforce).toBeUndefined()
    expect(scanIndex).toBeGreaterThanOrEqual(0)
    expect(useClientIndex).toBeGreaterThan(scanIndex)
  })

  it('uses standalone Rue JSX runtime optimizer includes', async () => {
    const plugins = vitePluginRsc()
    const configPlugin = plugins.find(plugin => plugin.name === 'rsc')
    const config = await configPlugin?.config?.({}, { command: 'serve', mode: 'development' })

    const ssrInclude = (config as any).environments?.ssr?.optimizeDeps?.include ?? []
    const rscInclude = (config as any).environments?.rsc?.optimizeDeps?.include ?? []

    for (const include of [ssrInclude, rscInclude]) {
      expect(include).toContain('@rue-js/jsx-runtime')
      expect(include).toContain('@rue-js/jsx-dev-runtime')
      expect(include).not.toContain('@rue-js/rue/jsx-runtime')
      expect(include).not.toContain('@rue-js/rue/jsx-dev-runtime')
    }
  })
})
