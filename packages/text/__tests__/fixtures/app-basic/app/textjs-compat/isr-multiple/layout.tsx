/**
 * Text.js compat: ISR layout with Date.now() for revalidation testing
 * Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-rendering/app/isr-multiple/layout.js
 */
async function getData() {
  return {
    message: 'hello from layout',
    now: Date.now(),
  }
}

export default async function IsrLayout(props: { children: unknown }) {
  const data = await getData()

  return (
    <>
      <h1 id="layout-message">{data.message}</h1>
      <p id="layout-now">{data.now}</p>
      {props.children}
    </>
  )
}
