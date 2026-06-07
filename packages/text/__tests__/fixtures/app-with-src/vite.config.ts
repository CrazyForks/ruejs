import { defineConfig } from 'vite'
import text from '@rue-js/text'

export default defineConfig({
  plugins: [text({ appDir: `${import.meta.dirname}/src` })],
})
