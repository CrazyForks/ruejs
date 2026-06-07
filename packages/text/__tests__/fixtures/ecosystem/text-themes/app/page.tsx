import { ThemeToggle } from './theme-toggle'

export default function Home() {
  return (
    <div>
      <h1>text-themes test</h1>
      <p data-testid="ssr-content">Server-rendered content</p>
      <ThemeToggle />
    </div>
  )
}
