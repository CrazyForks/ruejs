import { ThemeProvider } from 'fake-context-lib'

export default function ContextDedupLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return <ThemeProvider theme="dark-test-theme">{children}</ThemeProvider>
}
