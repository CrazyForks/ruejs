/**
 * Text.js compat: Slow static page (tests parallel data fetching)
 * Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-rendering/app/static-only/slow/page.js
 *
 * NOTE: Delay reduced from 5s to 1s to keep text tests fast.
 */
export const revalidate = false

async function getData() {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return {
    message: 'hello from slow page',
  }
}

export default async function SlowStaticPage() {
  const data = await getData()
  return (
    <>
      <p id="slow-page-message">{data.message}</p>
    </>
  )
}
