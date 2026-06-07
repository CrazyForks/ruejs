import type { Metadata } from 'text'

export const metadata: Metadata = {
  title: 'Metadata Not Found Layout Title',
  description: 'Layout description for not-found test',
}

export default function Layout({ children }: { children: unknown }) {
  return <div id="metadata-not-found-layout">{children}</div>
}
