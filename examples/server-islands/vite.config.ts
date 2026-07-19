import { defineConfig } from 'vite'
import {
  createRueExampleAliases,
  createRueExampleDefine,
  createRueExamplePlugins,
} from '../shared/rue-vite.mjs'

export default defineConfig({
  plugins: createRueExamplePlugins(),
  resolve: {
    conditions: ['development', 'node'],
    alias: createRueExampleAliases(),
  },
  define: createRueExampleDefine({ dev: true, ssr: true }),
})
