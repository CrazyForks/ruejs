/**
 * Text.js compat: global-error/basic — server component that always throws
 * Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/global-error/basic/app/rsc/page.js
 */
export default function Page() {
  throw new Error('server page error')
}
