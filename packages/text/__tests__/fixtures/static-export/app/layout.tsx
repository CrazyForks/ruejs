import type { Metadata } from 'text'

export const metadata: Metadata = {
  title: 'Static Export Fixture',
}

export default function RootLayout({ children }: { children: unknown }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
