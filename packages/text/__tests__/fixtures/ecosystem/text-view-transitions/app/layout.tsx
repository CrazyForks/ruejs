export const metadata = {
  title: 'text-view-transitions test',
}

export default function RootLayout({ children }: { children: unknown }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
        {children}
      </body>
    </html>
  )
}
