import type { Metadata } from 'text'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function Page() {
  return <div id="robots">Robots page</div>
}
