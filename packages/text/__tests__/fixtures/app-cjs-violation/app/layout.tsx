export default function RootLayout({ children }: { children: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>CJS Violation Fixture</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
