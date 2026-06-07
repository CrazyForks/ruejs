import { notFound } from 'text/navigation'

const locales = ['en', 'de'] as const

export default async function LocaleLayout({
  children,
  params,
}: {
  children: unknown
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound()
  }

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  )
}
