export const dynamicParams = false

export function generateStaticParams() {
  return [{ id: 'known' }]
}

export default function Layout({ children }: { children: import('@rue-js/rue').RenderableOutput }) {
  return children
}
