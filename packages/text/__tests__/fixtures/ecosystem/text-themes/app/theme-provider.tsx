type ThemeProviderProps = {
  children?: unknown
  attribute?: string
  defaultTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'system',
  enableSystem = false,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const script = `
    try {
      var stored = localStorage.getItem('theme');
      var preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var theme = stored || ${JSON.stringify(defaultTheme)};
      var resolved = theme === 'system' && ${JSON.stringify(enableSystem)} ? preferred : theme;
      document.documentElement.setAttribute(${JSON.stringify(attribute)}, resolved);
      if (${JSON.stringify(disableTransitionOnChange)}) document.documentElement.dataset.themeTransition = 'disabled';
    } catch (_) {}
  `

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      {children}
    </>
  )
}
