import { type FC } from '@rue-js/rue'
import { RouterLink, RouterView } from '@rue-js/router'

export const App: FC = () => (
  <main class="shell">
    <nav class="nav">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/about">About</RouterLink>
      <RouterLink to="/dashboard">Dashboard</RouterLink>
      <RouterLink to="/counter">Counter</RouterLink>
    </nav>
    <RouterView />
  </main>
)
