import type { Metadata } from 'text'

export const metadata: Metadata = {
  title: {
    template: '%s | Layout',
    default: 'title template layout default',
  },
}

export default function Layout({ children }: { children: unknown }) {
  return <div>{children}</div>
}
