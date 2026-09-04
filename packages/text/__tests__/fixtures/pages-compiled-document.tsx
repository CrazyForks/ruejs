import { Head, Html, Main, TextScript } from '../../src/shims/document.js'

export default function CompiledDocument() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="compiled document" />
      </Head>
      <body className="custom-body">
        <Main />
        <TextScript />
      </body>
    </Html>
  )
}
