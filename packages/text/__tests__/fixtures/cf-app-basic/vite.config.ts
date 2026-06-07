import { defineConfig } from 'vite'
import text from '@rue-js/text'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [
    text(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
})
