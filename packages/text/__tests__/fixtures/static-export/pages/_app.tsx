import type { AppProps } from 'text/app'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
