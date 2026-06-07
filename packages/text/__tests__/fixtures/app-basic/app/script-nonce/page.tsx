import Script from 'text/script'
import { ShowScriptOrder } from '../../components/show-script-order'

// Ported from Text.js: test/e2e/app-dir/app/app/script-nonce/page.js
// https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app/app/script-nonce/page.js
export default function Page(): import('@rue-js/rue').RenderableOutput {
  return (
    <>
      <p>script-nonce</p>
      <Script strategy="afterInteractive" src="/test1.js" />
      <Script strategy="beforeInteractive" src="/test2.js" />
      <Script strategy="beforeInteractive" id="3" />
      <ShowScriptOrder />
    </>
  )
}
