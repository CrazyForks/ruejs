import localFont from 'text/font/local'

const testFont = localFont({
  src: './font.woff2',
})

// Ported from Text.js: test/e2e/app-dir/app/app/script-nonce/with-text-font/page.js
// https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app/app/script-nonce/with-text-font/page.js
export default function Page(): import('@rue-js/rue').RenderableOutput {
  return (
    <p id="script-nonce-font" className={testFont.className}>
      script-nonce
    </p>
  )
}
