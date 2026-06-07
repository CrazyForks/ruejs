import { defineConfig } from 'vite'
import text from '@rue-js/text'
import VitePluginRue from '@rue-js/vite-plugin-rue'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  plugins: [
    wasm(),
    VitePluginRue({
      transformTimeoutMs: 60000,
    }),
    text({ appDir: import.meta.dirname, rue: false }),
  ],
})
