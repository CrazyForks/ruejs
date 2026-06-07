const locales = ['en', 'de'] as const

export default async function getRequestMessages(requestLocale: Promise<string | undefined>) {
  const requested = await requestLocale
  const resolvedLocale = locales.includes(requested as (typeof locales)[number]) ? requested : 'en'
  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
  }
}
