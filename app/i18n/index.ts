import { createI18n, type LocaleMessageDictionary } from '@rue-js/i18n'
import rawEn from './en.json'
import rawZhCN from './zh-CN.json'

const DEFAULT_LOCALE = 'zh-CN'
const supportedLocales = ['zh-CN', 'en'] as const

const normalizeLocaleMessages = (
  value: LocaleMessageDictionary | { default: LocaleMessageDictionary },
): LocaleMessageDictionary => {
  const defaultValue = (value as { default?: LocaleMessageDictionary }).default

  if (
    value &&
    typeof value === 'object' &&
    'default' in value &&
    Object.keys(value).length === 1 &&
    defaultValue &&
    typeof defaultValue === 'object'
  ) {
    return defaultValue
  }

  return value as LocaleMessageDictionary
}

const zhCN = normalizeLocaleMessages(
  rawZhCN as LocaleMessageDictionary | { default: LocaleMessageDictionary },
)
const en = normalizeLocaleMessages(
  rawEn as LocaleMessageDictionary | { default: LocaleMessageDictionary },
)

export type SupportedLocale = (typeof supportedLocales)[number]

export const resolveLocale = (value: string | null | undefined): SupportedLocale => {
  if (value && supportedLocales.includes(value as SupportedLocale)) {
    return value as SupportedLocale
  }

  return DEFAULT_LOCALE
}

const getInitialLocale = (): SupportedLocale => {
  return DEFAULT_LOCALE
}

const i18n = createI18n({
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCN,
    en,
  },
})

export { DEFAULT_LOCALE, supportedLocales }
export default i18n
