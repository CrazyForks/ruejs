import Script from 'text/script'
import { ShowScriptOrder } from '../components/show-script-order'

// Ported from Text.js: test/e2e/app-dir/app/pages/pages-script-manual-nonce.js
// https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app/pages/pages-script-manual-nonce.js
export default function Page(): import('@rue-js/rue').RenderableOutput {
  return (
    <>
      <p>script-nonce</p>
      <Script strategy="afterInteractive" src="/test1.js" nonce="hello-world" />
      <Script strategy="beforeInteractive" src="/test2.js" nonce="hello-world" />
      <Script strategy="beforeInteractive" id="3" nonce="hello-world" />
      <ShowScriptOrder />
    </>
  )
}
