export const dynamicParams = false

export function generateStaticParams() {
  return [{ category: 'docs' }]
}

export default function Layout({ children }: { children: import('@rue-js/rue').RenderableOutput }) {
  return children
}
