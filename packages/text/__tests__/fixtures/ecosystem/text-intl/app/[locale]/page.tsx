const messages = {
  en: {
    title: 'Hello World',
    description: 'This page uses Rue-native messages for internationalization.',
  },
  de: {
    title: 'Hallo Welt',
    description: 'Diese Seite verwendet Rue-native Nachrichten zur Internationalisierung.',
  },
} as const

export default async function HomePage({ params }: { params: Promise<{ locale: 'en' | 'de' }> }) {
  const { locale } = await params
  const t = messages[locale] ?? messages.en

  return (
    <div>
      <h1 data-testid="title">{t.title}</h1>
      <p data-testid="description">{t.description}</p>
    </div>
  )
}
