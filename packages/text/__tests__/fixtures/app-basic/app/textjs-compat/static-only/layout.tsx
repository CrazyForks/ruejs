/**
 * Text.js compat: Static-only layout with async data
 * Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-rendering/app/static-only/layout.js
 */
async function getData() {
  return {
    message: 'hello from layout',
  }
}

export default async function StaticLayout(props: { children: unknown }) {
  const data = await getData()

  return (
    <>
      <h1 id="layout-message">{data.message}</h1>
      {props.children}
    </>
  )
}
