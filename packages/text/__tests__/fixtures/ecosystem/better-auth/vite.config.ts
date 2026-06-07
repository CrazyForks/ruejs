import { defineConfig } from 'vite-plus'
import text from '@rue-js/text'

export default defineConfig({
  plugins: [text()],
  resolve: {
    alias: [
      {
        find: 'better-auth/text-js',
        replacement: 'better-auth/' + 'ne' + 'xt-js',
      },
    ],
  },
  ssr: {
    // Native addon packages must be externalized — bindings uses stack trace
    // introspection that breaks when Vite transforms it (mirrors Text.js serverExternalPackages).
    // text sets `noExternal: true` globally, so only explicit externals need listing here.
    external: ['better-sqlite3'],
  },
})
