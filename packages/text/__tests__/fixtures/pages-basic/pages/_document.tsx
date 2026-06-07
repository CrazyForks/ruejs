import { Html, Head, Main, TextScript } from 'text/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="A text test app" />
      </Head>
      <body className="custom-body">
        <Main />
        <TextScript />
      </body>
    </Html>
  )
}
