/**
 * Text.js compat: SSR-only layout with async data
 * Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-rendering/app/ssr-only/layout.js
 */
export const revalidate = 0

async function getData() {
  return {
    message: 'hello from layout',
  }
}

export default async function SsrLayout(props: { children: unknown }) {
  const data = await getData()

  return (
    <>
      <h1 id="layout-message">{data.message}</h1>
      {props.children}
    </>
  )
}
