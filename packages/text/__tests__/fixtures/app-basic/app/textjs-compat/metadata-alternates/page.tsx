import type { Metadata } from 'text'

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://example.com/alternates',
    languages: {
      'en-US': 'https://example.com/alternates/en-US',
      'de-DE': 'https://example.com/alternates/de-DE',
    },
  },
}

export default function Page() {
  return <div id="alternates">Alternates page</div>
}
