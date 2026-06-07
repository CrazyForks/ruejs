import { ThemeProvider } from './theme-provider'

export const metadata = {
  title: 'text-themes test',
}

export default function RootLayout({ children }: { children: unknown }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
