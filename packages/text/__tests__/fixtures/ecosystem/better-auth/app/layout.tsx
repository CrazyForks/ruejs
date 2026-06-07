export const metadata = {
  title: 'better-auth test',
}

export default function RootLayout({ children }: { children: unknown }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
