export const DEFAULT_THEME = 'luxury'

export const themes = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
] as const

export type SiteTheme = (typeof themes)[number]

export const resolveTheme = (value: string | null | undefined): SiteTheme => {
  if (value && themes.includes(value as SiteTheme)) {
    return value as SiteTheme
  }

  return DEFAULT_THEME
}

const canUseBrowserStorage = () => {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

export const readStoredTheme = () => {
  if (!canUseBrowserStorage()) {
    return DEFAULT_THEME
  }

  try {
    return resolveTheme(window.localStorage.getItem('rue.theme'))
  } catch {
    return DEFAULT_THEME
  }
}

export const applyBrowserTheme = (nextTheme: string) => {
  if (!canUseBrowserStorage()) {
    return
  }

  const theme = resolveTheme(nextTheme)

  try {
    window.localStorage.setItem('rue.theme', theme)
  } catch {}

  document.documentElement.setAttribute('data-theme', theme)
}
