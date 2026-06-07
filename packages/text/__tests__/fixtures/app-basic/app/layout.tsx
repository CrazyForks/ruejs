import type { Metadata } from 'text'

export const metadata: Metadata = {
  title: 'App Basic',
}

export default function RootLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
