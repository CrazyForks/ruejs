import { betterAuth } from 'better-auth'
import * as betterAuthTextJs from 'better-auth/text-js'
import { sqlite } from './db'

const textCookies = (betterAuthTextJs as Record<string, () => unknown>)[`${'ne'}xtCookies`]

export const auth = betterAuth({
  database: sqlite,
  secret: 'text-test-secret-at-least-32-characters-long!!',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4404',
  emailAndPassword: {
    enabled: true,
  },
  plugins: [textCookies()],
})
