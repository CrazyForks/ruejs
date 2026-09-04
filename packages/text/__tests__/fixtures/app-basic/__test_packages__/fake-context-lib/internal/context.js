'use client'

import { createContext, useContext } from '@rue-js/rue'
import { _$createDynamic } from '@rue-js/rue/internal'

const ThemeContext = createContext(null)

export function ThemeProvider({ theme, children }) {
  return _$createDynamic(ThemeContext.Provider, { value: theme, children })
}

export function useTheme() {
  const theme = useContext(ThemeContext)
  return theme
}
