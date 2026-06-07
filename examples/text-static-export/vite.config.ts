import { defineConfig } from 'vite'
import text from '@rue-js/text'
import VitePluginRue from '@rue-js/vite-plugin-rue'

export default defineConfig({
  plugins: [VitePluginRue(), text({ appDir: import.meta.dirname, rue: false })],
})
