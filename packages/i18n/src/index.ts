import { createContext, h, ref, useRef, useContext, useSetup, type FC } from '@rue-js/rue'

type Awaitable<T> = T | Promise<T>

export type Locale = string
export type FallbackLocale = Locale | Locale[] | false
export type NamedInterpolationValues = Record<string, unknown>
export type ListInterpolationValues = readonly unknown[]
export type InterpolationValues = NamedInterpolationValues | ListInterpolationValues
export type MessageContext = {
  locale: Locale
  message: string
  values?: InterpolationValues
  named: (name: string) => unknown
  list: (index: number) => unknown
}
export type MessageFunction = (context: MessageContext) => unknown
export type LocaleMessagePrimitive = string | number | boolean | null | undefined
export type LocaleMessageValue = LocaleMessagePrimitive | MessageFunction
export type LocaleMessageDictionary = Record<string, LocaleMessageValue>
export type LocaleMessages = Record<Locale, LocaleMessageDictionary>
export type DateTimeFormatSchema = Record<string, Intl.DateTimeFormatOptions>
export type NumberFormatSchema = Record<string, Intl.NumberFormatOptions>
export type DateTimeFormats = Record<Locale, DateTimeFormatSchema>
export type NumberFormats = Record<Locale, NumberFormatSchema>
export type MissingHandler = (locale: Locale, message: string) => string | void
export type LocaleMessageLoaderResult =
  | LocaleMessageDictionary
  | { default: LocaleMessageDictionary }
export type LocaleMessageLoader = (locale: Locale) => Awaitable<LocaleMessageLoaderResult>
export type LocaleMessageLoaders =
  | LocaleMessageLoader
  | Partial<Record<string, LocaleMessageLoader>>
export type LocaleMessageLoadOptions = {
  force?: boolean
  merge?: boolean
}
export type WritableValueSignal<T> = { value: T }
export type ReadonlyValueSignal<T> = { readonly value: T }

export type ComposerOptions = {
  locale?: Locale
  fallbackLocale?: FallbackLocale
  messages?: LocaleMessages
  datetimeFormats?: DateTimeFormats
  numberFormats?: NumberFormats
  messageLoader?: LocaleMessageLoaders
  missing?: MissingHandler
  missingWarn?: boolean
  fallbackWarn?: boolean
}

export type UseI18nOptions = ComposerOptions & {
  i18n?: I18n
  useScope?: 'global' | 'local'
}

export type I18nProviderProps = ComposerOptions & {
  i18n?: I18n
  composer?: Composer
  children?: unknown
}

export type Composer = {
  locale: WritableValueSignal<Locale>
  fallbackLocale: WritableValueSignal<FallbackLocale>
  messages: WritableValueSignal<LocaleMessages>
  datetimeFormats: WritableValueSignal<DateTimeFormats>
  numberFormats: WritableValueSignal<NumberFormats>
  availableLocales: ReadonlyValueSignal<Locale[]>
  loadingLocales: ReadonlyValueSignal<Locale[]>
  _: (message: string, values?: InterpolationValues, locale?: Locale) => string
  d: (
    value: Date | number | string,
    format?: string | Intl.DateTimeFormatOptions,
    locale?: Locale,
  ) => string
  n: (value: number, format?: string | Intl.NumberFormatOptions, locale?: Locale) => string
  isLocaleLoading: (locale: Locale) => boolean
  loadLocaleMessages: (
    locale: Locale,
    options?: LocaleMessageLoadOptions,
  ) => Promise<LocaleMessageDictionary>
  setLocale: (locale: Locale) => void
  getLocaleMessage: (locale: Locale) => LocaleMessageDictionary
  setLocaleMessage: (locale: Locale, message: LocaleMessageDictionary) => void
  mergeLocaleMessage: (locale: Locale, message: LocaleMessageDictionary) => void
  getDateTimeFormat: (locale: Locale) => DateTimeFormatSchema
  setDateTimeFormat: (locale: Locale, format: DateTimeFormatSchema) => void
  mergeDateTimeFormat: (locale: Locale, format: DateTimeFormatSchema) => void
  getNumberFormat: (locale: Locale) => NumberFormatSchema
  setNumberFormat: (locale: Locale, format: NumberFormatSchema) => void
  mergeNumberFormat: (locale: Locale, format: NumberFormatSchema) => void
}

export type I18n = {
  global: Composer
  install: (app: unknown, options: unknown[]) => void
}

const I18nContext = createContext<Composer | null>(null)

let activeI18n: I18n | null = null
let activeComposer: Composer | null = null
let fallbackComposer: Composer | null = null

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const isDictionary = (value: unknown): value is LocaleMessageDictionary => {
  return isRecord(value)
}

const normalizeLocale = (locale?: string): Locale => {
  const nextLocale = String(locale ?? '').trim()
  return nextLocale || 'en'
}

const getLocaleCandidates = (locale: Locale): Locale[] => {
  const normalizedLocale = normalizeLocale(locale)
  const localeCandidates = [normalizedLocale]
  const baseLocale = normalizedLocale.split('-')[0]

  if (baseLocale && baseLocale !== normalizedLocale) {
    localeCandidates.push(baseLocale)
  }

  return localeCandidates
}

const cloneMessageValue = (value: LocaleMessageValue): LocaleMessageValue => {
  return value
}

const cloneLocaleMessage = (message?: LocaleMessageDictionary): LocaleMessageDictionary => {
  return { ...message }
}

const cloneLocaleMessages = (messages?: LocaleMessages): LocaleMessages => {
  const cloned: LocaleMessages = {}
  const source = messages ?? {}

  Object.keys(source).forEach(locale => {
    cloned[locale] = cloneLocaleMessage(source[locale])
  })

  return cloned
}

const cloneDateTimeFormats = (formats?: DateTimeFormats): DateTimeFormats => {
  const cloned: DateTimeFormats = {}
  const source = formats ?? {}

  Object.keys(source).forEach(locale => {
    cloned[locale] = { ...source[locale] }
  })

  return cloned
}

const cloneNumberFormats = (formats?: NumberFormats): NumberFormats => {
  const cloned: NumberFormats = {}
  const source = formats ?? {}

  Object.keys(source).forEach(locale => {
    cloned[locale] = { ...source[locale] }
  })

  return cloned
}

const mergeLocaleMessage = (
  base: LocaleMessageDictionary,
  patch: LocaleMessageDictionary,
): LocaleMessageDictionary => {
  const merged = cloneLocaleMessage(base)

  Object.keys(patch).forEach(key => {
    merged[key] = cloneMessageValue(patch[key])
  })

  return merged
}

const mergeFormatSchema = <T extends Record<string, unknown>>(base: T, patch: T): T => {
  return {
    ...(base ?? ({} as T)),
    ...(patch ?? ({} as T)),
  }
}

const resolveLocaleMessageLoader = (loaders: LocaleMessageLoaders | undefined, locale: Locale) => {
  if (!loaders) {
    return null
  }

  if (typeof loaders === 'function') {
    return loaders
  }

  const localeCandidates = getLocaleCandidates(locale)

  for (let index = 0; index < localeCandidates.length; index += 1) {
    const loader = loaders[localeCandidates[index]]
    if (loader) {
      return loader
    }
  }

  return null
}

const normalizeLocaleMessageLoaderResult = (result: LocaleMessageLoaderResult) => {
  if (
    result &&
    isDictionary((result as { default?: unknown }).default) &&
    Object.keys(result as Record<string, unknown>).length === 1
  ) {
    return cloneLocaleMessage((result as { default: LocaleMessageDictionary }).default)
  }

  if (isDictionary(result)) {
    return cloneLocaleMessage(result)
  }

  return {}
}

const resolveLocaleChain = (locale: Locale, fallbackLocale: FallbackLocale): Locale[] => {
  const chain: Locale[] = []
  const append = (value?: Locale) => {
    const nextLocale = normalizeLocale(value)

    if (!chain.includes(nextLocale)) {
      chain.push(nextLocale)
    }
  }

  append(locale)

  if (fallbackLocale === false) {
    return chain
  }

  if (Array.isArray(fallbackLocale)) {
    fallbackLocale.forEach(item => append(item))
    return chain
  }

  append(fallbackLocale)
  return chain
}

const isNamedInterpolation = (values?: InterpolationValues): values is NamedInterpolationValues => {
  return isRecord(values)
}

const stringifyInterpolationValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  ) {
    return String(value)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map(item => stringifyInterpolationValue(item)).join('')
  }

  return String(value)
}

const interpolate = (template: string, values?: InterpolationValues): string => {
  return template.replace(/\{([^}]+)\}/g, (token, rawKey) => {
    const key = String(rawKey).trim()

    if (Array.isArray(values) && /^\d+$/.test(key)) {
      const item = values[Number(key)]
      return item === undefined ? token : stringifyInterpolationValue(item)
    }

    if (isNamedInterpolation(values) && key in values) {
      return stringifyInterpolationValue(values[key])
    }

    return token
  })
}

const getFallbackComposer = (): Composer => {
  if (!fallbackComposer) {
    fallbackComposer = createComposer({})
  }

  return fallbackComposer
}

const extractComposerOptions = (options?: ComposerOptions): ComposerOptions => ({
  locale: options?.locale,
  fallbackLocale: options?.fallbackLocale,
  messages: options?.messages,
  datetimeFormats: options?.datetimeFormats,
  numberFormats: options?.numberFormats,
  messageLoader: options?.messageLoader,
  missing: options?.missing,
  missingWarn: options?.missingWarn,
  fallbackWarn: options?.fallbackWarn,
})

const hasComposerOptions = (options?: ComposerOptions): boolean => {
  if (!options) {
    return false
  }

  return (
    options.locale !== undefined ||
    options.fallbackLocale !== undefined ||
    options.messages !== undefined ||
    options.datetimeFormats !== undefined ||
    options.numberFormats !== undefined ||
    options.messageLoader !== undefined ||
    options.missing !== undefined ||
    options.missingWarn !== undefined ||
    options.fallbackWarn !== undefined
  )
}

const syncComposer = (composer: Composer, options: ComposerOptions) => {
  if (options.locale !== undefined) {
    composer.setLocale(options.locale)
  }

  if (options.fallbackLocale !== undefined) {
    composer.fallbackLocale.value = options.fallbackLocale
  }

  if (options.messages !== undefined) {
    composer.messages.value = cloneLocaleMessages(options.messages)
    ;(composer.availableLocales as WritableValueSignal<Locale[]>).value = Object.keys(
      composer.messages.value,
    ).sort()
  }

  if (options.datetimeFormats !== undefined) {
    composer.datetimeFormats.value = cloneDateTimeFormats(options.datetimeFormats)
  }

  if (options.numberFormats !== undefined) {
    composer.numberFormats.value = cloneNumberFormats(options.numberFormats)
  }
}

const trackComposer = (composer: Composer) => {
  void composer.locale.value
  void composer.fallbackLocale.value
  void composer.messages.value
  void composer.datetimeFormats.value
  void composer.numberFormats.value
  void composer.loadingLocales.value
}

export const createComposer = (options: ComposerOptions = {}): Composer => {
  const locale = ref<Locale>(normalizeLocale(options.locale))
  const fallbackLocale = ref<FallbackLocale>(options.fallbackLocale ?? false)
  const messages = ref<LocaleMessages>(cloneLocaleMessages(options.messages))
  const datetimeFormats = ref<DateTimeFormats>(cloneDateTimeFormats(options.datetimeFormats))
  const numberFormats = ref<NumberFormats>(cloneNumberFormats(options.numberFormats))
  const availableLocales = ref<Locale[]>(Object.keys(messages.value).sort())
  const loadingLocales = ref<Locale[]>([])
  const pendingLocaleLoads = new Map<Locale, Promise<LocaleMessageDictionary>>()
  const loadedLocaleLoads = new Set<Locale>()

  const syncAvailableLocales = () => {
    availableLocales.value = Object.keys(messages.value).sort()
  }

  const getLocaleMessageValue = (targetLocale: Locale) => {
    return cloneLocaleMessage(messages.value[normalizeLocale(targetLocale)])
  }

  const setLocaleMessageValue = (targetLocale: Locale, message: LocaleMessageDictionary) => {
    const localeKey = normalizeLocale(targetLocale)
    messages.value = cloneLocaleMessages({
      ...messages.value,
      [localeKey]: cloneLocaleMessage(message),
    })
    syncAvailableLocales()
  }

  const mergeLocaleMessageValue = (targetLocale: Locale, message: LocaleMessageDictionary) => {
    const localeKey = normalizeLocale(targetLocale)
    messages.value = cloneLocaleMessages({
      ...messages.value,
      [localeKey]: mergeLocaleMessage(messages.value[localeKey] ?? {}, message),
    })
    syncAvailableLocales()
  }

  const updateLocaleLoading = (targetLocale: Locale, nextLoading: boolean) => {
    const localeKey = normalizeLocale(targetLocale)

    if (nextLoading) {
      if (loadingLocales.value.includes(localeKey)) {
        return
      }

      loadingLocales.value = [...loadingLocales.value, localeKey]
      return
    }

    if (!loadingLocales.value.includes(localeKey)) {
      return
    }

    loadingLocales.value = loadingLocales.value.filter(candidate => candidate !== localeKey)
  }

  const loadLocaleMessages = async (
    targetLocale: Locale,
    loadOptions: LocaleMessageLoadOptions = {},
  ) => {
    const localeKey = normalizeLocale(targetLocale)
    const loader = resolveLocaleMessageLoader(options.messageLoader, localeKey)

    if (!loader) {
      return getLocaleMessageValue(localeKey)
    }

    if (!loadOptions.force) {
      const pendingLoad = pendingLocaleLoads.get(localeKey)
      if (pendingLoad) {
        return pendingLoad
      }

      if (loadedLocaleLoads.has(localeKey)) {
        return getLocaleMessageValue(localeKey)
      }
    }

    updateLocaleLoading(localeKey, true)

    const loadTask = Promise.resolve(loader(localeKey))
      .then(result => normalizeLocaleMessageLoaderResult(result))
      .then(message => {
        if (loadOptions.merge === false) {
          setLocaleMessageValue(localeKey, message)
        } else {
          mergeLocaleMessageValue(localeKey, message)
        }

        loadedLocaleLoads.add(localeKey)
        return getLocaleMessageValue(localeKey)
      })
      .finally(() => {
        pendingLocaleLoads.delete(localeKey)
        updateLocaleLoading(localeKey, false)
      })

    pendingLocaleLoads.set(localeKey, loadTask)
    return loadTask
  }

  const resolveMessageRecord = (key: string, targetLocale?: Locale) => {
    const requestLocale = normalizeLocale(targetLocale ?? locale.value)
    const chain = resolveLocaleChain(requestLocale, fallbackLocale.value)

    for (let index = 0; index < chain.length; index += 1) {
      const candidateLocale = chain[index]
      const value = messages.value[candidateLocale]?.[key]

      if (value !== undefined) {
        if (candidateLocale !== requestLocale && options.fallbackWarn) {
          console.warn(
            `[rue-i18n] Message "${key}" fell back from locale "${requestLocale}" to "${candidateLocale}".`,
          )
        }

        return {
          locale: candidateLocale,
          value,
        }
      }
    }

    return null
  }

  const renderMessageValue = (
    value: unknown,
    messageLocale: Locale,
    message: string,
    interpolation?: InterpolationValues,
  ): string | null => {
    if (value === null || value === undefined) {
      return ''
    }

    if (typeof value === 'function') {
      const nextValue = (value as MessageFunction)({
        locale: messageLocale,
        message,
        values: interpolation,
        named: name => (isNamedInterpolation(interpolation) ? interpolation[name] : undefined),
        list: index => (Array.isArray(interpolation) ? interpolation[index] : undefined),
      })
      return renderMessageValue(nextValue, messageLocale, message, interpolation)
    }

    if (typeof value === 'string') {
      return interpolate(value, interpolation)
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint' ||
      typeof value === 'symbol'
    ) {
      return String(value)
    }

    if (Array.isArray(value)) {
      return value
        .map(item => {
          const rendered = renderMessageValue(item, messageLocale, message, interpolation)
          return rendered ?? ''
        })
        .join('')
    }

    if (isDictionary(value)) {
      return null
    }

    return String(value)
  }

  const resolveDateTimeOptions = (
    requestLocale: Locale,
    format?: string | Intl.DateTimeFormatOptions,
  ): Intl.DateTimeFormatOptions => {
    if (typeof format !== 'string') {
      return format ?? {}
    }

    const chain = resolveLocaleChain(requestLocale, fallbackLocale.value)

    for (let index = 0; index < chain.length; index += 1) {
      const candidateLocale = chain[index]
      const optionsForLocale = datetimeFormats.value[candidateLocale]?.[format]

      if (optionsForLocale) {
        return optionsForLocale
      }
    }

    return {}
  }

  const resolveNumberOptions = (
    requestLocale: Locale,
    format?: string | Intl.NumberFormatOptions,
  ): Intl.NumberFormatOptions => {
    if (typeof format !== 'string') {
      return format ?? {}
    }

    const chain = resolveLocaleChain(requestLocale, fallbackLocale.value)

    for (let index = 0; index < chain.length; index += 1) {
      const candidateLocale = chain[index]
      const optionsForLocale = numberFormats.value[candidateLocale]?.[format]

      if (optionsForLocale) {
        return optionsForLocale
      }
    }

    return {}
  }

  return {
    locale,
    fallbackLocale,
    messages,
    datetimeFormats,
    numberFormats,
    availableLocales,
    loadingLocales,
    _(message, values, targetLocale) {
      const interpolatedSourceMessage = interpolate(message, values)
      const record = resolveMessageRecord(message, targetLocale)

      if (record) {
        const rendered = renderMessageValue(record.value, record.locale, message, values)
        return rendered ?? interpolatedSourceMessage
      }

      const requestLocale = normalizeLocale(targetLocale ?? locale.value)
      const missingResult = options.missing?.(requestLocale, message)

      if (typeof missingResult === 'string') {
        return interpolate(missingResult, values)
      }

      if (options.missingWarn) {
        console.warn(`[rue-i18n] Missing message "${message}" for locale "${requestLocale}".`)
      }

      return interpolatedSourceMessage
    },
    d(value, format, targetLocale) {
      const requestLocale = normalizeLocale(targetLocale ?? locale.value)
      const normalizedDate = value instanceof Date ? value : new Date(value)

      try {
        return new Intl.DateTimeFormat(
          requestLocale,
          resolveDateTimeOptions(requestLocale, format),
        ).format(normalizedDate)
      } catch {
        return String(value)
      }
    },
    n(value, format, targetLocale) {
      const requestLocale = normalizeLocale(targetLocale ?? locale.value)

      try {
        return new Intl.NumberFormat(
          requestLocale,
          resolveNumberOptions(requestLocale, format),
        ).format(value)
      } catch {
        return String(value)
      }
    },
    isLocaleLoading(targetLocale) {
      return loadingLocales.value.includes(normalizeLocale(targetLocale))
    },
    loadLocaleMessages,
    setLocale(nextLocale) {
      locale.value = normalizeLocale(nextLocale)
    },
    getLocaleMessage(targetLocale) {
      return getLocaleMessageValue(targetLocale)
    },
    setLocaleMessage(targetLocale, message) {
      setLocaleMessageValue(targetLocale, message)
    },
    mergeLocaleMessage(targetLocale, message) {
      mergeLocaleMessageValue(targetLocale, message)
    },
    getDateTimeFormat(targetLocale) {
      return { ...datetimeFormats.value[normalizeLocale(targetLocale)] }
    },
    setDateTimeFormat(targetLocale, format) {
      const localeKey = normalizeLocale(targetLocale)
      datetimeFormats.value = {
        ...datetimeFormats.value,
        [localeKey]: { ...format },
      }
    },
    mergeDateTimeFormat(targetLocale, format) {
      const localeKey = normalizeLocale(targetLocale)
      datetimeFormats.value = {
        ...datetimeFormats.value,
        [localeKey]: mergeFormatSchema(datetimeFormats.value[localeKey] ?? {}, format ?? {}),
      }
    },
    getNumberFormat(targetLocale) {
      return { ...numberFormats.value[normalizeLocale(targetLocale)] }
    },
    setNumberFormat(targetLocale, format) {
      const localeKey = normalizeLocale(targetLocale)
      numberFormats.value = {
        ...numberFormats.value,
        [localeKey]: { ...format },
      }
    },
    mergeNumberFormat(targetLocale, format) {
      const localeKey = normalizeLocale(targetLocale)
      numberFormats.value = {
        ...numberFormats.value,
        [localeKey]: mergeFormatSchema(numberFormats.value[localeKey] ?? {}, format ?? {}),
      }
    },
  }
}

export const createI18n = (options: ComposerOptions = {}): I18n => {
  const global = createComposer(options)

  const i18n: I18n = {
    global,
    install() {
      activeI18n = i18n
      activeComposer = global
    },
  }

  return i18n
}

export const I18nProvider: FC<I18nProviderProps> = props => {
  const localComposer = useSetup(() => createComposer(extractComposerOptions(props)))

  if (!props.composer && !props.i18n) {
    syncComposer(localComposer, extractComposerOptions(props))
  }

  const composer = props.composer ?? props.i18n?.global ?? localComposer

  return h(I18nContext.Provider as any, { value: composer }, props.children as any)
}

export const useI18n = (options: UseI18nOptions = {}): Composer => {
  const contextComposer = useContext(I18nContext)
  const globalComposer =
    options.i18n?.global ?? contextComposer ?? activeComposer ?? getFallbackComposer()
  const shouldUseLocalComposer = options.useScope === 'local' || hasComposerOptions(options)

  if (!shouldUseLocalComposer || options.useScope === 'global') {
    trackComposer(globalComposer)
    return globalComposer
  }

  const localComposerRef = useRef<Composer>()
  if (!localComposerRef.current) {
    localComposerRef.current = createComposer(extractComposerOptions(options))
  }
  const localComposer = localComposerRef.current
  trackComposer(localComposer)
  return localComposer
}

export const getActiveI18n = (): I18n | null => activeI18n
export { I18nContext }
